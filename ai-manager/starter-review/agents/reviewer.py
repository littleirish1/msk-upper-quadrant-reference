from tools.local_checks import run_all_local_checks


def review_project(root: str = "website") -> dict:
    issues = run_all_local_checks(root)
    return {
        "issue_count": len(issues),
        "issues": issues
    }
