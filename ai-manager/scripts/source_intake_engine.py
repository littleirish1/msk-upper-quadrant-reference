"""Deterministic, private source-intake engine.

Source bytes and extracted text stay in the ignored private cache. Tracked
reports contain only governed metadata, short unverified citation candidates,
and blocked proposal records.
"""

from __future__ import annotations

import hashlib
import html
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import unicodedata
import zipfile
from collections import Counter, defaultdict
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path, PurePosixPath
from typing import Callable, Iterable
from urllib.parse import urlparse

from defusedxml import ElementTree as SafeET
import defusedxml
import pypdf
from pypdf import PdfReader

from source_intake_policy import credential_rule_counts, load_policy, load_governed_names, normalize_archive_member, sanitize_tracked_line, scan_sensitive


ROOT = Path(__file__).resolve().parents[2]
REPORTS = ROOT / "ai-manager" / "reports" / "source-intake-pilot"
CACHE_ROOT = ROOT / "ai-manager" / "private-cache" / "source-intake-pilot"
POLICY = load_policy()
LIMITS = POLICY["archiveLimits"]
DOC_LIMITS = POLICY["documentLimits"]
EXTRACTOR_VERSION = "2.0.0"

SUPPORTED = {".pdf", ".pptx", ".docx", ".xlsx", ".txt", ".md", ".html", ".htm"}
METADATA_ONLY = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".mov", ".avi", ".zip"}
QUARANTINE_FILENAME = re.compile(
    r"(?:portfolio|reflective|reflection|placement|student|feedback|mark(?:s|ing)?|answer(?:s| key)?|"
    r"exam(?:ination)?|assessment submission|cv\b|curriculum vitae|appraisal|personal statement|patient record)", re.I,
)
RESTRICTED_FILENAME = re.compile(r"(?:case notes?|clinical record|handover|attendance|register|results?)", re.I)
DOI_RE = re.compile(r"\b10\.\d{4,9}/[-._;()/:A-Z0-9]+", re.I)
PMID_RE = re.compile(r"\bPMID\s*[:#]?\s*(\d{6,9})\b", re.I)
URL_RE = re.compile(r"https?://[^\s<>\]\)\"']+", re.I)
AUTHOR_YEAR_RE = re.compile(r"\b([A-Z][A-Za-z'\u2019-]+(?:\s+(?:et al\.?|&\s+[A-Z][A-Za-z'\u2019-]+))?)\s*[,\(]\s*((?:19|20)\d{2}[a-z]?)\)?")
YEAR_RE = re.compile(r"\b((?:19|20)\d{2}[a-z]?)\b", re.I)

REGION_TERMS = {
    "cervical": ["cervical", "neck"], "thoracic": ["thoracic"],
    "shoulder": ["shoulder", "rotator cuff", "rcrsp", "subacromial"],
    "elbow": ["elbow", "epicondyl"], "wrist-hand": ["wrist", "hand", "carpal", "scaphoid"],
    "headache": ["headache", "migraine"], "neurology": ["neurolog", "stroke", "cranial", "spinal cord"],
    "anatomy": ["anatom", "nerve", "muscle", "ligament"], "lumbar": ["lumbar", "low back"],
    "hip": [" hip ", "groin"], "knee": ["knee", "patell"],
    "ankle-foot": ["ankle", "foot", "achilles", "plantar"],
}
TOPIC_TERMS = {
    "rcrsp": ["rcrsp", "rotator cuff related", "rotator cuff-related", "subacromial", "rotator cuff tendinopathy"],
    "rotator-cuff-tear": ["rotator cuff tear"], "shoulder-differential": ["shoulder differential", "differential diagnosis"],
    "exercise-rehabilitation": ["exercise", "rehab", "loading"], "prognosis": ["prognosis", "recovery", "natural history"],
    "imaging": ["imaging", "ultrasound", "mri", "x-ray", "radiograph"],
    "patient-communication": ["patient information", "communication", "reassurance"],
    "special-tests": ["special test", "diagnostic test", "test cluster"],
    "outcome-measures": ["outcome measure", "questionnaire", "score"],
    "lateral-ankle-sprain": ["lateral ankle sprain", "ankle sprain"],
    "ankle-ligament-anatomy": ["atfl", "cfl", "anterior talofibular", "calcaneofibular"],
    "fracture-screening": ["ottawa ankle", "fracture", "malleol"], "syndesmosis": ["syndesmosis", "high ankle sprain"],
    "balance-proprioception": ["balance", "proprioception", "neuromuscular"],
    "return-to-sport": ["return to sport", "return-to-sport", "return to running"],
    "recurrence-prevention": ["recurrence", "prevention"], "bracing-taping": ["brace", "bracing", "taping", "strapping"],
    "guideline": ["guideline", "clinical practice guideline", "nice"],
    "paper": ["doi", "journal", "randomised", "systematic review", "meta-analysis"],
    "osce": ["osce", "station", "candidate instructions"],
}

EXPECTED_FILES = sorted([
    "README.md", "duplicate-report.md", "extraction-status.md", "quarantine-report.md", "review-queue.md",
    "run-manifest.json", "source-manifest.json", "source-summary.md", "source-to-content-graph.json", "topic-index.md",
    "references/candidate-reference-registry.json", "references/candidate-reference-summary.md",
    "references/duplicate-reference-groups.md", "references/incomplete-reference-queue.md",
    "references/identifier-verification-queue.md", "references/topic-to-reference-index.md",
    "rcrsp/source-set.md", "rcrsp/teaching-content-map.md", "rcrsp/claims-requiring-verification.md",
    "rcrsp/evidence-gaps.md", "rcrsp/proposed-content-links.md", "rcrsp/guided-case-conversion-brief.md",
    "rcrsp/evidence-search-questions.md", "rcrsp/clinician-review-checklist.md",
    "lateral-ankle-sprain/source-set.md", "lateral-ankle-sprain/historical-leaflet-content-map.md",
    "lateral-ankle-sprain/claims-requiring-verification.md", "lateral-ankle-sprain/evidence-gaps.md",
    "lateral-ankle-sprain/proposed-condition-brief.md", "lateral-ankle-sprain/proposed-guided-case-brief.md",
    "lateral-ankle-sprain/proposed-patient-information-update.md",
    "lateral-ankle-sprain/evidence-search-questions.md", "lateral-ankle-sprain/clinician-review-checklist.md",
])


@dataclass
class Occurrence:
    logical_path: str
    filename: str
    data: bytes
    date_metadata: dict | None = None
    container_source_id: str | None = None


def digest(data: bytes, hash_provider: Callable[[bytes], str] | None = None) -> str:
    return (hash_provider or (lambda value: hashlib.sha256(value).hexdigest()))(data)


def display_id(full_digest: str) -> str:
    return f"src-{full_digest[:12]}"


def group_occurrences(items: list[Occurrence], hash_provider: Callable[[bytes], str] | None = None) -> dict[str, list[Occurrence]]:
    groups: dict[str, list[Occurrence]] = defaultdict(list)
    prefixes: dict[str, str] = {}
    for item in items:
        full = digest(item.data, hash_provider)
        short = display_id(full)
        if short in prefixes and prefixes[short] != full:
            raise ValueError(f"source display-ID prefix collision: {short}")
        prefixes[short] = full
        groups[full].append(item)
    return dict(groups)


def _xml(data: bytes):
    if len(data) > DOC_LIMITS["maximumXmlPartBytes"]:
        raise ValueError("xml-part-size-limit")
    return SafeET.fromstring(data)


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _paragraphs(data: bytes) -> list[str]:
    root = _xml(data)
    values = []
    for node in root.iter():
        if _local_name(node.tag) in {"p", "si", "row"}:
            text = " ".join((part or "").strip() for part in node.itertext() if (part or "").strip())
            if text:
                values.append(text)
    if not values:
        text = " ".join((part or "").strip() for part in root.itertext() if (part or "").strip())
        if text:
            values.append(text)
    return values


