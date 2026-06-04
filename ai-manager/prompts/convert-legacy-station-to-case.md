\# Aider Task: Convert Legacy Station Extract to Guided Case



You are editing the existing `msk-upper-quadrant-reference` repo.



Convert one extracted legacy station Markdown file into a new guided clinical case.



\## Source material



Use one file from:



`content/imports/html-case-bank/extracted/stations/`



Example:



`content/imports/html-case-bank/extracted/stations/s28-mark-49-sudden-elbow-pain.md`



The extracted station is source material only. Do not treat it as automatically approved content.



\## Required destination



Create one new MDX guided case under:



`content/cases/\[region]/\[case-slug].mdx`



Example:



`content/cases/elbow/distal-biceps-rupture-case-01.mdx`



\## Rules to follow



Read and follow:



\- `ai-manager/guided-case-rules.md`

\- `ai-manager/project-architecture.md`

\- `content/\_TEMPLATE/cases/guided-case-template.mdx`



\## Required frontmatter



Every generated case must include:



\- title

\- region

\- condition

\- difficulty

\- caseType

\- learningFocus

\- estimatedTime

\- lastReviewed

\- reviewedBy



Use:



```yaml

caseType: "guided-reasoning"

reviewedBy: "Eoin Casey"

