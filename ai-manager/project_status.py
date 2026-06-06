from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

CASES_DIR = ROOT / "content" / "cases"
TRACKER = ROOT / "content" / "imports" / "html-case-bank" / "migration-tracker.md"


def run_command(command: list[str]) -> tuple[int, str]:
    try:
        result = subprocess.run(
            command,
            cwd=ROOT,
            text=True,
            capture_output=True,
            shell=False,
        )
        return result.returncode, (result.stdout + result.stderr).strip()
    except Exception as exc:
        return 1, str(exc)


def read_frontmatter(path: Path) -> dict[str, str]:
    text = path.read_text(encoding="utf-8", errors="replace")
    if not text.startswith("---"):
        return {}

    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}

    frontmatter = {}
    for line in parts[1].splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        frontmatter[key.strip()] = value.strip().strip('"').strip("'")

    return frontmatter


def collect_cases() -> list[dict[str, str]]:
    cases = []

    if not CASES_DIR.exists():
        return cases

    for path in CASES_DIR.rglob("*.mdx"):
        fm = read_frontmatter(path)
        cases.append(
            {
                "path": str(path.relative_to(ROOT)),
                "title": fm.get("title", path.stem),
                "region": fm.get("region", path.parent.name),
                "status": fm.get("status", "published"),
                "difficulty": fm.get("difficulty", "unknown"),
            }
        )

    return sorted(cases, key=lambda item: item["path"])


def tracker_counts() -> dict[str, int]:
    if not TRACKER.exists():
        return {"pending": 0, "converted": 0}

    text = TRACKER.read_text(encoding="utf-8", errors="replace")
    return {
        "pending": text.count("| pending-review |"),
        "converted": text.count("| converted |"),
    }


def main() -> None:
    print("\nMSK Clinical Reasoning Lab — Local Project Status\n")

    code, git = run_command(["git", "status", "--short"])
    print("Git status:")
    if code == 0 and git:
        print(git)
    elif code == 0:
        print("clean")
    else:
        print(git)

    cases = collect_cases()
    published = [case for case in cases if case["status"].lower() == "published"]
    drafts = [case for case in cases if case["status"].lower() == "draft"]
    archived = [case for case in cases if case["status"].lower() == "archived"]

    print("\nCases:")
    print(f"total: {len(cases)}")
    print(f"published: {len(published)}")
    print(f"draft: {len(drafts)}")
    print(f"archived: {len(archived)}")

    if drafts:
        print("\nDraft cases:")
        for case in drafts:
            print(f"- {case['title']} — {case['path']}")

    counts = tracker_counts()
    print("\nLegacy migration tracker:")
    print(f"pending-review rows: {counts['pending']}")
    print(f"converted rows: {counts['converted']}")

    print("\nHygiene check:")
    code, hygiene = run_command(["npm.cmd", "run", "check:hygiene"])
    if code == 0:
        print("passed")
    else:
        print("failed")
        print(hygiene)

    print("\nDone.\n")


if __name__ == "__main__":
    main()