def _read_part(archive: zipfile.ZipFile, name: str) -> bytes:
    info = archive.getinfo(name)
    if info.file_size > DOC_LIMITS["maximumXmlPartBytes"]:
        raise ValueError("xml-part-size-limit")
    return archive.read(info)


def _relationship_map(archive: zipfile.ZipFile, owner_part: str) -> dict[str, dict]:
    owner = PurePosixPath(owner_part)
    rel_name = str(owner.parent / "_rels" / f"{owner.name}.rels")
    if rel_name not in archive.namelist():
        return {}
    root = _xml(_read_part(archive, rel_name))
    return {node.attrib.get("Id", ""): node.attrib for node in root if node.attrib.get("Id")}


def _resolve_part(owner_part: str, target: str) -> str:
    combined = PurePosixPath(owner_part).parent.joinpath(target)
    parts = []
    for part in combined.parts:
        if part == "..":
            if parts:
                parts.pop()
        elif part not in {".", ""}:
            parts.append(part)
    return "/".join(parts)


def extract_pptx(data: bytes) -> tuple[list[dict], dict]:
    units, warnings = [], Counter()
    with zipfile.ZipFile(BytesIO(data)) as archive:
        names = set(archive.namelist())
        presentation = "ppt/presentation.xml"
        rels = _relationship_map(archive, presentation)
        if presentation not in names:
            raise ValueError("pptx-presentation-missing")
        root = _xml(_read_part(archive, presentation))
        slide_rel_ids = [node.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id") for node in root.iter() if node.tag.endswith("}sldId")]
        for display_number, rel_id in enumerate(slide_rel_ids, 1):
            relation = rels.get(rel_id or "")
            if not relation:
                warnings["slide-relationship-missing"] += 1
                continue
            slide_part = _resolve_part(presentation, relation["Target"])
            if slide_part not in names:
                warnings["slide-part-missing"] += 1
                continue
            slide_rels = _relationship_map(archive, slide_part)
            notes, links = [], []
            for relation_value in slide_rels.values():
                rel_type = relation_value.get("Type", "")
                if relation_value.get("TargetMode") == "External":
                    links.append(relation_value.get("Target", ""))
                elif rel_type.endswith("/notesSlide"):
                    note_part = _resolve_part(slide_part, relation_value["Target"])
                    if note_part in names:
                        notes.extend(_paragraphs(_read_part(archive, note_part)))
                    else:
                        warnings["notes-part-missing"] += 1
            paragraphs = _paragraphs(_read_part(archive, slide_part))
            units.append({"number": display_number, "kind": "slide", "part": slide_part, "paragraphs": paragraphs, "text": "\n".join(paragraphs), "notes": "\n".join(notes), "links": sorted(set(filter(None, links)))})
        images = sum(name.startswith("ppt/media/") for name in names)
    return units, {"method": "pptx-openxml-relationships", "tables": 0, "images": images, "warnings": dict(warnings)}


def extract_docx(data: bytes) -> tuple[list[dict], dict]:
    paragraphs, links, warnings = [], [], Counter()
    with zipfile.ZipFile(BytesIO(data)) as archive:
        names = set(archive.namelist())
        for part in ["word/document.xml", "word/footnotes.xml", "word/endnotes.xml"]:
            if part in names:
                try:
                    paragraphs.extend(_paragraphs(_read_part(archive, part)))
                except (ValueError, SafeET.ParseError):
                    warnings["xml-part-failed"] += 1
        for rel in _relationship_map(archive, "word/document.xml").values():
            if rel.get("TargetMode") == "External":
                links.append(rel.get("Target", ""))
        images = sum(name.startswith("word/media/") for name in names)
    return [{"number": 1, "kind": "document", "paragraphs": paragraphs, "text": "\n".join(paragraphs), "links": sorted(set(filter(None, links)))}], {"method": "docx-openxml", "tables": 0, "images": images, "warnings": dict(warnings)}


def _xlsx_shared_strings(data: bytes) -> list[str]:
    root = _xml(data)
    return [
        "".join(node.text or "" for node in item.iter() if _local_name(node.tag) == "t")
        for item in root.iter()
        if _local_name(item.tag) == "si"
    ]


def _xlsx_inline_string(cell) -> str:
    return "".join(node.text or "" for node in cell.iter() if _local_name(node.tag) == "t")


def extract_xlsx(data: bytes) -> tuple[list[dict], dict]:
    units, warnings = [], Counter()
    with zipfile.ZipFile(BytesIO(data)) as archive:
        names = set(archive.namelist())
        shared: list[str] = []
        if "xl/sharedStrings.xml" in names:
            shared = _xlsx_shared_strings(_read_part(archive, "xl/sharedStrings.xml"))
        workbook = "xl/workbook.xml"
        rels = _relationship_map(archive, workbook)
        if workbook not in names:
            raise ValueError("xlsx-workbook-missing")
        root = _xml(_read_part(archive, workbook))
        sheets = [node for node in root.iter() if _local_name(node.tag) == "sheet"]
        for number, sheet in enumerate(sheets, 1):
            rel_id = sheet.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
            relation = rels.get(rel_id or "")
            if not relation:
                warnings["sheet-relationship-missing"] += 1
                continue
            part = _resolve_part(workbook, relation["Target"])
            if part not in names:
                warnings["sheet-part-missing"] += 1
                continue
            sheet_root = _xml(_read_part(archive, part))
            rows = []
            for row in (node for node in sheet_root.iter() if _local_name(node.tag) == "row"):
                cells = []
                for cell in (node for node in row if _local_name(node.tag) == "c"):
                    ref, cell_type = cell.attrib.get("r", "?"), cell.attrib.get("t")
                    raw = next((node.text or "" for node in cell.iter() if _local_name(node.tag) == "v"), "")
                    inline = _xlsx_inline_string(cell)
                    resolved = False
                    if cell_type == "s":
                        try:
                            value = shared[int(raw)]
                            resolved = True
                        except (ValueError, IndexError):
                            warnings["shared-string-index-invalid"] += 1; value = ""
                    elif cell_type in {"inlineStr", "str"}: value = inline or raw; resolved = True
                    elif cell_type in {None, "n", "b"}: value = raw
                    else:
                        warnings["unsupported-cell-type"] += 1; value = raw
                    if any(_local_name(node.tag) == "f" for node in cell): warnings["formula-present-uncomputed"] += 1
                    if value or resolved: cells.append(f"{ref}={value}")
                if cells: rows.append(" | ".join(cells))
            units.append({"number": number, "kind": "sheet", "sheetName": sheet.attrib.get("name", f"Sheet {number}"), "paragraphs": rows, "text": "\n".join(rows), "links": []})
    return units, {"method": "xlsx-openxml-indexed-shared-strings", "tables": len(units), "images": 0, "warnings": dict(warnings)}


def extract_pdf(data: bytes) -> tuple[list[dict], dict]:
    if len(data) > DOC_LIMITS["maximumPdfBytes"]: raise ValueError("pdf-size-limit")
    reader = PdfReader(BytesIO(data), strict=False)
    if len(reader.pages) > DOC_LIMITS["maximumPdfPages"]: raise ValueError("pdf-page-limit")
    units, images, warnings = [], 0, Counter()
    for number, page in enumerate(reader.pages, 1):
        try: text = page.extract_text() or ""
        except Exception: warnings["pdf-page-extraction-failed"] += 1; text = ""
        links = []
        try:
            for annotation in page.get("/Annots") or []:
                action = annotation.get_object().get("/A")
                if action and action.get("/URI"): links.append(str(action.get("/URI")))
        except Exception: warnings["pdf-link-extraction-failed"] += 1
        try: images += len(page.images)
        except Exception: warnings["pdf-image-count-failed"] += 1
        units.append({"number": number, "kind": "page", "paragraphs": text.splitlines(), "text": text, "links": links})
    return units, {"method": "pypdf-bounded-embedded-text", "tables": 0, "images": images, "warnings": dict(warnings)}


