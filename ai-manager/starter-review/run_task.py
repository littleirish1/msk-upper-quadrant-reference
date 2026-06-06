import argparse
import json
import sqlite3
from pathlib import Path
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from dotenv import load_dotenv

from agents.supervisor import create_plan
from agents.researcher import research_stub
from agents.website_builder import inspect_website
from agents.reviewer import review_project

load_dotenv()
console = Console()
DB_PATH = Path("memory/project_memory.sqlite")


def save_task_run(task: str, plan: dict, result: dict) -> None:
    if not DB_PATH.exists():
        return
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "INSERT INTO task_runs(task, plan, result, files_changed, cost_estimate) VALUES (?, ?, ?, ?, ?)",
            (task, json.dumps(plan, indent=2), json.dumps(result, indent=2), "[]", "local-only")
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("task", help="Task for the AI site manager")
    parser.add_argument("--allow-write", action="store_true", help="Allow file edits. Currently scaffold is dry-run only.")
    args = parser.parse_args()

    plan = create_plan(args.task)

    console.print(Panel.fit(args.task, title="Task"))

    table = Table(title="Supervisor Plan")
    table.add_column("Step", style="cyan")
    for i, step in enumerate(plan.steps, 1):
        table.add_row(f"{i}. {step}")
    console.print(table)

    result = {
        "task": args.task,
        "plan": plan.__dict__,
        "research": None,
        "website": None,
        "qa": None,
        "write_mode": "enabled" if args.allow_write else "dry-run"
    }

    if plan.needs_research:
        result["research"] = research_stub(args.task)

    if plan.needs_website_edit or plan.needs_qa:
        result["website"] = inspect_website("website")

    if plan.needs_qa:
        result["qa"] = review_project("website")

    save_task_run(args.task, plan.__dict__, result)

    console.print(Panel(json.dumps(result, indent=2), title="Result"))

    if result.get("qa") and result["qa"]["issue_count"] > 0:
        console.print("[yellow]Issues found. Next step: connect website editor patching and run targeted fixes.[/yellow]")
    else:
        console.print("[green]No local issues found by current basic checks.[/green]")


if __name__ == "__main__":
    main()
