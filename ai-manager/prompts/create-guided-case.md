\# Aider Task: Create a Guided Clinical Case



You are editing the existing `msk-upper-quadrant-reference` repo.



Create one new guided clinical case using the current guided case system.



\## Rules



Read and follow:



\- `ai-manager/guided-case-rules.md`

\- `content/\_TEMPLATE/cases/guided-case-template.mdx`



\## Output location



Save the new case under:



`content/cases/\[region]/\[case-slug].mdx`



Do not hardcode the case into `src/app/cases/page.tsx`. The `/cases` page auto-lists MDX cases.



\## Required frontmatter



Every case must include:



\- title

\- region

\- condition

\- difficulty

\- caseType

\- learningFocus

\- estimatedTime

\- lastReviewed

\- reviewedBy



\## Style



Write as an interactive revision guide, not an OSCE marking rubric.



Use:



\- `<ReasoningPrompt />`

\- `<RevealAnswer>`

\- `<ClinicalNote>` where useful

\- `<RedFlag>` where clinically appropriate



Avoid:



\- pass/fail scoring

\- unsupported treatment claims

\- invented citations

\- modifying unrelated files



\## Safety



Clinical content is draft educational content for review. Do not present generated management advice as final approved guidance unless evidence-linked and reviewed.



\## After editing



Run:



`npm run build`



Report any errors.

