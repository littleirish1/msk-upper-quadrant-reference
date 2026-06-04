\# Guided Case Authoring Rules



This repo uses guided clinical cases as interactive revision content.



\## Case location



New guided cases must be saved under:



content/cases/\[region]/\[case-slug].mdx



Example:



content/cases/shoulder/rcrsp-case-02.mdx



\## Template



Use this file as the structure for new cases:



content/\_TEMPLATE/cases/guided-case-template.mdx



\## Required frontmatter



Every case must include:



title

region

condition

difficulty

caseType

learningFocus

estimatedTime

lastReviewed

reviewedBy



\## Case style



Cases should be written as guided clinical reasoning, not as formal OSCE marking rubrics.



Use:

\- ReasoningPrompt

\- RevealAnswer

\- ClinicalNote

\- RedFlag where appropriate



Avoid:

\- pass/fail language

\- formal scoring rubrics

\- unsupported treatment claims

\- invented citations



\## Safety rule



Clinical content should be drafted for review. Do not treat generated case material as approved guidance unless reviewed.



\## Routing



Cases are automatically listed on:



/cases/



Individual cases render at:



/cases/\[region]/\[caseSlug]/



\## Content hygiene / names to flag



When reviewing imported legacy content or generating guided cases, flag and remove or replace any references to the following names unless there is a deliberate reason to keep them:



\- Mr Ally McKeown

\-Dr Grace McMacken (ST7 Neurology, RVH/QUB)

\- Joanne Marley

\- Suzzan Manning

&#x20;- Donna McElhill
- Sonya Thomson
-Suzie Johnston

&#x20;- Dr Marley



These names should not appear in final guided case content, case metadata, evidence notes, prompts, or extracted learner-facing material.



Do not manually hardcode new cases into src/app/cases/page.tsx unless there is a specific reason.