def extract_text(data: bytes, extension: str) -> tuple[list[dict], dict]:
    if extension == ".pdf": return extract_pdf(data)
    if extension == ".pptx": return extract_pptx(data)
    if extension == ".docx": return extract_docx(data)
    if extension == ".xlsx": return extract_xlsx(data)
    if extension in {".txt", ".md"}:
        text = data.decode("utf-8", errors="replace")
        return [{"number": 1, "kind": "document", "paragraphs": text.splitlines(), "text": text, "links": URL_RE.findall(text)}], {"method": "plain-text", "tables": 0, "images": 0, "warnings": {}}
    if extension in {".html", ".htm"}:
        raw = data.decode("utf-8", errors="replace")
        links = re.findall(r"href\s*=\s*[\"'](https?://[^\"']+)", raw, re.I)
        visible = re.sub(r"<script\b[^>]*>.*?</script>|<style\b[^>]*>.*?</style>", " ", raw, flags=re.I | re.S)
        visible = html.unescape(re.sub(r"<[^>]+>", "\n", visible))
        paragraphs = [re.sub(r"\s+", " ", line).strip() for line in visible.splitlines() if line.strip()]
        return [{"number": 1, "kind": "document", "paragraphs": paragraphs, "text": "\n".join(paragraphs), "links": links}], {"method": "html-embedded-text", "tables": 0, "images": len(re.findall(r"<img\b", raw, re.I)), "warnings": {}}
    return [], {"method": "metadata-only", "tables": 0, "images": 0, "warnings": {}}


def safe_archive_occurrences(data: bytes, container_id: str) -> tuple[list[Occurrence], list[dict]]:
    output, warnings = [], Counter()
    cumulative = 0
    try:
        archive = zipfile.ZipFile(BytesIO(data))
    except zipfile.BadZipFile:
        return [], [{"category": "archive", "warningCode": "corrupt-archive", "count": 1}]
    with archive:
        members = archive.infolist()
        if len(members) > LIMITS["maximumMemberCount"]:
            return [], [{"category": "archive", "warningCode": "member-count-limit", "count": 1}]
        for info in members:
            if info.is_dir() or info.filename.startswith("__MACOSX/"): continue
            normalized, path_warning = normalize_archive_member(info.filename, LIMITS["maximumFilenameLength"])
            if path_warning:
                warnings[path_warning] += 1; continue
            mode = info.external_attr >> 16
            if stat.S_ISLNK(mode): warnings["symlink-member"] += 1; continue
            if info.flag_bits & 0x1: warnings["encrypted-member"] += 1; continue
            if info.compress_size > LIMITS["maximumCompressedMemberBytes"]: warnings["compressed-size-limit"] += 1; continue
            if info.file_size > LIMITS["maximumExpandedMemberBytes"]: warnings["expanded-size-limit"] += 1; continue
            ratio = info.file_size / max(info.compress_size, 1)
            if ratio > LIMITS["maximumCompressionRatio"]: warnings["compression-ratio-limit"] += 1; continue
            if cumulative + info.file_size > LIMITS["maximumCumulativeExpandedBytes"]: warnings["cumulative-size-limit"] += 1; continue
            if PurePosixPath(normalized).suffix.lower() == ".zip" and not LIMITS["inspectNestedArchives"]:
                warnings["nested-archive-not-inspected"] += 1
            try:
                chunks, consumed = [], 0
                with archive.open(info) as stream:
                    while True:
                        chunk = stream.read(min(1024 * 1024, LIMITS["maximumExpandedMemberBytes"] + 1 - consumed))
                        if not chunk: break
                        chunks.append(chunk); consumed += len(chunk)
                        if consumed > LIMITS["maximumExpandedMemberBytes"]: raise ValueError("expanded-size-limit")
                member_data = b"".join(chunks)
            except (RuntimeError, OSError, EOFError, zipfile.BadZipFile, ValueError) as error:
                code = str(error) if str(error) in {"expanded-size-limit"} else "member-read-failed"
                warnings[code] += 1; continue
            cumulative += len(member_data)
            full = digest(member_data); sid = display_id(full); ext = PurePosixPath(normalized).suffix.lower() or ".bin"
            output.append(Occurrence(f"archive/{container_id}/{sid}{ext}", PurePosixPath(normalized).name, member_data, {"value": _zip_date(info), "provenance": "zip-entry-unreliable"} if _zip_date(info) else None, container_id))
    return output, [{"category": "archive-member", "warningCode": code, "count": count} for code, count in sorted(warnings.items())]


def _zip_date(info: zipfile.ZipInfo) -> str | None:
    try:
        year, month, day = info.date_time[:3]
        if not (1980 <= year <= 2100 and 1 <= month <= 12 and 1 <= day <= 31): return None
        return f"{year:04d}-{month:02d}-{day:02d}"
    except (TypeError, ValueError): return None


def source_occurrences(inbox: Path) -> tuple[list[Occurrence], int, int, int, list[dict]]:
    root = inbox.resolve(strict=True)
    occurrences, warnings = [], []
    top_count = nested_count = total_bytes = 0
    for current, dirs, files in os.walk(root, followlinks=False):
        current_path = Path(current)
        safe_dirs = []
        for name in sorted(dirs):
            path = current_path / name
            if path.is_symlink() or _is_reparse(path): continue
            try: path.resolve().relative_to(root)
            except ValueError: continue
            safe_dirs.append(name)
        dirs[:] = safe_dirs
        for name in sorted(files):
            path = current_path / name
            if path.is_symlink() or _is_reparse(path): continue
            try: relative = path.resolve(strict=True).relative_to(root).as_posix()
            except (OSError, ValueError): continue
            if len(name) > DOC_LIMITS["maximumFilenameLength"]: continue
            data = path.read_bytes(); total_bytes += len(data); top_count += 1
            full = digest(data); sid = display_id(full); extension = path.suffix.lower() or ".bin"
            occurrences.append(Occurrence(f"inbox/{sid}{extension}", path.name, data))
            if extension == ".zip":
                nested, archive_warnings = safe_archive_occurrences(data, sid)
                nested_count += len(nested); total_bytes += sum(len(item.data) for item in nested)
                occurrences.extend(nested)
                warnings.extend({"containerSourceId": sid, **item} for item in archive_warnings)
    return occurrences, top_count, nested_count, total_bytes, warnings


def _is_reparse(path: Path) -> bool:
    try:
        attrs = path.stat(follow_symlinks=False).st_file_attributes
        return bool(attrs & stat.FILE_ATTRIBUTE_REPARSE_POINT)
    except (AttributeError, OSError): return False


def tags_for(value: str, mapping: dict[str, list[str]]) -> list[str]:
    lower = f" {value.lower()} "
    return sorted(key for key, terms in mapping.items() if any(term in lower for term in terms))


