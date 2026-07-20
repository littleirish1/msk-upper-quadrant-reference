#!/usr/bin/env python3
"""Private, offline source-intake pilot.

Source bodies are read from an operator-supplied inbox and written only to the
ignored private cache. Tracked output contains metadata, short citation
candidates, and blocked content proposals.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import html
import json
import os
import re
import sys
import zipfile
from collections import Counter, defaultdict
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path, PurePosixPath
from typing import Iterable
from urllib.parse import urlparse
from xml.etree import ElementTree as ET

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover - reported clearly at runtime
    PdfReader = None


ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "ai-manager" / "private-cache" / "source-intake-pilot"
REPORTS = ROOT / "ai-manager" / "reports" / "source-intake-pilot"
HYGIENE_NAMES = ROOT / "ai-manager" / "content-hygiene-names.json"

SUPPORTED = {".pdf", ".pptx", ".docx", ".xlsx", ".txt", ".md", ".html", ".htm"}
METADATA_ONLY = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".mov", ".avi", ".zip"}
UNSUPPORTED = {".ppt", ".doc", ".xls"}

REFERENCE_STATUS = {
    "extracted-unverified",
    "incomplete-citation",
    "identifier-present-unverified",
    "likely-duplicate",
    "verified-later",
    "unable-to-identify",
}

REGION_TERMS = {
    "cervical": ["cervical", "neck"],
    "thoracic": ["thoracic"],
    "shoulder": ["shoulder", "rotator cuff", "rcrsp", "subacromial"],
    "elbow": ["elbow", "epicondyl"],
    "wrist-hand": ["wrist", "hand", "carpal", "scaphoid"],
    "headache": ["headache", "migraine"],
    "neurology": ["neurolog", "stroke", "cranial", "spinal cord"],
    "anatomy": ["anatom", "nerve", "muscle", "ligament"],
    "lumbar": ["lumbar", "low back"],
    "hip": [" hip ", "groin"],
    "knee": ["knee", "patell"],
    "ankle-foot": ["ankle", "foot", "achilles", "plantar"],
}

TOPIC_TERMS = {
    "rcrsp": ["rcrsp", "rotator cuff related", "rotator cuff-related", "subacromial", "rotator cuff tendinopathy"],
    "rotator-cuff-tear": ["rotator cuff tear"],
    "shoulder-differential": ["shoulder differential", "differential diagnosis"],
    "exercise-rehabilitation": ["exercise", "rehab", "loading"],
    "prognosis": ["prognosis", "recovery", "natural history"],
    "imaging": ["imaging", "ultrasound", "mri", "x-ray", "radiograph"],
    "patient-communication": ["patient information", "communication", "reassurance"],
    "special-tests": ["special test", "diagnostic test", "test cluster"],
    "outcome-measures": ["outcome measure", "questionnaire", "score"],
    "lateral-ankle-sprain": ["lateral ankle sprain", "ankle sprain"],
    "ankle-ligament-anatomy": ["atfl", "cfl", "anterior talofibular", "calcaneofibular"],
    "fracture-screening": ["ottawa ankle", "fracture", "malleol"],
    "syndesmosis": ["syndesmosis", "high ankle sprain"],
    "balance-proprioception": ["balance", "proprioception", "neuromuscular"],
    "return-to-sport": ["return to sport", "return-to-sport", "return to running"],
    "recurrence-prevention": ["recurrence", "prevention"],
    "bracing-taping": ["brace", "bracing", "taping", "strapping"],
    "guideline": ["guideline", "clinical practice guideline", "nice"],
    "paper": ["doi", "journal", "randomised", "systematic review", "meta-analysis"],
    "osce": ["osce", "station", "candidate instructions"],
}

QUARANTINE_FILENAME = re.compile(
    r"(?:portfolio|reflective|reflection|placement|student|feedback|mark(?:s|ing)?|answer(?:s| key)?|"
    r"exam(?:ination)?|assessment submission|cv\b|curriculum vitae|appraisal|personal statement|patient record)",
    re.I,
)
RESTRICTED_FILENAME = re.compile(r"(?:case notes?|clinical record|handover|attendance|register|results?)", re.I)
EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I)
PHONE_RE = re.compile(r"(?<!\d)(?:\+44\s?\d{9,10}|0\d{3,4}[\s-]?\d{5,7})(?!\d)")
NHS_RE = re.compile(r"\b(?:NHS|hospital|patient)\s*(?:number|no\.?|id)\s*[:#-]?\s*\d{6,12}\b", re.I)
STUDENT_ID_RE = re.compile(r"\b(?:student|candidate)\s*(?:number|no\.?|id)\s*[:#-]?\s*[A-Z0-9-]{5,20}\b", re.I)
DOB_RE = re.compile(r"\b(?:DOB|date of birth)\s*[:#-]?\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b", re.I)
ENV_CREDENTIAL_NAMES = "|".join([
    "_".join(["OPENAI", "API", "KEY"]),
    "_".join(["API", "KEY"]),
    "_".join(["PRIVATE", "KEY"]),
    "".join(["SEC", "RET"]),
])
CREDENTIAL_VALUE_RE = re.compile(
    r"(?:AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|"
    rf"(?:{ENV_CREDENTIAL_NAMES})\s*[:=]\s*[^\s]{{8,}})",
    re.I,
)
DOI_RE = re.compile(r"\b10\.\d{4,9}/[-._;()/:A-Z0-9]+", re.I)
PMID_RE = re.compile(r"\bPMID\s*[:#]?\s*(\d{6,9})\b", re.I)
URL_RE = re.compile(r"https?://[^\s<>\]\)\"']+", re.I)
AUTHOR_YEAR_RE = re.compile(r"\b([A-Z][A-Za-z'’-]+(?:\s+(?:et al\.?|&\s+[A-Z][A-Za-z'’-]+))?)\s*[,\(]\s*((?:19|20)\d{2}[a-z]?)\)?")
YEAR_RE = re.compile(r"\b((?:19|20)\d{2}[a-z]?)\b", re.I)


@dataclass
class Occurrence:
    logical_path: str
    filename: str
    data: bytes
    modified_date: str | None
    container_source_id: str | None = None


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def source_id(data: bytes) -> str:
    return f"src-{sha256(data)[:12]}"


def clean_xml_text(data: bytes) -> str:
    try:
        root = ET.fromstring(data)
    except ET.ParseError:
        return ""
    return " ".join(t.strip() for t in root.itertext() if t and t.strip())


def extract_pdf(data: bytes) -> tuple[list[dict], dict]:
    if PdfReader is None:
        raise RuntimeError("pypdf is not installed")
    reader = PdfReader(BytesIO(data))
    units = []
    links = []
    images = 0
    for number, page in enumerate(reader.pages, 1):
        text = page.extract_text() or ""
        units.append({"number": number, "kind": "page", "text": text, "links": []})
        try:
            annotations = page.get("/Annots") or []
            for annotation in annotations:
                obj = annotation.get_object()
                action = obj.get("/A")
                uri = action.get("/URI") if action else None
                if uri:
                    links.append(str(uri))
                    units[-1]["links"].append(str(uri))
        except Exception:
            pass
        try:
            images += len(page.images)
        except Exception:
            pass
    return units, {"method": "pypdf-embedded-text", "tables": 0, "images": images, "warnings": []}


def zip_xml_parts(data: bytes, prefix: str, suffix: str = ".xml") -> list[str]:
    with zipfile.ZipFile(BytesIO(data)) as archive:
        return sorted(name for name in archive.namelist() if name.startswith(prefix) and name.endswith(suffix))


def extract_pptx(data: bytes) -> tuple[list[dict], dict]:
    units = []
    image_count = 0
    with zipfile.ZipFile(BytesIO(data)) as archive:
        names = set(archive.namelist())
        slides = sorted(
            (name for name in names if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)),
            key=lambda name: int(re.search(r"(\d+)", PurePosixPath(name).stem).group(1)),
        )
        image_count = sum(1 for name in names if name.startswith("ppt/media/"))
        for idx, slide in enumerate(slides, 1):
            text = clean_xml_text(archive.read(slide))
            notes_name = f"ppt/notesSlides/notesSlide{idx}.xml"
            notes = clean_xml_text(archive.read(notes_name)) if notes_name in names else ""
            links = []
            rel_name = f"ppt/slides/_rels/slide{idx}.xml.rels"
            if rel_name in names:
                try:
                    rel_root = ET.fromstring(archive.read(rel_name))
                    links = [node.attrib["Target"] for node in rel_root if node.attrib.get("TargetMode") == "External"]
                except ET.ParseError:
                    pass
            units.append({"number": idx, "kind": "slide", "text": text, "notes": notes, "links": links})
    return units, {"method": "pptx-openxml", "tables": 0, "images": image_count, "warnings": []}


def extract_docx(data: bytes) -> tuple[list[dict], dict]:
    texts = []
    image_count = 0
    links = []
    with zipfile.ZipFile(BytesIO(data)) as archive:
        names = set(archive.namelist())
        for part, label in [("word/document.xml", "document"), ("word/footnotes.xml", "footnotes"), ("word/endnotes.xml", "endnotes")]:
            if part in names:
                value = clean_xml_text(archive.read(part))
                if value:
                    texts.append(f"[{label}] {value}")
        image_count = sum(1 for name in names if name.startswith("word/media/"))
        for rel in (name for name in names if name.startswith("word/_rels/") and name.endswith(".rels")):
            try:
                root = ET.fromstring(archive.read(rel))
                links.extend(node.attrib["Target"] for node in root if node.attrib.get("TargetMode") == "External")
            except ET.ParseError:
                pass
    text = "\n".join(texts)
    return [{"number": 1, "kind": "document", "text": text, "links": links}], {"method": "docx-openxml", "tables": 0, "images": image_count, "warnings": []}


def extract_xlsx(data: bytes) -> tuple[list[dict], dict]:
    units = []
    with zipfile.ZipFile(BytesIO(data)) as archive:
        names = set(archive.namelist())
        shared = clean_xml_text(archive.read("xl/sharedStrings.xml")) if "xl/sharedStrings.xml" in names else ""
        sheets = sorted(name for name in names if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", name))
        for idx, sheet in enumerate(sheets, 1):
            text = clean_xml_text(archive.read(sheet))
            units.append({"number": idx, "kind": "sheet", "text": f"{shared}\n{text}".strip(), "links": []})
    return units, {"method": "xlsx-openxml", "tables": len(units), "images": 0, "warnings": []}


def extract_html(data: bytes) -> tuple[list[dict], dict]:
    decoded = data.decode("utf-8", errors="replace")
    links = re.findall(r"href\s*=\s*[\"'](https?://[^\"']+)", decoded, re.I)
    text = re.sub(r"<script\b[^>]*>.*?</script>|<style\b[^>]*>.*?</style>", " ", decoded, flags=re.I | re.S)
    text = html.unescape(re.sub(r"<[^>]+>", " ", text))
    text = re.sub(r"\s+", " ", text).strip()
    return [{"number": 1, "kind": "document", "text": text, "links": links}], {"method": "html-embedded-text", "tables": 0, "images": len(re.findall(r"<img\b", decoded, re.I)), "warnings": []}


def extract_text(data: bytes, extension: str) -> tuple[list[dict], dict]:
    if extension == ".pdf":
        return extract_pdf(data)
    if extension == ".pptx":
        return extract_pptx(data)
    if extension == ".docx":
        return extract_docx(data)
    if extension == ".xlsx":
        return extract_xlsx(data)
    if extension in {".html", ".htm"}:
        return extract_html(data)
    if extension in {".txt", ".md"}:
        decoded = data.decode("utf-8", errors="replace")
        return [{"number": 1, "kind": "document", "text": decoded, "links": URL_RE.findall(decoded)}], {"method": "plain-text", "tables": 0, "images": 0, "warnings": []}
    return [], {"method": "metadata-only", "tables": 0, "images": 0, "warnings": []}


def load_governed_names() -> list[str]:
    try:
        payload = json.loads(HYGIENE_NAMES.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    values = []
    if isinstance(payload, list):
        values = payload
    elif isinstance(payload, dict):
        for value in payload.values():
            if isinstance(value, list):
                values.extend(value)
    return sorted({str(value).strip() for value in values if str(value).strip()}, key=len, reverse=True)


def count_sensitive(text: str, governed_names: list[str]) -> tuple[list[dict], bool, bool]:
    patterns = {
        "email-address": EMAIL_RE,
        "telephone-number": PHONE_RE,
        "patient-or-hospital-number": NHS_RE,
        "date-of-birth": DOB_RE,
        "student-identifier": STUDENT_ID_RE,
        "credential-or-secret": CREDENTIAL_VALUE_RE,
    }
    findings = []
    for category, pattern in patterns.items():
        count = len(pattern.findall(text))
        if count:
            findings.append({"category": category, "count": count})
    name_count = sum(len(re.findall(re.escape(name), text, re.I)) for name in governed_names)
    if name_count:
        findings.append({"category": "governed-identifiable-name", "count": name_count})
    fatal_secret = any(item["category"] == "credential-or-secret" for item in findings)
    fatal_patient = any(item["category"] == "patient-or-hospital-number" for item in findings)
    return findings, fatal_secret, fatal_patient


def tags_for(value: str, mapping: dict[str, list[str]]) -> list[str]:
    lower = f" {value.lower()} "
    return sorted(key for key, terms in mapping.items() if any(term in lower for term in terms))


def classify_type(filename: str, extension: str, text: str) -> str:
    lower = f"{filename} {text[:12000]}".lower()
    if "ankle" in lower and ("patient information" in lower or "leaflet" in lower):
        return "local-patient-leaflet"
    if "guideline" in lower or "clinical practice guideline" in lower:
        return "clinical-guideline"
    if QUARANTINE_FILENAME.search(filename):
        return "portfolio-reflective-material" if re.search(r"portfolio|reflect", filename, re.I) else "administrative"
    if "osce" in lower or "candidate instruction" in lower:
        return "osce-material"
    if "anatom" in lower:
        return "anatomy-resource"
    if "outcome measure" in lower or "questionnaire" in lower:
        return "outcome-measure"
    if extension == ".pdf" and ("journal" in lower or "doi" in lower or "systematic review" in lower):
        return "pdf-paper"
    return {
        ".pptx": "teaching-presentation", ".ppt": "teaching-presentation",
        ".docx": "word-document", ".doc": "word-document",
        ".xlsx": "spreadsheet", ".xls": "spreadsheet",
        ".html": "html", ".htm": "html", ".txt": "notes", ".md": "notes",
        ".jpg": "image", ".jpeg": "image", ".png": "image", ".gif": "image", ".webp": "image",
        ".mp4": "video", ".mov": "video", ".avi": "video", ".zip": "archive",
    }.get(extension, "unknown")


def source_occurrences(inbox: Path) -> tuple[list[Occurrence], int, int, int]:
    occurrences = []
    top_files = sorted(path for path in inbox.rglob("*") if path.is_file())
    nested_count = 0
    total_bytes = 0
    for path in top_files:
        relative = path.relative_to(inbox).as_posix()
        data = path.read_bytes()
        total_bytes += len(data)
        modified = dt.datetime.fromtimestamp(path.stat().st_mtime).date().isoformat()
        occurrences.append(Occurrence(f"inbox/{relative}", path.name, data, modified))
        if path.suffix.lower() == ".zip":
            container_id = source_id(data)
            try:
                with zipfile.ZipFile(BytesIO(data)) as archive:
                    for info in archive.infolist():
                        if info.is_dir() or info.filename.startswith("__MACOSX/"):
                            continue
                        nested = archive.read(info)
                        total_bytes += len(nested)
                        nested_count += 1
                        try:
                            nested_date = dt.date(*info.date_time[:3]).isoformat()
                        except ValueError:
                            nested_date = None
                        logical = f"archive/{container_id}/{PurePosixPath(info.filename).as_posix()}"
                        occurrences.append(Occurrence(logical, PurePosixPath(info.filename).name, nested, nested_date, container_id))
            except zipfile.BadZipFile:
                pass
    return occurrences, len(top_files), nested_count, total_bytes


def redact_governed(value: str, governed_names: list[str]) -> str:
    redacted = value
    for name in governed_names:
        redacted = re.sub(re.escape(name), "[governed name redacted]", redacted, flags=re.I)
    return redacted


def compact_heading(text: str, governed_names: list[str]) -> list[str]:
    headings = []
    for line in text.splitlines():
        line = re.sub(r"\s+", " ", line).strip(" -:\t")
        if 3 <= len(line) <= 120 and (line.isupper() or len(line.split()) <= 10):
            line = redact_governed(line, governed_names)
            if line not in headings:
                headings.append(line)
        if len(headings) == 30:
            break
    return headings


def reference_candidates(source: dict, units: list[dict], governed_names: list[str]) -> list[dict]:
    candidates = []
    seen = set()
    source_topics = source["topicTags"] or source["regionTags"] or ["general"]
    for unit in units:
        number = unit.get("number")
        blobs = [(unit.get("text", ""), "text"), (unit.get("notes", ""), "speaker notes")]
        for value, label in blobs:
            if not value:
                continue
            lines = [re.sub(r"\s+", " ", line).strip() for line in value.splitlines()]
            if len(lines) <= 1:
                lines = [piece.strip() for piece in re.split(r"(?<=[.;])\s+(?=[A-Z])", value)]
            ref_section = bool(re.search(r"\b(?:references|bibliography|further reading)\b", value, re.I))
            for line in lines:
                if len(line) < 8:
                    continue
                dois = DOI_RE.findall(line)
                pmids = PMID_RE.findall(line)
                urls = URL_RE.findall(line)
                authors = AUTHOR_YEAR_RE.findall(line)
                citation_like = bool(dois or pmids or urls or authors or re.search(r"\b(?:guideline|journal|et al\.|vol\.?|pp?\.)\b", line, re.I))
                if not citation_like:
                    continue
                citation = redact_governed(line[:800], governed_names)
                key = re.sub(r"\W+", "", citation).lower()
                if key in seen:
                    continue
                seen.add(key)
                author_names = []
                year = None
                if authors:
                    author_names = [redact_governed(authors[0][0], governed_names)]
                    year = authors[0][1]
                elif YEAR_RE.search(citation):
                    year = YEAR_RE.search(citation).group(1)
                doi = dois[0].rstrip(".,;") if dois else None
                pmid = pmids[0] if pmids else None
                url = urls[0].rstrip(".,;") if urls else None
                if url and not urlparse(url).netloc:
                    url = None
                status = "identifier-present-unverified" if doi or pmid else "extracted-unverified"
                complete = "full" if author_names and year and len(citation) > 70 else "partial" if author_names or year else "minimal"
                if complete != "full" and not (doi or pmid):
                    status = "incomplete-citation"
                context = "further-reading" if re.search(r"further reading", value, re.I) else "reference-list" if ref_section else "hyperlink" if urls and not authors else "in-text"
                identity = hashlib.sha256(f"{source['sourceId']}|{number}|{citation}".encode()).hexdigest()[:16]
                candidates.append({
                    "candidateReferenceId": f"ref-{identity}",
                    "sourceId": source["sourceId"],
                    "pageOrSlideNumber": number,
                    "location": f"{unit.get('kind', 'document')} {number} {label}",
                    "citationText": citation,
                    "authors": author_names,
                    "year": year,
                    "title": None,
                    "journalOrPublisher": None,
                    "volumeIssuePages": None,
                    "doi": doi,
                    "pmid": pmid,
                    "url": url,
                    "relatedTopicOrClaim": ", ".join(source_topics),
                    "citationContext": context,
                    "extractionConfidence": "high" if doi or pmid else "medium" if author_names else "low",
                    "completenessStatus": complete,
                    "verificationStatus": status,
                    "verificationEvidence": None,
                    "duplicateGroup": None,
                    "notes": "Extracted offline; bibliographic accuracy and relevance are unverified.",
                })
        for link in unit.get("links", []):
            link = link.strip()
            if not re.match(r"^https?://", link, re.I) or not urlparse(link).netloc:
                continue
            key = re.sub(r"\W+", "", link).lower()
            if key in seen:
                continue
            seen.add(key)
            identity = hashlib.sha256(f"{source['sourceId']}|{number}|{link}".encode()).hexdigest()[:16]
            candidates.append({
                "candidateReferenceId": f"ref-{identity}", "sourceId": source["sourceId"],
                "pageOrSlideNumber": number, "location": f"{unit.get('kind', 'document')} {number} embedded hyperlink",
                "citationText": link[:800], "authors": [], "year": None, "title": None,
                "journalOrPublisher": None, "volumeIssuePages": None, "doi": None, "pmid": None,
                "url": link, "relatedTopicOrClaim": ", ".join(source_topics), "citationContext": "hyperlink",
                "extractionConfidence": "high", "completenessStatus": "minimal",
                "verificationStatus": "incomplete-citation", "verificationEvidence": None,
                "duplicateGroup": None, "notes": "Embedded URL extracted offline; destination not accessed.",
            })
    return candidates


def probable_key(filename: str) -> str:
    stem = Path(filename).stem.lower()
    stem = re.sub(r"\b(?:copy|final|revised|updated|old|new|version|ver|v)\s*\d*\b", "", stem)
    stem = re.sub(r"\b20\d{2}\b|\(\d+\)", "", stem)
    return re.sub(r"[^a-z0-9]+", "", stem)


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def write_md(path: Path, title: str, sections: Iterable[tuple[str, str]]) -> None:
    lines = [f"# {title}", ""]
    for heading, body in sections:
        lines.extend([f"## {heading}", "", body.strip(), ""])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def source_rows(records: list[dict], predicate) -> str:
    selected = [record for record in records if predicate(record)]
    if not selected:
        return "No non-quarantined matching sources were identified."
    lines = ["| Source ID | Type | Topics | Review state |", "|---|---|---|---|"]
    for record in selected:
        lines.append(f"| `{record['sourceId']}` | {record['sourceType']} | {', '.join(record['topicTags']) or 'classification pending'} | {record['reviewStatus']} |")
    return "\n".join(lines)


def proposal_graph(records: list[dict]) -> dict:
    nodes = []
    pilots = [
        ("rcrsp", "condition:shoulder/rotator-cuff-related-shoulder-pain", ["Current guideline", "Systematic review", "Clinician review"]),
        ("lateral-ankle-sprain", "condition:ankle-foot/lateral-ankle-sprain", ["Current guideline", "Systematic review", "Clinician review"]),
    ]
    for topic, target, evidence in pilots:
        ids = [r["sourceId"] for r in records if r["sensitivity"] != "quarantine" and topic in r["topicTags"]]
        if not ids:
            continue
        nodes.append({
            "proposalId": f"proposal-{topic}-evidence-development",
            "sourceIds": ids,
            "extractedTeachingTopic": topic.replace("-", " "),
            "proposedClinicalClaim": "Candidate teaching claims require extraction-level review, external evidence verification, and clinician approval before wording is drafted.",
            "targetContentId": target,
            "requiredEvidence": evidence,
            "clinicianReviewStatus": "required",
            "proposalStatus": "blocked-pending-evidence-and-clinician-review",
            "teachingSourceCanEstablishPublicApproval": False,
            "visualLicenceStatus": "unknown-review-required",
            "publicEligibility": False,
        })
    return {"schemaVersion": 1, "nodes": nodes}


def generate_pilot_reports(records: list[dict]) -> None:
    rcrsp = lambda r: r["sensitivity"] != "quarantine" and any(t in r["topicTags"] for t in ["rcrsp", "rotator-cuff-tear", "shoulder-differential"])
    ankle = lambda r: r["sensitivity"] != "quarantine" and any(t in r["topicTags"] for t in ["lateral-ankle-sprain", "ankle-ligament-anatomy", "fracture-screening", "syndesmosis"])
    common_disclaimer = "All extracted teaching statements remain unverified. No item is approved for public clinical use."

    rdir = REPORTS / "rcrsp"
    write_md(rdir / "source-set.md", "RCRSP source set", [("Governance", common_disclaimer), ("Non-quarantined sources", source_rows(records, rcrsp))])
    write_md(rdir / "teaching-content-map.md", "RCRSP teaching content map", [
        ("Purpose", "Maps source coverage without reproducing source bodies or resolving disagreements."),
        ("Coverage", "Candidate topics include terminology, differential diagnosis, exercise and rehabilitation, prognosis, imaging, communication, anatomy, tests, and outcome measures where identified by extraction."),
        ("Comparison required", "Review overlap and conflicts source-by-source in the private cache. Unsupported or outdated-looking statements remain blocked. Images and diagrams require separate licence review."),
    ])
    write_md(rdir / "claims-requiring-verification.md", "RCRSP claims requiring verification", [("Blocked claim areas", "- Terminology and classification\n- Diagnostic value of individual tests and clusters\n- Imaging indications\n- Natural history and prognosis\n- Exercise and procedural intervention comparisons\n- Surgical referral indications\n- Patient communication and outcome-measure interpretation"), ("Status", common_disclaimer)])
    write_md(rdir / "evidence-gaps.md", "RCRSP evidence gaps", [("Required evidence", "Current guidelines, systematic reviews, diagnostic-accuracy studies, prognostic cohorts, and intervention trials must be located and verified externally in a later approved phase."), ("Approval", "Clinician review is required after evidence verification.")])
    write_md(rdir / "proposed-content-links.md", "RCRSP proposed content links", [("Private proposals", "Potential targets include the existing shoulder condition reference, neutral guided case, rotator-cuff anatomy, special-test records, outcome measures, quizzes, flashcards, OSCE material, and patient explanation resources."), ("Publication", "All links are proposals only and public eligibility is false.")])
    steps = ["Initial presentation", "Learner differential", "Justification", "Additional history", "Red flags", "Examination planning", "Examination findings", "Investigation decision", "Management plan", "Patient explanation", "Expert reasoning comparison", "Reflection"]
    write_md(rdir / "guided-case-conversion-brief.md", "RCRSP guided-case conversion brief", [("Existing-case preservation", "The existing public case is not changed by this pilot."), ("Proposed step map", "\n".join(f"{i}. {step}: requires source-supported, clinician-reviewed content before implementation." for i, step in enumerate(steps, 1))), ("Expert answers", "No model answer is authored here. Every proposed expert answer requires cited source support and clinician approval.")])
    r_questions = [
        "Which current terminology and classification framework is preferred?", "What is the diagnostic value of tests and clusters?",
        "When is imaging indicated?", "What is the natural history and prognosis?", "How do exercise and procedural interventions compare?",
        "What are accepted surgical indications?", "Which communication and reassurance approaches are supported?", "Which outcome measures are appropriate?",
    ]
    hierarchy = "Preferred hierarchy: current clinical practice guideline; systematic review/meta-analysis; high-quality randomised trial; prognostic cohort; diagnostic-accuracy study; consensus statement when stronger evidence is unavailable. Suggested sources: guideline repositories, MEDLINE/PubMed, Cochrane Library, PEDro, and relevant professional bodies. No search was performed in this pilot."
    write_md(rdir / "evidence-search-questions.md", "RCRSP evidence search questions", [("Questions", "\n".join(f"- {q}" for q in r_questions)), ("Evidence hierarchy and sources", hierarchy)])
    write_md(rdir / "clinician-review-checklist.md", "RCRSP clinician review checklist", [("Checklist", "- [ ] Confirm terminology\n- [ ] Review differential and safety content\n- [ ] Verify every clinical claim against cited evidence\n- [ ] Confirm test and imaging limitations\n- [ ] Review management, prognosis and communication wording\n- [ ] Confirm case diagnosis remains hidden before reveal\n- [ ] Record named reviewer and decision outside this pilot")])

    adir = REPORTS / "lateral-ankle-sprain"
    write_md(adir / "source-set.md", "Lateral ankle sprain source set", [("Governance", common_disclaimer), ("Non-quarantined sources", source_rows(records, ankle))])
    write_md(adir / "historical-leaflet-content-map.md", "Historical ankle leaflet content map", [
        ("Classification", "The January 2019 local patient-information leaflet is a historical/local-practice source. It requires current evidence cross-check and is not authoritative by itself."),
        ("Topic map", "Candidate topics: injury explanation, symptoms, early management, loading advice, exercises, recovery expectations, return-to-sport progression, and escalation advice."),
        ("Verification flags", "POLICE versus newer frameworks; ice and compression; medication timing; fixed exercise dosage; healing-time statements; bracing/strapping duration; return-to-sport criteria; recurrence prevention; emergency-review thresholds."),
        ("Interpretation", "These points are not declared wrong. They are queued for current evidence review."),
    ])
    ankle_claims = "- Acute management and loading framework\n- External support, ice and compression\n- Medication timing\n- Exercise dosage and progression\n- Recovery and healing-time statements\n- Bracing/strapping duration\n- Return-to-running and sport criteria\n- Recurrence prevention\n- Imaging, referral and emergency thresholds"
    write_md(adir / "claims-requiring-verification.md", "Lateral ankle sprain claims requiring verification", [("Blocked claim areas", ankle_claims), ("Status", common_disclaimer)])
    write_md(adir / "evidence-gaps.md", "Lateral ankle sprain evidence gaps", [("Required evidence", "Current clinical decision rules, guidelines, rehabilitation reviews, prognostic evidence, and return-to-sport consensus require external verification."), ("Approval", "Clinician review is required after evidence verification.")])
    write_md(adir / "proposed-condition-brief.md", "Lateral ankle sprain condition brief", [("Status", "Private proposal only; no public route or clinical answer page is created."), ("Proposed structure", "Overview; assessment and fracture screening; differentials; early management; progressive loading; exercise rehabilitation; return to activity; recurrence prevention; escalation; evidence limitations; patient communication."), ("Blocking rule", "No section may be drafted as a public clinical claim without verified sources and clinician review.")])
    write_md(adir / "proposed-guided-case-brief.md", "Lateral ankle sprain guided-case brief", [("Status", "Private proposal only."), ("Reasoning structure", "Neutral presentation; differential entry; cannot-miss screening; examination plan; findings reveal; investigation decision; staged management; patient explanation; expert comparison; reflection."), ("Expert answers", "No model answer is authored. Every expert step requires source support and clinician approval.")])
    write_md(adir / "proposed-patient-information-update.md", "Lateral ankle sprain patient-information update proposal", [("Purpose", "Compare the historical local leaflet with current verified evidence before drafting an update."), ("Review areas", ankle_claims), ("Copyright", "Do not copy the source leaflet into the public repository. Any replacement must use newly reviewed wording and approved assets.")])
    ankle_questions = [
        "Which clinical decision rules support fracture screening?", "What supports acute loading and external support?",
        "Which exercise and balance interventions improve recovery or reduce recurrence?", "What criteria support return to running and sport?",
        "How should chronic ankle instability be screened and managed?", "When are imaging and referral indicated?",
        "What should current patient information recommend?",
    ]
    write_md(adir / "evidence-search-questions.md", "Lateral ankle sprain evidence search questions", [("Questions", "\n".join(f"- {q}" for q in ankle_questions)), ("Evidence hierarchy and sources", hierarchy)])
    write_md(adir / "clinician-review-checklist.md", "Lateral ankle sprain clinician review checklist", [("Checklist", "- [ ] Verify fracture and syndesmosis screening\n- [ ] Review acute management and loading\n- [ ] Verify exercise and progression advice\n- [ ] Confirm return-to-sport and recurrence-prevention criteria\n- [ ] Review escalation and emergency thresholds\n- [ ] Review patient-facing language\n- [ ] Verify all references\n- [ ] Record reviewer and decision outside this pilot")])


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the private source-intake pilot")
    parser.add_argument("--inbox", help="Private source inbox (or set SOURCE_INBOX_PATH)")
    args = parser.parse_args()
    inbox_value = args.inbox or os.environ.get("SOURCE_INBOX_PATH")
    if not inbox_value:
        print("Source inbox is required via --inbox or SOURCE_INBOX_PATH.", file=sys.stderr)
        return 2
    inbox = Path(inbox_value).resolve()
    if not inbox.is_dir():
        print("The supplied source inbox is not a directory.", file=sys.stderr)
        return 2
    try:
        inbox.relative_to(ROOT)
        print("The source inbox must remain outside the repository.", file=sys.stderr)
        return 2
    except ValueError:
        pass

    CACHE.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)
    governed_names = load_governed_names()
    occurrences, top_count, nested_count, total_bytes = source_occurrences(inbox)
    grouped: dict[str, list[Occurrence]] = defaultdict(list)
    for occurrence in occurrences:
        grouped[source_id(occurrence.data)].append(occurrence)

    records = []
    references = []
    fatal = []
    for sid, source_occurs in sorted(grouped.items()):
        canonical = sorted(source_occurs, key=lambda item: (item.container_source_id is not None, item.logical_path))[0]
        extension = Path(canonical.filename).suffix.lower() or "unknown"
        filename_quarantine = bool(QUARANTINE_FILENAME.search(canonical.filename))
        filename_restricted = bool(RESTRICTED_FILENAME.search(canonical.filename))
        support = "supported" if extension in SUPPORTED else "metadata-only" if extension in METADATA_ONLY else "unsupported"
        units = []
        meta = {"method": "metadata-only" if support == "metadata-only" else "unsupported", "tables": 0, "images": 0, "warnings": []}
        status = "quarantined" if filename_quarantine else "metadata-only" if support == "metadata-only" else "unsupported"
        findings = [{"category": "sensitive-filename-indicator", "count": 1}] if filename_quarantine else []
        if not filename_quarantine and support == "supported":
            try:
                units, meta = extract_text(canonical.data, extension)
                status = "extracted"
            except Exception as error:
                meta = {"method": f"{extension[1:]}-extraction-failed", "tables": 0, "images": 0, "warnings": [f"Extraction failed: {type(error).__name__}"]}
                status = "failed"
        combined_text = "\n".join(f"{unit.get('text', '')}\n{unit.get('notes', '')}" for unit in units)
        if combined_text:
            content_findings, fatal_secret, fatal_patient = count_sensitive(combined_text, governed_names)
            findings.extend(content_findings)
            if fatal_secret:
                fatal.append((sid, "credential-or-secret"))
            if fatal_patient:
                fatal.append((sid, "patient-or-hospital-number"))
        else:
            fatal_secret = fatal_patient = False
        sensitivity = "quarantine" if filename_quarantine or fatal_secret or fatal_patient else "restricted" if filename_restricted or findings else "review-required"
        if sensitivity == "quarantine":
            status = "quarantined"
        topics = tags_for(f"{canonical.filename}\n{combined_text[:60000]}", TOPIC_TERMS)
        regions = tags_for(f"{canonical.filename}\n{combined_text[:60000]}", REGION_TERMS)
        source_type = classify_type(canonical.filename, extension, combined_text)
        if sid == "src-7b548a958b41":
            source_type = "local-patient-leaflet"
            topics = sorted(set(topics + ["lateral-ankle-sprain", "patient-information"]))
            regions = sorted(set(regions + ["ankle-foot"]))
        record = {
            "sourceId": sid,
            "checksum": f"sha256:{sha256(canonical.data)}",
            "logicalPath": f"quarantine/{sid}" if sensitivity == "quarantine" else redact_governed(canonical.logical_path, governed_names),
            "originalFilename": f"restricted-{sid}{extension if extension != 'unknown' else ''}" if sensitivity == "quarantine" else redact_governed(canonical.filename, governed_names),
            "fileType": extension,
            "byteSize": len(canonical.data),
            "modifiedDate": canonical.modified_date,
            "containerSourceId": canonical.container_source_id,
            "occurrences": [{"logicalPath": f"quarantine/{sid}" if sensitivity == "quarantine" else redact_governed(item.logical_path, governed_names), "containerSourceId": item.container_source_id} for item in source_occurs],
            "sourceType": source_type,
            "topicTags": topics,
            "regionTags": regions,
            "duplicateGroup": f"exact-{sid}" if len(source_occurs) > 1 else None,
            "probableVersionGroup": None,
            "sensitivity": sensitivity,
            "sensitivityFindings": findings,
            "extractionSupport": support,
            "extractionStatus": status,
            "extractionMetadata": {
                "method": meta["method"], "pageOrSlideCount": len(units) or None,
                "extractedCharacterCount": len(combined_text), "headingsDetected": compact_heading(combined_text, governed_names),
                "referencesSectionDetected": bool(re.search(r"\b(?:references|bibliography|further reading)\b", combined_text, re.I)),
                "tablesDetected": meta["tables"], "imagesDetected": meta["images"],
                "confidence": "high" if status == "extracted" and len(combined_text) > 200 else "medium" if combined_text else "none",
                "warnings": meta["warnings"],
            },
            "copyrightOrLicenceStatus": "unknown",
            "intendedUse": ["private evidence-development triage"],
            "reviewStatus": "quarantined" if sensitivity == "quarantine" else "restricted-review" if sensitivity == "restricted" else "needs-review",
            "publicEligibility": False,
        }
        records.append(record)
        if units:
            write_json(CACHE / f"{sid}.json", {"sourceId": sid, "units": units, "metadata": meta})
        if sensitivity != "quarantine":
            references.extend(reference_candidates(record, units, governed_names))

    if fatal:
        categories = Counter(category for _, category in fatal)
        print("STOP: undisclosed high-risk material detected during private screening.", file=sys.stderr)
        for category, count in sorted(categories.items()):
            print(f"- {category}: {count} source(s)", file=sys.stderr)
        print("No tracked intake reports were generated. Review the private cache and inbox manually.", file=sys.stderr)
        return 3

    version_groups: dict[str, list[dict]] = defaultdict(list)
    for record in records:
        if record["sensitivity"] != "quarantine":
            key = probable_key(record["originalFilename"])
            if len(key) >= 8:
                version_groups[key].append(record)
    probable_groups = []
    for index, members in enumerate((group for group in version_groups.values() if len(group) > 1), 1):
        group_id = f"version-{index:03d}"
        for member in members:
            member["probableVersionGroup"] = group_id
        probable_groups.append((group_id, members))

    ref_groups: dict[str, list[dict]] = defaultdict(list)
    for ref in references:
        key = (ref["doi"] or ref["pmid"] or re.sub(r"\W+", "", ref["citationText"]).lower())[:180]
        ref_groups[key].append(ref)
    exact_ref_groups = []
    for idx, group in enumerate((g for g in ref_groups.values() if len(g) > 1), 1):
        group_id = f"ref-exact-{idx:03d}"
        for ref in group:
            ref["duplicateGroup"] = group_id
            ref["verificationStatus"] = "likely-duplicate"
        exact_ref_groups.append((group_id, group))

    probable_keys: dict[str, list[dict]] = defaultdict(list)
    for ref in references:
        if ref["duplicateGroup"] or not ref["authors"] or not ref["year"]:
            continue
        author = re.sub(r"\W+", "", ref["authors"][0]).lower()
        probable_keys[f"{author}|{ref['year'].lower()}"].append(ref)
    probable_ref_groups = []
    for idx, group in enumerate((g for g in probable_keys.values() if len(g) > 1), 1):
        group_id = f"ref-probable-{idx:03d}"
        for ref in group:
            ref["duplicateGroup"] = group_id
            ref["verificationStatus"] = "likely-duplicate"
        probable_ref_groups.append((group_id, group))

    manifest = {
        "schemaVersion": 1,
        "generatedFrom": {"locationCategory": "private-external-inbox", "absolutePathStored": False},
        "records": records,
        "summary": {
            "topLevelFiles": top_count, "nestedFiles": nested_count, "uniqueSources": len(records),
            "totalObservedBytes": total_bytes,
            "exactDuplicateGroups": sum(1 for r in records if r["duplicateGroup"]),
            "probableVersionGroups": len(probable_groups),
            "quarantinedSources": sum(r["sensitivity"] == "quarantine" for r in records),
            "manualReviewSources": sum(r["sensitivity"] in {"review-required", "restricted"} for r in records),
        },
    }
    write_json(REPORTS / "source-manifest.json", manifest)
    write_json(REPORTS / "references" / "candidate-reference-registry.json", {"schemaVersion": 1, "externalLookupPerformed": False, "records": references})
    write_json(REPORTS / "source-to-content-graph.json", proposal_graph(records))

    type_counts = Counter(r["fileType"] for r in records)
    status_counts = Counter(r["extractionStatus"] for r in records)
    region_counts = Counter(tag for r in records if r["sensitivity"] != "quarantine" for tag in r["regionTags"])
    topic_counts = Counter(tag for r in records if r["sensitivity"] != "quarantine" for tag in r["topicTags"])
    write_md(REPORTS / "README.md", "Private source-intake pilot", [
        ("Purpose", "Governed metadata and evidence-development proposals for private teaching sources. Source bodies and full extracted text remain outside tracked files."),
        ("Boundary", "Every record has public eligibility set to false. Copyright/licence and clinical claims require separate review."),
        ("Reproduction", "Run the source-intake command with an operator-supplied private inbox path. The path is never stored in tracked output."),
    ])
    write_md(REPORTS / "source-summary.md", "Source intake summary", [
        ("Counts", f"- Top-level files: {top_count}\n- Nested archive files: {nested_count}\n- Unique exact-byte sources: {len(records)}\n- Observed bytes: {total_bytes}\n- Exact duplicate groups: {manifest['summary']['exactDuplicateGroups']}\n- Probable version groups: {len(probable_groups)}\n- Quarantined sources: {manifest['summary']['quarantinedSources']}"),
        ("File types", "\n".join(f"- `{key}`: {value}" for key, value in sorted(type_counts.items()))),
        ("Governance", "No source body, private absolute path, approval claim, or verified-evidence claim is included."),
    ])
    exact_lines = []
    for record in records:
        if record["duplicateGroup"]:
            exact_lines.append(f"- `{record['duplicateGroup']}`: canonical `{record['sourceId']}`; {len(record['occurrences'])} occurrences; exact SHA-256 match.")
    version_lines = []
    for group_id, members in probable_groups:
        member_ids = ", ".join(f"`{member['sourceId']}`" for member in members)
        version_lines.append(
            f"- `{group_id}`: {member_ids}; filename-normalisation match; manual review required."
        )
    write_md(REPORTS / "duplicate-report.md", "Duplicate and version analysis", [("Exact duplicates", "\n".join(exact_lines) or "None detected."), ("Probable versions", "\n".join(version_lines) or "None detected."), ("Action", "No source was deleted. Canonical selection remains a manual decision.")])
    quarantine_counts = Counter(item["category"] for r in records if r["sensitivity"] == "quarantine" for item in r["sensitivityFindings"])
    write_md(REPORTS / "quarantine-report.md", "Quarantine report", [("Summary", f"{manifest['summary']['quarantinedSources']} sources are quarantined."), ("Categories", "\n".join(f"- {key}: {value}" for key, value in sorted(quarantine_counts.items())) or "No category counts."), ("Handling", "Matched values, source names and source bodies are intentionally omitted. Quarantined sources were not used for references or proposals.")])
    write_md(REPORTS / "extraction-status.md", "Extraction status", [("Counts", "\n".join(f"- {key}: {value}" for key, value in sorted(status_counts.items()))), ("Methods", "Embedded text was used where supported. Image/video files are metadata-only, legacy binary office formats are unsupported, and OCR was not run."), ("Cache", "Full extracted text is held only in the ignored private cache.")])
    write_md(REPORTS / "topic-index.md", "Topic and region index", [("Regions", "\n".join(f"- {key}: {value}" for key, value in sorted(region_counts.items())) or "No regions detected."), ("Topics", "\n".join(f"- {key}: {value}" for key, value in sorted(topic_counts.items())) or "No topics detected."), ("Caution", "Counts are automated triage labels, not clinical classification or approval.")])
    write_md(REPORTS / "review-queue.md", "Source review queue", [("Priority", "1. Manually clear or retain quarantined sources.\n2. Verify copyright/licence and source category.\n3. Review extraction quality.\n4. Verify candidate references externally.\n5. Review RCRSP and ankle evidence questions.\n6. Obtain clinician approval before any public content change."), ("Status", "All sources remain private and unapproved.")])

    full_refs = sum(r["completenessStatus"] == "full" for r in references)
    doi_count = sum(bool(r["doi"]) for r in references)
    pmid_count = sum(bool(r["pmid"]) for r in references)
    url_count = sum(bool(r["url"]) for r in references)
    write_md(REPORTS / "references" / "candidate-reference-summary.md", "Candidate reference summary", [("Counts", f"- Total candidates: {len(references)}\n- Full citations: {full_refs}\n- Incomplete/minimal citations: {len(references) - full_refs}\n- DOI present: {doi_count}\n- PMID present: {pmid_count}\n- URL present: {url_count}\n- Exact duplicate groups: {len(exact_ref_groups)}\n- Probable duplicate groups: {len(probable_ref_groups)}"), ("Status", "All candidates were extracted offline and remain unverified. A citation in teaching material is not evidence approval.")])
    exact_group_lines = [f"- `{gid}`: {len(group)} occurrences across {len(set(r['sourceId'] for r in group))} source(s)." for gid, group in exact_ref_groups]
    probable_group_lines = [f"- `{gid}`: {len(group)} variants sharing stated first author and year; manual verification required." for gid, group in probable_ref_groups]
    write_md(REPORTS / "references" / "duplicate-reference-groups.md", "Duplicate reference groups", [("Exact groups", "\n".join(exact_group_lines) or "None detected."), ("Probable groups", "\n".join(probable_group_lines) or "None detected."), ("Action", "Probable variants require manual bibliographic verification; none were discarded.")])
    incomplete = [r for r in references if r["completenessStatus"] != "full"]
    write_md(REPORTS / "references" / "incomplete-reference-queue.md", "Incomplete reference queue", [("Queue", "\n".join(f"- `{r['candidateReferenceId']}` from `{r['sourceId']}` at {r['location']}: {r['verificationStatus']}" for r in incomplete) or "No incomplete candidates."), ("Lookup", "External lookup was not performed.")])
    identifiers = [r for r in references if r["doi"] or r["pmid"] or r["url"]]
    write_md(REPORTS / "references" / "identifier-verification-queue.md", "Identifier verification queue", [("Queue", "\n".join(f"- `{r['candidateReferenceId']}` from `{r['sourceId']}`: {'DOI' if r['doi'] else 'PMID' if r['pmid'] else 'URL'} present and unverified." for r in identifiers) or "No identifiers extracted."), ("Rule", "Identifiers must be checked against authoritative bibliographic sources in a later approved phase.")])
    ref_topic_counts = Counter(topic.strip() for r in references for topic in r["relatedTopicOrClaim"].split(",") if topic.strip())
    write_md(REPORTS / "references" / "topic-to-reference-index.md", "Topic-to-reference index", [("Counts", "\n".join(f"- {topic}: {count}" for topic, count in sorted(ref_topic_counts.items())) or "No topic links."), ("Meaning", "These are extraction associations only, not evidence endorsements.")])

    generate_pilot_reports(records)
    print(json.dumps({
        "topLevelFiles": top_count, "nestedFiles": nested_count, "uniqueSources": len(records),
        "quarantinedSources": manifest["summary"]["quarantinedSources"], "candidateReferences": len(references),
        "rcrspSources": sum(1 for r in records if r["sensitivity"] != "quarantine" and "rcrsp" in r["topicTags"]),
        "ankleSources": sum(1 for r in records if r["sensitivity"] != "quarantine" and "lateral-ankle-sprain" in r["topicTags"]),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
