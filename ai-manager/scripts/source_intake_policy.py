"""Shared sensitive-data and path policy for private source intake."""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path, PurePosixPath


ROOT = Path(__file__).resolve().parents[2]
POLICY_FILE = ROOT / "ai-manager" / "config" / "sensitive-data-policy.json"
HYGIENE_FILE = ROOT / "ai-manager" / "content-hygiene-names.json"

BIDI_CONTROLS = "\u061c\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069"
MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December"

EMAIL = re.compile(r"(?<![\w.+-])[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}(?![\w.-])", re.I)
PHONE = re.compile(
    r"(?<!\d)(?:(?:\+|00)44[\s().-]*\d(?:[\s().-]*\d){8,10}|0\d(?:[\s().-]*\d){8,10})(?!\d)"
)
POSTCODE = re.compile(r"\b(?:GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b", re.I)
DOB = re.compile(
    rf"\b(?:DOB|date\s+of\s+birth|born)\s*[:#-]?\s*(?:"
    rf"\d{{1,2}}[./-]\d{{1,2}}[./-]\d{{2,4}}|"
    rf"\d{{4}}-\d{{2}}-\d{{2}}|"
    rf"\d{{1,2}}\s+(?:{MONTHS})\s+\d{{4}}|"
    rf"(?:{MONTHS})\s+\d{{1,2}},?\s+\d{{4}})\b",
    re.I,
)
LABELLED_NHS = re.compile(r"\bNHS\s*(?:number|no\.?|id)?\s*[:#-]?\s*(?:\d[\s-]*){10}\b", re.I)
TEN_DIGIT = re.compile(r"(?<!\d)(?:\d[ -]?){9}\d(?!\d)")
PATIENT_ID = re.compile(
    r"\b(?:hospital|patient|medical\s+record|case)\s*(?:number|no\.?|id|identifier)\s*[:#-]?\s*[A-Z0-9][A-Z0-9/-]{4,19}\b",
    re.I,
)
STUDENT_ID = re.compile(
    r"\b(?:student|candidate|university)\s*(?:number|no\.?|id|identifier)\s*[:#-]?\s*[A-Z0-9][A-Z0-9/-]{4,19}\b",
    re.I,
)
WINDOWS_PATH = re.compile(r"\b[A-Z]:[\\/](?:Users|dev|home|Documents|Desktop|Downloads)[\\/][^\r\n]+", re.I)
UNC_PATH = re.compile(r"\\\\[^\\\s]+\\[^\r\n]+")
PRIVATE_KEY = re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")
JWT = re.compile(r"\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b")
GITHUB_TOKEN = re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b")
AWS_KEY = re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b")
SLACK_TOKEN = re.compile(r"\bxox[a-z]-[A-Za-z0-9-]{20,}\b")
GENERIC_KEY_NAMES = "|".join([
    "_".join(["API", "KEY"]),
    "_".join(["ACCESS", "TOKEN"]),
    "_".join(["PRIVATE", "KEY"]),
    "".join(["SEC", "RET"]),
])
GENERIC_KEY = re.compile(rf"\b(?:{GENERIC_KEY_NAMES})\b\s*[:=]\s*[^\s,;]{{8,}}", re.I)
CONTACT_WORDS = re.compile(
    r"\b(?:presented\s+by|presentation\s+by|author\s+contact|correspondence|e-?mail|telephone|phone|contact|address)\b",
    re.I,
)
HONORIFIC = re.compile(r"\b(?:Mr|Mrs|Ms|Miss|Dr|Professor|Prof)\.?\s+[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+)+")


@dataclass(frozen=True)
class Finding:
    category: str
    start: int
    end: int


def load_policy() -> dict:
    return json.loads(POLICY_FILE.read_text(encoding="utf-8"))


def load_governed_names() -> list[str]:
    value = json.loads(HYGIENE_FILE.read_text(encoding="utf-8"))
    return sorted({item.strip() for item in value.get("termsToFlag", []) if item.strip()}, key=len, reverse=True)


def _valid_nhs_candidate(value: str) -> bool:
    digits = [int(item) for item in re.sub(r"\D", "", value)]
    if len(digits) != 10:
        return False
    total = sum(digit * weight for digit, weight in zip(digits[:9], range(10, 1, -1)))
    check = 11 - (total % 11)
    if check == 11:
        check = 0
    return check != 10 and check == digits[9]


def _pattern_findings(category: str, pattern: re.Pattern[str], text: str) -> list[Finding]:
    return [Finding(category, match.start(), match.end()) for match in pattern.finditer(text)]