def classify_type(filename: str, extension: str, text: str) -> str:
    lower = f"{filename} {text[:12000]}".lower()
    if "ankle" in lower and ("patient information" in lower or "leaflet" in lower): return "local-patient-leaflet"
    if "guideline" in lower or "clinical practice guideline" in lower: return "clinical-guideline"
    if QUARANTINE_FILENAME.search(filename): return "portfolio-reflective-material" if re.search(r"portfolio|reflect", filename, re.I) else "administrative"
    if "osce" in lower or "candidate instruction" in lower: return "osce-material"
    if "anatom" in lower: return "anatomy-resource"
    if "outcome measure" in lower or "questionnaire" in lower: return "outcome-measure"
    if extension == ".pdf" and ("journal" in lower or "doi" in lower or "systematic review" in lower): return "pdf-paper"
    return {".pptx": "teaching-presentation", ".ppt": "teaching-presentation", ".docx": "word-document", ".doc": "word-document", ".xlsx": "spreadsheet", ".xls": "spreadsheet", ".html": "html", ".htm": "html", ".txt": "notes", ".md": "notes", ".jpg": "image", ".jpeg": "image", ".png": "image", ".gif": "image", ".webp": "image", ".mp4": "video", ".mov": "video", ".avi": "video", ".zip": "archive"}.get(extension, "unknown")


def compact_headings(units: list[dict], names: list[str]) -> tuple[list[str], int]:
    headings, suppressed = [], 0
    for unit in units:
        for raw in unit.get("paragraphs", []):
            line = re.sub(r"\s+", " ", raw).strip(" -:\t")
            if not (3 <= len(line) <= 160 and (line.isupper() or len(line.split()) <= 10)): continue
            safe, categories = sanitize_tracked_line(line, names, maximum_length=160)
            if categories or not safe: suppressed += 1; continue
            if safe not in headings: headings.append(safe)
            if len(headings) == 30: return headings, suppressed
    return headings, suppressed


def classify_citation(line: str, context: str, doi: str | None, pmid: str | None, url: str | None, authors: list[str], year: str | None) -> str:
    lower = line.lower()
    if re.search(r"(?:contact|email|telephone|phone|correspondence)", lower): return "contact-or-administrative-link"
    if url and re.search(r"(?:youtube|youtu\.be|vimeo|menti|poll|forms?|survey)", lower): return "media-or-engagement-link"
    if url and re.search(r"(?:licen[cs]e|copyright|attribution|creativecommons|creativecommons)", lower): return "licence-or-attribution-link"
    bibliographic_signals = sum(bool(value) for value in [doi or pmid, authors, year, re.search(r"\b(?:journal|vol\.?|volume|issue|pp?\.?\s*\d|press|publisher)\b", line, re.I), re.search(r"[.;:]\s+[A-Z][^.]{8,}[.;]", line)])
    if (doi or pmid) and len(line.strip()) <= 80: return "identifier-only"
    if context == "reference-list" and bibliographic_signals >= 3: return "full-looking-unverified"
    if authors and year and bibliographic_signals <= 2: return "author-year-only"
    if bibliographic_signals >= 2: return "partial-bibliographic"
    if url: return "generic-web-link"
    return "unable-to-classify"


def reference_candidates(source: dict, units: list[dict], names: list[str]) -> tuple[list[dict], int]:
    candidates, seen, suppressed = [], set(), 0
    topics = source["topicTags"] or source["regionTags"] or ["general"]
    limit = POLICY["citationExcerptLimit"]
    for unit in units:
        number = unit.get("number")
        for value, label in [(unit.get("text", ""), "text"), (unit.get("notes", ""), "speaker notes")]:
            if not value: continue
            paragraphs = [re.sub(r"\s+", " ", item).strip() for item in value.splitlines() if item.strip()]
            ref_section = any(re.search(r"\b(?:references|bibliography|further reading)\b", item, re.I) for item in paragraphs)
            for line in paragraphs:
                if scan_sensitive(line, names):
                    suppressed += 1
                    continue
                dois = DOI_RE.findall(line); pmids = PMID_RE.findall(line); urls = URL_RE.findall(line); author_hits = AUTHOR_YEAR_RE.findall(line)
                if not (dois or pmids or urls or author_hits or re.search(r"\b(?:guideline|journal|et al\.|vol\.?|pp?\.)\b", line, re.I)): continue
                safe, sensitive = sanitize_tracked_line(line, names, maximum_length=limit)
                if sensitive or not safe: suppressed += 1; continue
                citation = safe[:limit]
                key = re.sub(r"\W+", "", citation).lower()
                if not key or key in seen: continue
                seen.add(key)
                authors = [author_hits[0][0]] if author_hits else []
                year = author_hits[0][1] if author_hits else (YEAR_RE.search(citation).group(1) if YEAR_RE.search(citation) else None)
                doi = dois[0].rstrip(".,;") if dois else None; pmid = pmids[0] if pmids else None
                url = urls[0].rstrip(".,;") if urls else None
                if url and (not urlparse(url).netloc or scan_sensitive(url, names)): suppressed += 1; continue
                context = "further-reading" if re.search(r"further reading", value, re.I) else "reference-list" if ref_section else "hyperlink" if urls and not authors else "in-text"
                classification = classify_citation(citation, context, doi, pmid, url, authors, year)
                if classification == "contact-or-administrative-link": suppressed += 1; continue
                identity = hashlib.sha256(f"{source['checksum']}|{number}|{citation}".encode()).hexdigest()[:16]
                candidates.append({"candidateReferenceId": f"ref-{identity}", "sourceId": source["sourceId"], "sourceChecksum": source["checksum"], "pageOrSlideNumber": number, "location": f"{unit.get('kind', 'document')} {number} {label}", "citationText": citation, "citationTextHash": f"sha256:{hashlib.sha256(line.encode()).hexdigest()}", "authors": authors, "year": year, "title": None, "journalOrPublisher": None, "volumeIssuePages": None, "doi": doi, "pmid": pmid, "url": url, "relatedTopicOrClaim": ", ".join(topics), "citationContext": context, "classification": classification, "extractionConfidence": "high" if doi or pmid else "medium" if authors else "low", "verificationStatus": "identifier-present-unverified" if doi or pmid else "extracted-unverified" if classification != "unable-to-classify" else "unable-to-identify", "verificationEvidence": None, "duplicateGroup": None, "notes": "Extracted offline; accuracy, relevance, and evidence status are unverified."})
        for link in unit.get("links", []):
            link = link.strip()
            if not re.match(r"^https?://", link, re.I) or not urlparse(link).netloc or scan_sensitive(link, names): suppressed += 1; continue
            key = re.sub(r"\W+", "", link).lower()
            if key in seen: continue
            seen.add(key)
            classification = classify_citation(link, "hyperlink", None, None, link, [], None)
            if classification == "contact-or-administrative-link": suppressed += 1; continue
            identity = hashlib.sha256(f"{source['checksum']}|{number}|{link}".encode()).hexdigest()[:16]
            candidates.append({"candidateReferenceId": f"ref-{identity}", "sourceId": source["sourceId"], "sourceChecksum": source["checksum"], "pageOrSlideNumber": number, "location": f"{unit.get('kind', 'document')} {number} embedded hyperlink", "citationText": link[:limit], "citationTextHash": f"sha256:{hashlib.sha256(link.encode()).hexdigest()}", "authors": [], "year": None, "title": None, "journalOrPublisher": None, "volumeIssuePages": None, "doi": None, "pmid": None, "url": link, "relatedTopicOrClaim": ", ".join(topics), "citationContext": "hyperlink", "classification": classification, "extractionConfidence": "high", "verificationStatus": "extracted-unverified", "verificationEvidence": None, "duplicateGroup": None, "notes": "Embedded URL extracted offline; destination was not accessed."})
    return candidates, suppressed


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def load_governance() -> tuple[dict[str, dict], dict[str, dict], dict[tuple[str, str], dict]]:
    clear_data = _load_json(ROOT / "ai-manager/config/source-clearance-ledger.json")
    override_data = _load_json(ROOT / "ai-manager/config/source-classification-overrides.json")
    decision_data = _load_json(ROOT / "ai-manager/config/security-false-positive-decisions.json")
    clearances = {entry["checksum"]: entry for entry in clear_data["entries"]}
    overrides = {entry["checksum"]: entry for entry in override_data["entries"]}
    decisions = {(entry["checksum"], entry["detectorRuleId"]): entry for entry in decision_data["entries"]}
    return clearances, overrides, decisions


