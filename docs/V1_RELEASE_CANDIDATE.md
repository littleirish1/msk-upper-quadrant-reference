# Version 1 release candidate

## Candidate state

The Version 1 conversational clinical platform candidate is deliberately `blocked`. The generator assembles every known item-level gate and performs a dry run that stops before publication, deployment, push, or tag operations.

## Exact blockers

The candidate traces every pending review decision to its exact-revision key. It also records each evidence gap and unclear source revision, each manual viewport/theme sign-off, every beta-governance approval, every open dependency risk, and the independent-review and publication decisions.

## Automated validation

Tracked candidate generation cannot truthfully bind itself to a commit that does not yet exist. `repositoryCommit` therefore remains `null`, and `automatedValidationStatus` remains `pending-final-exact-commit-validation`. Exact final commit and tree identity belong in the external review packet generated after the last commit.

## Fail-closed behaviour

No blocker is automatically waived. Empty, stale, or mismatched review state cannot make the candidate eligible. The dry run records that no publication action was attempted.

## Human release boundary

Independent review and accountable publication approval remain required even if all automated validation passes. This repository does not push, merge, deploy, or tag the candidate.
