from pathlib import Path
from typing import Iterable

TEXT_EXTENSIONS = {".html", ".css", ".js", ".jsx", ".ts", ".tsx", ".json", ".md", ".txt", ".py"}


def list_project_files(root: str = "website") -> list[Path]:
    base = Path(root)
    if not base.exists():
        return []
    return [p for p in base.rglob("*") if p.is_file() and p.suffix.lower() in TEXT_EXTENSIONS]


def read_text_file(path: Path, max_chars: int = 20000) -> str:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
        return text[:max_chars]
    except Exception as exc:
        return f"[Could not read {path}: {exc}]"


def safe_write_file(path: Path, content: str, allow_write: bool = False) -> str:
    if not allow_write:
        return f"DRY RUN: would write {path}"
    backup = path.with_suffix(path.suffix + ".bak")
    if path.exists() and not backup.exists():
        backup.write_text(path.read_text(encoding="utf-8", errors="replace"), encoding="utf-8")
    path.write_text(content, encoding="utf-8")
    return f"Wrote {path}; backup at {backup}"