def credential_stop_required(checksum: str, source_id_value: str, text: str, decisions: dict[tuple[str, str], dict]) -> tuple[bool, dict[str, int]]:
    counts = credential_rule_counts(text)
    for rule_id, count in counts.items():
        decision = decisions.get((checksum, rule_id))
        if not decision:
            return True, counts
        if decision["sourceId"] != source_id_value:
            return True, counts
        if decision["decision"] != "false-positive-confirmed" or decision["decisionScope"] != "credential-stop-override-for-exact-checksum-only":
            return True, counts
    return False, counts


def probable_key(filename: str) -> str:
    stem = Path(filename).stem.lower()
    stem = re.sub(r"\b(?:copy|final|revised|updated|old|new|version|ver|v)\s*\d*\b", "", stem)
    stem = re.sub(r"\b20\d{2}\b|\(\d+\)", "", stem)
    return re.sub(r"[^a-z0-9]+", "", stem)


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=True, sort_keys=False) + "\n", encoding="utf-8", newline="\n")


def write_md(path: Path, title: str, sections: Iterable[tuple[str, str]]) -> None:
    lines = [f"# {title}", ""]
    for heading, body in sections: lines.extend([f"## {heading}", "", body.strip(), ""])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8", newline="\n")


def _source_table(records: list[dict], references: list[dict], topics: set[str]) -> str:
    selected = [r for r in records if set(r["topicTags"]) & topics and r["sensitivity"] != "quarantined"]
    if not selected: return "No eligible matching sources were identified."
    refs_by_source: dict[str, list[dict]] = defaultdict(list)
    for reference in references: refs_by_source[reference["sourceId"]].append(reference)
    rows = ["| Source ID | Location | Teaching topics | Citation candidates | Verification | Overlap/conflict | Proposed targets | Clearance | Clinician review |", "|---|---|---|---|---|---|---|---|---|"]
    for r in selected:
        source_refs = refs_by_source[r["sourceId"]]
        locations = ", ".join(sorted({item["location"] for item in source_refs})[:3]) or "document-level metadata"
        candidate_ids = ", ".join(f"`{item['candidateReferenceId']}`" for item in source_refs[:3]) or "none eligible"
        rows.append(f"| `{r['sourceId']}` | {locations} | {', '.join(sorted(set(r['topicTags']) & topics)) or 'classification pending'} | {candidate_ids} | external evidence verification required | manual comparison required | condition/case/anatomy/learning proposal | {r['sensitivity']} | required |")
    return "\n".join(rows)


def generate_pilot_reports(output: Path, records: list[dict], references: list[dict]) -> None:
    disclaimer = "All teaching statements remain unverified. No item is approved for public clinical use."
    r_topics = {"rcrsp", "rotator-cuff-tear", "shoulder-differential", "exercise-rehabilitation", "prognosis", "imaging", "patient-communication", "special-tests", "outcome-measures"}
    a_topics = {"lateral-ankle-sprain", "ankle-ligament-anatomy", "fracture-screening", "syndesmosis", "exercise-rehabilitation", "balance-proprioception", "return-to-sport", "recurrence-prevention", "bracing-taping"}
    r_table, a_table = _source_table(records, references, r_topics), _source_table(records, references, a_topics)
    rdir, adir = output / "rcrsp", output / "lateral-ankle-sprain"
    write_md(rdir / "source-set.md", "RCRSP source set", [("Governance", disclaimer), ("Eligible private source map", r_table)])
    write_md(rdir / "teaching-content-map.md", "RCRSP teaching content map", [("Evidence map", r_table), ("Interpretation", "Rows are extraction associations, not endorsed claims. Overlap and conflict status remains manual-review-required; visuals remain licence-review-required."), ("Targets", "Condition reference, neutral guided case, anatomy, special tests, outcome measures, quiz, flashcard, OSCE, and patient explanation are proposals only.")])
    write_md(rdir / "claims-requiring-verification.md", "RCRSP claims requiring verification", [("Blocked areas", "- Terminology and classification\n- Diagnostic value of tests and clusters\n- Imaging indications\n- Natural history and prognosis\n- Intervention comparisons\n- Surgical referral indications\n- Communication and outcome-measure interpretation"), ("Status", disclaimer)])
    write_md(rdir / "evidence-gaps.md", "RCRSP evidence gaps", [("Required evidence", "Current guidelines, systematic reviews, diagnostic-accuracy studies, prognostic cohorts, and intervention trials require later external verification."), ("Approval", "Clinician review remains required.")])
    write_md(rdir / "proposed-content-links.md", "RCRSP proposed content links", [("Targets", "Existing condition and neutral case plus anatomy, tests, outcomes, quizzes, flashcards, OSCE and patient-information resources."), ("Publication", "Blocked; public eligibility is false.")])
    steps = ["Initial presentation", "Learner differential", "Justification", "Additional history", "Red flags", "Examination planning", "Examination findings", "Investigation decision", "Management plan", "Patient explanation", "Expert reasoning comparison", "Reflection"]
    rcrsp_ids = [r["sourceId"] for r in records if r["sensitivity"] != "quarantined" and set(r["topicTags"]) & r_topics][:4]
    source_label = ", ".join(f"`{source_id}`" for source_id in rcrsp_ids) or "no eligible source"
    mappings = "\n".join(f"{i}. **{step}** - candidate sources: {source_label}; evidence question: what verified evidence supports this step?; expert answer not authored." for i, step in enumerate(steps, 1))
    write_md(rdir / "guided-case-conversion-brief.md", "RCRSP guided-case conversion brief", [("Existing case", "The existing public case is unchanged."), ("Twelve-step map", mappings), ("Approval", "Every expert answer requires source-specific support and clinician approval.")])
    hierarchy = "Preferred hierarchy: current clinical practice guideline; systematic review/meta-analysis; high-quality randomised trial; prognostic cohort; diagnostic-accuracy study; consensus where stronger evidence is unavailable. No external search was performed."
    write_md(rdir / "evidence-search-questions.md", "RCRSP evidence search questions", [("Questions", "- Preferred terminology and classification?\n- Diagnostic value of tests and clusters?\n- Imaging indications?\n- Natural history and prognosis?\n- Intervention comparisons?\n- Surgical indications?\n- Supported communication?\n- Appropriate outcome measures?"), ("Hierarchy", hierarchy)])
    write_md(rdir / "clinician-review-checklist.md", "RCRSP clinician review checklist", [("Checklist", "- [ ] Verify terminology, differentials and safety\n- [ ] Verify every claim and citation\n- [ ] Review imaging, management and prognosis\n- [ ] Review communication wording\n- [ ] Preserve diagnosis hiding\n- [ ] Record reviewer and decision outside this pilot")])
    write_md(adir / "source-set.md", "Lateral ankle sprain source set", [("Governance", disclaimer), ("Eligible private source map", a_table)])
    write_md(adir / "historical-leaflet-content-map.md", "Historical ankle leaflet content map", [("Classification", "The checksum-governed 2019 local patient-information leaflet is a historical/local-practice source, non-authoritative by itself, and requires current evidence review."), ("Evidence map", a_table), ("Topics", "Acute assessment; fracture screening; early loading; support; exercise; balance; return to sport; recurrence prevention; escalation; patient communication."), ("Verification flags", "POLICE/newer frameworks; ice; compression; medication timing; fixed dosage; healing time; bracing duration; return-to-sport criteria; recurrence prevention; emergency thresholds. No item is declared wrong.")])
    write_md(adir / "claims-requiring-verification.md", "Lateral ankle sprain claims requiring verification", [("Blocked areas", "- Acute assessment and fracture screening\n- Early loading and external support\n- Exercise and balance\n- Return to sport and recurrence prevention\n- Escalation and patient communication"), ("Status", disclaimer)])
    write_md(adir / "evidence-gaps.md", "Lateral ankle sprain evidence gaps", [("Required evidence", "Current decision rules, guidelines, rehabilitation reviews, prognosis evidence and return-to-sport consensus require external verification."), ("Approval", "Clinician review remains required.")])
    write_md(adir / "proposed-condition-brief.md", "Lateral ankle sprain condition brief", [("Status", "Private blocked proposal; no public route."), ("Structure", "Assessment, fracture screening, differentials, early management, loading, rehabilitation, return to activity, recurrence prevention, escalation, limitations and communication.")])
    write_md(adir / "proposed-guided-case-brief.md", "Lateral ankle sprain guided-case brief", [("Status", "Private blocked proposal."), ("Reasoning structure", "Neutral presentation, differential, cannot-miss screening, examination, findings, investigation, management, explanation, expert comparison and reflection."), ("Expert answers", "None authored; source support and clinician approval required.")])
    write_md(adir / "proposed-patient-information-update.md", "Lateral ankle sprain patient-information update proposal", [("Purpose", "Compare the historical local leaflet with current verified evidence before drafting."), ("Copyright", "Do not copy the leaflet into the public repository; replacement wording and assets require review.")])
    write_md(adir / "evidence-search-questions.md", "Lateral ankle sprain evidence search questions", [("Questions", "- Fracture-screening decision rules?\n- Acute loading and support?\n- Exercise and balance interventions?\n- Return-to-sport criteria?\n- Chronic instability and recurrence?\n- Imaging and referral?\n- Current patient information?"), ("Hierarchy", hierarchy)])
    write_md(adir / "clinician-review-checklist.md", "Lateral ankle sprain clinician review checklist", [("Checklist", "- [ ] Verify fracture and syndesmosis screening\n- [ ] Review acute management/loading\n- [ ] Verify exercise/progression\n- [ ] Review return-to-sport and prevention\n- [ ] Review escalation and language\n- [ ] Verify references\n- [ ] Record reviewer and decision outside this pilot")])


