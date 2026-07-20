#!/usr/bin/env python3
"""CLI for the private, deterministic source-intake pilot."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from source_intake_engine import build_intake


def main() -> int:
    parser = argparse.ArgumentParser(description="Build governed private source-intake reports")
    parser.add_argument("inbox", nargs="?", help="Private source inbox (or set MSK_SOURCE_INBOX)")
    args = parser.parse_args()
    supplied = args.inbox or os.environ.get("MSK_SOURCE_INBOX")
    if not supplied:
        parser.error("supply a private inbox argument or MSK_SOURCE_INBOX")
    inbox = Path(supplied)
    if not inbox.is_dir():
        parser.error("the supplied private inbox is not a readable directory")
    result = build_intake(inbox)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
