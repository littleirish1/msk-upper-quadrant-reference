\# Legacy HTML Case Bank Import



This folder stores the original single-page PTH704 Clinical Reasoning Lab HTML file.



The raw HTML is source material only. It should not be used directly as active app code.



\## Purpose



Use this file to extract:



\- OSCE station case material

\- Clinical reasoning prompts

\- Model reasoning answers

\- Differential diagnosis content

\- Red flag reasoning

\- MCQ material

\- Evidence/reference records

\- Special test and outcome measure content



\## Workflow



1\. Keep the original HTML in `raw/`.

2\. Extract useful content into `extracted/`.

3\. Review extracted clinical content.

4\. Convert reviewed items into the new MDX structure:

&#x20;  - `content/cases/\[region]/\[case-slug].mdx`

&#x20;  - `content/\[region]/\[condition].mdx`

&#x20;  - future evidence registry files



\## Safety rule



Do not automatically publish extracted clinical content without review.