def _validate_staging(output: Path) -> None:
    actual = sorted(path.relative_to(output).as_posix() for path in output.rglob("*") if path.is_file())
    if actual != EXPECTED_FILES:
        missing, extra = sorted(set(EXPECTED_FILES) - set(actual)), sorted(set(actual) - set(EXPECTED_FILES))
        raise ValueError(f"report-set-mismatch missing={missing} unexpected={extra}")
    names = load_governed_names()
    for path in output.rglob("*"):
        if not path.is_file(): continue
        data = path.read_bytes()
        if b"\x00" in data: raise ValueError("binary-tracked-output")
        text = data.decode("utf-8", errors="strict")
        values = _json_string_values(json.loads(text)) if path.suffix == ".json" else [text]
        output_findings = []
        for value in values:
            scan_text = re.sub(r"(?:sha256:)?[0-9a-f]{64}|(?:src|ref|run)-[0-9a-f]{12,64}|ref-[a-z0-9-]+", "[machine-id]", value, flags=re.I)
            output_findings.extend(scan_sensitive(scan_text, names))
        if "\ufffd" in text or output_findings:
            categories = sorted({item.category for item in output_findings})
            raise ValueError(f"sensitive-or-invalid-tracked-output:{path.relative_to(output).as_posix()}:{','.join(categories)}")


def _json_string_values(value: object) -> list[str]:
    if isinstance(value, str): return [value]
    if isinstance(value, list): return [item for child in value for item in _json_string_values(child)]
    if isinstance(value, dict): return [item for child in value.values() for item in _json_string_values(child)]
    return []


def _atomic_publish(staging: Path, destination: Path) -> None:
    _restore_inherited_permissions(staging)
    backup = destination.with_name(destination.name + ".previous")
    if backup.exists(): shutil.rmtree(backup)
    if destination.exists(): os.replace(destination, backup)
    try:
        os.replace(staging, destination)
    except Exception:
        if backup.exists() and not destination.exists(): os.replace(backup, destination)
        raise
    if backup.exists(): shutil.rmtree(backup)
    _restore_inherited_permissions(destination)


def _restore_inherited_permissions(directory: Path) -> None:
    if os.name != "nt": return
    result = subprocess.run(["icacls", str(directory), "/inheritance:e", "/T", "/C", "/Q"], capture_output=True, text=True)
    if result.returncode != 0:
        raise OSError("unable to restore inherited permissions on generated reports")


