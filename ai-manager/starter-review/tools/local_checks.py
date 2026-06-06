from pathlib import Path
import re


def check_blank_files(root: str = "website") -> list[str]:
    issues = []
    base = Path(root)
    if not base.exists():
        return [f"Website folder not found: {root}"]
    for path in base.rglob("*"):
        if path.is_file() and path.suffix.lower() in {".html", ".css", ".js", ".md"}:
            text = path.read_text(encoding="utf-8", errors="replace").strip()
            if not text:
                issues.append(f"Blank file: {path}")
    return issues


def check_html_titles(root: str = "website") -> list[str]:
    issues = []
    for path in Path(root).rglob("*.html"):
        text = path.read_text(encoding="utf-8", errors="replace")
        if "<title>" not in text.lower():
            issues.append(f"Missing <title>: {path}")
    return issues


def check_obvious_placeholders(root: str = "website") -> list[str]:
    issues = []
    patterns = [r"TODO", r"FIXME", r"lorem ipsum", r"placeholder"]
    combined = re.compile("|".join(patterns), re.IGNORECASE)
    for path in Path(root).rglob("*"):
        if path.is_file() and path.suffix.lower() in {".html", ".css", ".js", ".md", ".txt"}:
            text = path.read_text(encoding="utf-8", errors="replace")
            if combined.search(text):
                issues.append(f"Placeholder/TODO found: {path}")
    return issues


def run_all_local_checks(root: str = "website") -> list[str]:
    issues = []
    issues.extend(check_blank_files(root))
    issues.extend(check_html_titles(root))
    issues.extend(check_obvious_placeholders(root))
    return issues
