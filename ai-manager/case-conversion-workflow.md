\# Case Conversion Workflow



This workflow is for converting legacy extracted stations into reviewed guided MDX cases.



\## Standard process



1\. Choose a pending station from:

&#x20;  `content/imports/html-case-bank/migration-tracker.md`



2\. Inspect the extracted source:

&#x20;  `content/imports/html-case-bank/extracted/stations/`



3\. Run the case wizard:

&#x20;  `npm run case:wizard`



4\. Generate the draft case under:

&#x20;  `content/cases/\[region]/\[case-slug].mdx`



5\. Review and rewrite the draft:

&#x20;  - Remove TODO sections

&#x20;  - Preserve clinically useful material

&#x20;  - Remove speaker/staff names

&#x20;  - Use neutral educational language

&#x20;  - Ensure frontmatter is valid YAML

&#x20;  - Set `status: "published"` only when reviewed



6\. Run:

&#x20;  `npm run check:hygiene`



7\. Run:

&#x20;  `npm run preflight`



8\. Update migration tracker:

&#x20;  - Move converted station to converted table

&#x20;  - Remove it from pending review



9\. Commit:

&#x20;  `git add ...`

&#x20;  `git commit -m "Add \[case name] guided case"`



\## Public deployment rule



Only reviewed cases should use:



`status: "published"`



Draft or incomplete cases should use:



`status: "draft"`



The public `/cases` index hides draft and archived cases.