def build_intake(inbox: Path, reports: Path = REPORTS, cache_root: Path = CACHE_ROOT, implementation_commit: str | None = None) -> dict:
    names = load_governed_names()
    occurrences, top_count, nested_count, total_bytes, archive_warnings = source_occurrences(inbox)
    groups = group_occurrences(occurrences)
    source_set_fingerprint = hashlib.sha256("\n".join(sorted(groups)).encode()).hexdigest()
    run_id = f"run-{hashlib.sha256((source_set_fingerprint + EXTRACTOR_VERSION).encode()).hexdigest()[:16]}"
    commit = implementation_commit or _git_head()
    cache = cache_root / run_id
    if cache.exists(): shutil.rmtree(cache)
    cache.mkdir(parents=True, exist_ok=True)
    clearances, overrides, security_decisions = load_governance()
    records, references, fatal = [], [], Counter()
    suppressed_total = excluded_uncleared = 0
    observed_checksums = {f"sha256:{value}" for value in groups}
    for configured in [*clearances, *overrides, *(checksum for checksum, _ in security_decisions)]:
        if configured not in observed_checksums: raise ValueError("orphaned governance entry")
    for full, source_occurs in sorted(groups.items()):
        canonical = sorted(source_occurs, key=lambda item: item.logical_path)[0]
        sid, checksum = display_id(full), f"sha256:{full}"
        extension = Path(canonical.filename).suffix.lower() or ".bin"
        units, meta = [], {"method": "metadata-only", "tables": 0, "images": 0, "warnings": {}}
        support = "supported" if extension in SUPPORTED else "metadata-only" if extension in METADATA_ONLY else "unsupported"
        status = "metadata-only" if support == "metadata-only" else "unsupported"
        filename_quarantine = bool(QUARANTINE_FILENAME.search(canonical.filename))
        filename_restricted = bool(RESTRICTED_FILENAME.search(canonical.filename))
        if support == "supported" and not filename_quarantine:
            try: units, meta = extract_text(canonical.data, extension); status = "extracted"
            except Exception as error:
                meta = {"method": "failed", "tables": 0, "images": 0, "warnings": {str(error).split(':')[0][:80]: 1}}; status = "failed"
        combined = "\n".join([canonical.filename, *(unit.get("text", "") for unit in units), *(unit.get("notes", "") for unit in units), *(link for unit in units for link in unit.get("links", []))])
        findings = scan_sensitive(combined, names)
        finding_counts = Counter(item.category for item in findings)
        should_stop, credential_counts = credential_stop_required(checksum, sid, combined, security_decisions)
        if should_stop and credential_counts: fatal["credential-value"] += 1
        high_risk = any(finding_counts.get(key) for key in ["patient-or-hospital-identifier", "nhs-number", "student-or-candidate-identifier"])
        sensitivity = "quarantined" if filename_quarantine or high_risk else "restricted-pending-clearance" if filename_restricted or findings else "review-required"
        clearance_scopes: list[str] = []
        ledger = clearances.get(checksum)
        if ledger:
            if ledger["sourceId"] != sid: raise ValueError("clearance checksum/source-ID mismatch")
            if sensitivity == "quarantined" and ledger["decision"] == "clear-for-private-evidence-processing": raise ValueError("quarantine clearance is forbidden")
            if ledger["decision"] == "clear-for-private-evidence-processing" and sensitivity == "restricted-pending-clearance":
                sensitivity = "cleared-for-private-evidence-processing"; clearance_scopes = sorted(ledger["clearanceScope"])
        headings, suppressed = compact_headings(units, names); suppressed_total += suppressed
        source_type = classify_type(canonical.filename, extension, combined)
        topic_tags, region_tags = tags_for(combined, TOPIC_TERMS), tags_for(combined, REGION_TERMS)
        override = overrides.get(checksum)
        if override:
            if override["sourceId"] != sid: raise ValueError("override checksum/source-ID mismatch")
            source_type, topic_tags, region_tags = override["sourceType"], sorted(override["topicTags"]), sorted(override["regionTags"])
        record = {"sourceId": sid, "checksum": checksum, "logicalPath": f"private-source/{sid}{extension}", "originalFilename": f"source-{sid}{extension}", "fileType": extension if extension.startswith(".") else "unknown", "byteSize": len(canonical.data), "containerSourceId": canonical.container_source_id, "occurrences": [{"logicalPath": item.logical_path, "containerSourceId": item.container_source_id, "dateMetadata": item.date_metadata} for item in sorted(source_occurs, key=lambda value: value.logical_path)], "sourceType": source_type, "topicTags": topic_tags, "regionTags": region_tags, "duplicateGroup": f"exact-{sid}" if len(source_occurs) > 1 else None, "probableVersionGroup": None, "sensitivity": sensitivity, "sensitivityFindings": [{"category": key, "count": value} for key, value in sorted(finding_counts.items())], "clearanceScopes": clearance_scopes, "extractionSupport": support, "extractionStatus": "quarantined" if sensitivity == "quarantined" else "restricted" if sensitivity == "restricted-pending-clearance" else status, "extractionMetadata": {"method": meta["method"], "pageOrSlideCount": len(units) or None, "extractedCharacterCount": sum(len(unit.get("text", "")) + len(unit.get("notes", "")) for unit in units), "headingsDetected": headings, "referencesSectionDetected": bool(re.search(r"\b(?:references|bibliography|further reading)\b", combined, re.I)), "tablesDetected": int(meta.get("tables", 0)), "imagesDetected": int(meta.get("images", 0)), "confidence": "high" if status == "extracted" else "low" if status == "partial" else "none", "warnings": [{"code": key, "count": value} for key, value in sorted(meta.get("warnings", {}).items())]}, "copyrightOrLicenceStatus": "unknown", "intendedUse": ["private evidence-development triage"], "reviewStatus": "quarantined" if sensitivity == "quarantined" else "restricted-pending-clearance" if sensitivity == "restricted-pending-clearance" else "cleared-private-only" if sensitivity == "cleared-for-private-evidence-processing" else "needs-review", "publicEligibility": False}
        records.append(record)
        write_json(cache / f"{sid}.json", {"sourceId": sid, "checksum": checksum, "units": units, "metadata": meta})
        if sensitivity == "quarantined": continue
        if sensitivity == "restricted-pending-clearance":
            possible, hidden = reference_candidates(record, units, names); excluded_uncleared += len(possible); suppressed_total += hidden; continue
        if sensitivity == "cleared-for-private-evidence-processing" and "citation-extraction" not in clearance_scopes: continue
        found, hidden = reference_candidates(record, units, names); references.extend(found); suppressed_total += hidden
    if fatal:
        raise RuntimeError("undisclosed credential category detected; no tracked reports were replaced")

    version_groups: dict[str, list[dict]] = defaultdict(list)
    for record in records:
        key = probable_key(record["originalFilename"])
        if len(key) >= 8: version_groups[key].append(record)
    probable_groups = []
    for index, members in enumerate((group for group in version_groups.values() if len(group) > 1), 1):
        gid = f"version-{index:03d}"
        for member in members: member["probableVersionGroup"] = gid
        probable_groups.append((gid, members))
    exact_ref_groups: dict[str, list[dict]] = defaultdict(list)
    for ref in references: exact_ref_groups[(ref["doi"] or ref["pmid"] or re.sub(r"\W+", "", ref["citationText"]).lower())[:180]].append(ref)
    exact_groups = []
    for index, group in enumerate((item for item in exact_ref_groups.values() if len(item) > 1), 1):
        gid = f"ref-exact-{index:03d}"
        for ref in group: ref["duplicateGroup"] = gid; ref["verificationStatus"] = "likely-duplicate"
        exact_groups.append((gid, group))
    for record in records: record["_referenceCount"] = sum(ref["sourceId"] == record["sourceId"] for ref in references)

    eligible = [r for r in records if r["sensitivity"] == "review-required" or (r["sensitivity"] == "cleared-for-private-evidence-processing" and "private-proposal-support" in r["clearanceScopes"])]
    nodes = []
    for topic, target in [("rcrsp", "condition:shoulder/rotator-cuff-related-shoulder-pain"), ("lateral-ankle-sprain", "condition:ankle-foot/lateral-ankle-sprain")]:
        sources = [r for r in eligible if topic in r["topicTags"]]
        if sources: nodes.append({"proposalId": f"proposal-{topic}-evidence-development", "sourceIds": [r["sourceId"] for r in sources], "sourceChecksums": [r["checksum"] for r in sources], "extractedTeachingTopic": topic.replace("-", " "), "proposedClinicalClaim": "Candidate teaching claims require extraction review, external evidence verification, and clinician approval before wording is drafted.", "targetContentId": target, "requiredEvidence": ["Current guideline", "Systematic review", "Clinician review"], "clinicianReviewStatus": "required", "proposalStatus": "blocked-pending-evidence-and-clinician-review", "teachingSourceCanEstablishPublicApproval": False, "visualLicenceStatus": "unknown-review-required", "publicEligibility": False})
    excluded_proposals = sum(1 for r in records if r["sensitivity"] == "restricted-pending-clearance" and set(r["topicTags"]) & {"rcrsp", "lateral-ankle-sprain"})
    summary = {"topLevelFiles": top_count, "nestedFiles": nested_count, "uniqueSources": len(records), "totalObservedBytes": total_bytes, "exactDuplicateGroups": sum(r["duplicateGroup"] is not None for r in records), "probableVersionGroups": len(probable_groups), "quarantinedSources": sum(r["sensitivity"] == "quarantined" for r in records), "restrictedPendingClearanceSources": sum(r["sensitivity"] == "restricted-pending-clearance" for r in records), "clearedSources": sum(r["sensitivity"] == "cleared-for-private-evidence-processing" for r in records), "manualReviewSources": sum(r["sensitivity"] in {"review-required", "restricted-pending-clearance"} for r in records), "suppressedSensitiveLines": suppressed_total, "referencesExcludedUncleared": excluded_uncleared, "proposalSourcesExcludedUncleared": excluded_proposals}
    for record in records: record.pop("_referenceCount", None)

    staging = Path(tempfile.mkdtemp(prefix=reports.name + ".staging-", dir=reports.parent))
    try:
        manifest = {"schemaVersion": 2, "runId": run_id, "sourceSetFingerprint": f"sha256:{source_set_fingerprint}", "implementationCommit": commit, "extractor": {"name": "source-intake-pilot", "version": EXTRACTOR_VERSION, "pythonVersion": sys.version.split()[0], "pypdfVersion": pypdf.__version__, "defusedxmlVersion": getattr(defusedxml, "__version__", "0.7.1")}, "generatedFrom": {"locationCategory": "private-external-inbox", "absolutePathStored": False}, "records": records, "archiveWarnings": archive_warnings, "summary": summary}
        registry = {"schemaVersion": 2, "runId": run_id, "externalLookupPerformed": False, "records": references, "excluded": {"restrictedUncleared": excluded_uncleared, "quarantined": summary["quarantinedSources"], "sensitiveOrAdministrative": suppressed_total}}
        graph = {"schemaVersion": 2, "runId": run_id, "nodes": nodes}
        write_json(staging / "source-manifest.json", manifest); write_json(staging / "references/candidate-reference-registry.json", registry); write_json(staging / "source-to-content-graph.json", graph)
        run_manifest = {"schemaVersion": 1, "runId": run_id, "status": "complete", "implementationCommit": commit, "sourceSetFingerprint": f"sha256:{source_set_fingerprint}", "expectedFiles": EXPECTED_FILES, "sourceCounts": {"unique": len(records), "quarantined": summary["quarantinedSources"], "restricted": summary["restrictedPendingClearanceSources"], "cleared": summary["clearedSources"]}, "deterministicTimestamps": False}
        write_json(staging / "run-manifest.json", run_manifest)
        type_counts, status_counts = Counter(r["fileType"] for r in records), Counter(r["extractionStatus"] for r in records)
        region_counts = Counter(tag for r in records if r["sensitivity"] != "quarantined" for tag in r["regionTags"]); topic_counts = Counter(tag for r in records if r["sensitivity"] != "quarantined" for tag in r["topicTags"])
        write_md(staging / "README.md", "Private source-intake pilot", [("Purpose", "Governed metadata and blocked evidence-development proposals. Source bodies and full text remain in ignored storage."), ("Boundary", "Public eligibility is false. Restricted sources require explicit clearance; clearance is not publication, copyright, evidence, or clinical approval."), ("Reproduction", "Use the operator-supplied private inbox argument. No absolute source path is stored.")])
        write_md(staging / "source-summary.md", "Source intake summary", [("Counts", "\n".join(f"- {key}: {value}" for key, value in summary.items())), ("File types", "\n".join(f"- `{key}`: {value}" for key, value in sorted(type_counts.items()))), ("Governance", "No source body, private path, approval claim, or verified-evidence claim is included.")])
        write_md(staging / "duplicate-report.md", "Duplicate and version analysis", [("Exact duplicates", "\n".join(f"- `{r['duplicateGroup']}`: `{r['sourceId']}`; {len(r['occurrences'])} occurrences; full SHA-256 match." for r in records if r["duplicateGroup"]) or "None detected."), ("Probable versions", "\n".join(f"- `{gid}`: {len(members)} sources; manual review required." for gid, members in probable_groups) or "None detected."), ("Action", "No source was deleted.")])
        quarantine_counts = Counter(item["category"] for r in records if r["sensitivity"] == "quarantined" for item in r["sensitivityFindings"])
        write_md(staging / "quarantine-report.md", "Quarantine report", [("Summary", f"{summary['quarantinedSources']} sources are quarantined."), ("Categories", "\n".join(f"- {key}: {value}" for key, value in sorted(quarantine_counts.items())) or "No category counts."), ("Handling", "Values, names, filenames, and bodies are omitted. Quarantined sources support neither references nor proposals.")])
        write_md(staging / "extraction-status.md", "Extraction status", [("Counts", "\n".join(f"- {key}: {value}" for key, value in sorted(status_counts.items()))), ("Methods", "Embedded text only; no OCR. Office and archive parsing is bounded."), ("Cache", f"Private extracted text is isolated under ignored run `{run_id}`.")])
        write_md(staging / "topic-index.md", "Topic and region index", [("Regions", "\n".join(f"- {key}: {value}" for key, value in sorted(region_counts.items())) or "None."), ("Topics", "\n".join(f"- {key}: {value}" for key, value in sorted(topic_counts.items())) or "None."), ("Caution", "Automated triage labels are not clinical approval.")])
        write_md(staging / "review-queue.md", "Source review queue", [("Priority", "1. Human clearance decisions.\n2. Licence and category review.\n3. Extraction quality.\n4. External citation verification.\n5. Pilot claim review.\n6. Clinician approval before publication."), ("Status", f"Restricted uncleared: {summary['restrictedPendingClearanceSources']}; excluded citations: {excluded_uncleared}; excluded proposal sources: {excluded_proposals}.")])
        class_counts = Counter(r["classification"] for r in references)
        write_md(staging / "references/candidate-reference-summary.md", "Candidate reference summary", [("Counts", f"- Total: {len(references)}\n" + "\n".join(f"- {key}: {value}" for key, value in sorted(class_counts.items())) + f"\n- DOI: {sum(bool(r['doi']) for r in references)}\n- PMID: {sum(bool(r['pmid']) for r in references)}\n- URL: {sum(bool(r['url']) for r in references)}\n- Exact duplicate groups: {len(exact_groups)}"), ("Exclusions", f"Restricted uncleared: {excluded_uncleared}; sensitive/administrative lines: {suppressed_total}."), ("Status", "Offline extraction only; no candidate is verified.")])
        write_md(staging / "references/duplicate-reference-groups.md", "Duplicate reference groups", [("Exact groups", "\n".join(f"- `{gid}`: {len(group)} occurrences across {len(set(r['sourceId'] for r in group))} source(s)." for gid, group in exact_groups) or "None."), ("Action", "No candidate was discarded; manual verification is required.")])
        incomplete = [r for r in references if r["classification"] not in {"full-looking-unverified"}]
        write_md(staging / "references/incomplete-reference-queue.md", "Bibliographic verification queue", [("Counts", "\n".join(f"- {key}: {value}" for key, value in sorted(Counter(r["classification"] for r in incomplete).items())) or "None."), ("Lookup", "External lookup was not performed.")])
        write_md(staging / "references/identifier-verification-queue.md", "Identifier verification queue", [("Counts", f"- DOI candidates: {sum(bool(r['doi']) for r in references)}\n- PMID candidates: {sum(bool(r['pmid']) for r in references)}\n- Generic web: {class_counts['generic-web-link']}\n- Licence/attribution: {class_counts['licence-or-attribution-link']}\n- Media/engagement: {class_counts['media-or-engagement-link']}"), ("Rule", "Identifiers and links require later authoritative verification.")])
        ref_topics = Counter(topic.strip() for r in references for topic in r["relatedTopicOrClaim"].split(",") if topic.strip())
        write_md(staging / "references/topic-to-reference-index.md", "Topic-to-reference index", [("Counts", "\n".join(f"- {key}: {value}" for key, value in sorted(ref_topics.items())) or "None."), ("Meaning", "Extraction associations only.")])
        for record in records: record["_referenceCount"] = sum(ref["sourceId"] == record["sourceId"] for ref in references)
        generate_pilot_reports(staging, records, references)
        for record in records: record.pop("_referenceCount", None)
        _validate_staging(staging)
        _atomic_publish(staging, reports)
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise
    return {"runId": run_id, "uniqueSources": len(records), "quarantinedSources": summary["quarantinedSources"], "restrictedPendingClearanceSources": summary["restrictedPendingClearanceSources"], "clearedSources": summary["clearedSources"], "candidateReferences": len(references), "referencesExcludedUncleared": excluded_uncleared, "suppressedSensitiveLines": suppressed_total, "proposals": len(nodes)}


def _git_head() -> str:
    import subprocess
    value = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    if not re.fullmatch(r"[0-9a-f]{40}", value): raise ValueError("implementation commit is unavailable")
    return value