def scan_sensitive(text: str, governed_names: list[str] | None = None) -> list[Finding]:
    names = governed_names if governed_names is not None else load_governed_names()
    findings: list[Finding] = []
    for category, pattern in [
        ("email-address", EMAIL),
        ("telephone-number", PHONE),
        ("uk-postcode", POSTCODE),
        ("date-of-birth", DOB),
        ("nhs-number", LABELLED_NHS),
        ("patient-or-hospital-identifier", PATIENT_ID),
        ("student-or-candidate-identifier", STUDENT_ID),
        ("private-absolute-path", WINDOWS_PATH),
        ("unc-path", UNC_PATH),
        ("credential-value", PRIVATE_KEY),
        ("credential-value", JWT),
        ("credential-value", GITHUB_TOKEN),
        ("credential-value", AWS_KEY),
        ("credential-value", SLACK_TOKEN),
        ("credential-value", GENERIC_KEY),
    ]:
        findings.extend(_pattern_findings(category, pattern, text))
    for match in TEN_DIGIT.finditer(text):
        if _valid_nhs_candidate(match.group(0)) and not any(
            finding.start <= match.start() < finding.end for finding in findings if finding.category == "nhs-number"
        ):
            findings.append(Finding("suspicious-nhs-candidate", match.start(), match.end()))
    lower = text.casefold()
    for name in names:
        start = 0
        needle = name.casefold()
        while (index := lower.find(needle, start)) >= 0:
            findings.append(Finding("governed-sensitive-name", index, index + len(name)))
            start = index + len(name)
    for index, character in enumerate(text):
        code = ord(character)
        if character in BIDI_CONTROLS or (code < 32 and character not in "\t\r\n") or 0x7F <= code <= 0x9F:
            findings.append(Finding("bidi-or-control-character", index, index + 1))
    has_contact = bool(CONTACT_WORDS.search(text)) and bool(
        EMAIL.search(text) or PHONE.search(text) or POSTCODE.search(text) or HONORIFIC.search(text)
    )
    if has_contact:
        findings.append(Finding("contact-or-correspondence-block", 0, len(text)))
    return sorted(set(findings), key=lambda item: (item.start, item.end, item.category))


def credential_rule_counts(text: str) -> dict[str, int]:
    rules = {
        "private-key-material": PRIVATE_KEY,
        "jwt-shaped": JWT,
        "github-token-shaped": GITHUB_TOKEN,
        "aws-access-key-shaped": AWS_KEY,
        "slack-token-shaped": SLACK_TOKEN,
        "generic-key-assignment": GENERIC_KEY,
    }
    return {rule_id: len(pattern.findall(text)) for rule_id, pattern in rules.items() if pattern.search(text)}


def finding_counts(findings: list[Finding]) -> list[dict]:
    counts: dict[str, int] = {}
    for finding in findings:
        counts[finding.category] = counts.get(finding.category, 0) + 1
    return [{"category": key, "count": counts[key]} for key in sorted(counts)]


def sanitize_tracked_line(
    text: str,
    governed_names: list[str] | None = None,
    *,
    maximum_length: int = 280,
) -> tuple[str | None, list[dict]]:
    normalized = unicodedata.normalize("NFC", text).strip()
    findings = scan_sensitive(normalized, governed_names)
    counts = finding_counts(findings)
    if findings:
        return None, counts
    compact = re.sub(r"\s+", " ", normalized)
    return compact[:maximum_length] if compact else None, counts


def safe_display_name(filename: str, display_source_id: str, governed_names: list[str] | None = None) -> tuple[str, list[dict]]:
    normalized = unicodedata.normalize("NFC", filename)
    findings = scan_sensitive(normalized, governed_names)
    if findings or len(normalized) > load_policy()["documentLimits"]["maximumFilenameLength"]:
        suffix = Path(filename).suffix.lower()
        return f"restricted-{display_source_id}{suffix}", finding_counts(findings)
    return normalized, []


def normalize_archive_member(name: str, maximum_length: int) -> tuple[str | None, str | None]:
    normalized = unicodedata.normalize("NFC", name.replace("\\", "/"))
    if len(normalized) > maximum_length:
        return None, "filename-too-long"
    for character in normalized:
        code = ord(character)
        if character in BIDI_CONTROLS or code == 0 or code < 32 or 0x7F <= code <= 0x9F:
            return None, "unsafe-unicode-or-path"
    candidate = PurePosixPath(normalized)
    if candidate.is_absolute() or re.match(r"^[A-Za-z]:", normalized):
        return None, "absolute-path"
    if any(part in {"", ".", ".."} for part in candidate.parts):
        return None, "path-traversal"
    return candidate.as_posix(), None
