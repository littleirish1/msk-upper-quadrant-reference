# Compatibility Rule Engine

`src/lib/clinical-platform/compatibility.ts` provides deterministic compatibility evaluation with stable ordering and a full rule trace. Results include validity, errors, warnings, missing requirements, prohibited combinations, escalation requirements, evidence gaps, review needs, implied modules, and the exact rule-set digest.

The engine supports requires, prohibits, implies, conditional permission, mutual exclusion, severity, laterality, anatomy/distribution, timing, population, comorbidity, investigation, escalation, movement, subjective/objective consistency, diagnosis/differential consistency, and publication/licensing dependencies. Conflicting approved rules fail closed. A changed rule digest marks affected approvals stale; the engine never rewrites a case.

The private catalogue contains one disabled draft template per rule family. These templates demonstrate the governed shape without making clinical assertions. Enabling a rule requires an exact revision/hash plus clinical and evidence approval.

Regression tests use explicitly synthetic modules and evidence IDs. They cover valid and invalid combinations, transitive implication, conflicts, stale rule revisions, deterministic ordering, and a 1,000-module batch.
