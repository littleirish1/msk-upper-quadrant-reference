from dataclasses import dataclass
from typing import List

@dataclass
class TaskPlan:
    task: str
    steps: List[str]
    needs_research: bool
    needs_website_edit: bool
    needs_qa: bool


def create_plan(task: str) -> TaskPlan:
    lower = task.lower()
    needs_research = any(word in lower for word in ["source", "research", "evidence", "update information", "cite"])
    needs_website_edit = any(word in lower for word in ["website", "html", "css", "page", "fix", "build", "edit", "navigation"])
    needs_qa = any(word in lower for word in ["check", "audit", "fix", "correct", "review", "broken"])

    steps = ["Understand the task and identify affected project areas"]
    if needs_research:
        steps.append("Gather or update source material")
    if needs_website_edit:
        steps.append("Inspect relevant website files and prepare small changes")
    if needs_qa:
        steps.append("Run local checks and identify corrections")
    steps.append("Assemble result, changelog, and unresolved issues")

    return TaskPlan(
        task=task,
        steps=steps,
        needs_research=needs_research,
        needs_website_edit=needs_website_edit,
        needs_qa=needs_qa,
    )
