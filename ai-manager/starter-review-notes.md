\# AI Site Manager Starter Review Notes



This folder contains selected files from the AI site manager starter project.



It is review material only until adapted.



\## Do not copy into the public app



Do not place this code under `src/app` or any learner-facing route.



The public Netlify site should remain static and learner-facing.



\## Useful concepts to adapt



\- Agent supervisor pattern

\- Reviewer/checker pattern

\- Local file tools

\- Local command runner

\- LLM provider abstraction

\- Cost guard

\- Project index

\- Memory/context notes



\## Must stay local/back-office only



\- AI generation

\- Aider/Ollama/OpenAI provider calls

\- File-writing tools

\- Local command execution

\- Import/conversion workflows

\- Logs

\- Environment variables



\## Target integration



Adapt useful parts into:



\- `ai-manager/agents/`

\- `ai-manager/tools/`

\- `ai-manager/run\_task.py`



The adapted tool should understand this repo’s real workflows:



\- `npm run check:hygiene`

\- `npm run preflight`

\- `npm run case:wizard`

\- `npm run tracker:legacy`

\- `content/cases/`

\- `content/imports/html-case-bank/`

\- `ai-manager/prompts/`



\## Safety rules



Do not auto-publish clinical content.



Do not auto-commit unless explicitly instructed.



Do not expose API keys or local `.env` files.



Do not modify public site routes unless the task specifically requires it.



Generated clinical cases should remain `status: "draft"` until reviewed.

