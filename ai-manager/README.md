# Private AI Knowledge Manager

`ai-manager` is local/back-office tooling only. It is not imported by the public Next.js app, copied into `out`, or exposed by Netlify.

Tracked here:

- schemas and safe example templates;
- prompts that prohibit fabricated citations;
- deterministic validation scripts;
- documented review workflows;
- non-sensitive configuration examples.

Ignored here:

- intake documents;
- generated reports and proposals;
- archives;
- local configuration;
- environment files, credentials, and private source material.

The manager may propose drafts. It cannot self-approve clinical publication, commit, push, or bypass the repository preflight gate.

## Private Source Intake Environment

The hardened intake tool supports Python 3.12 and runs offline. Its only Python
packages are pinned in `requirements-source-intake.txt`.

On Windows PowerShell:

```powershell
py -3.12 -m venv ai-manager\.venv-source-intake
ai-manager\.venv-source-intake\Scripts\python.exe -m pip install -r ai-manager\requirements-source-intake.txt
ai-manager\.venv-source-intake\Scripts\python.exe ai-manager\scripts\source_intake_pilot.py <private-inbox>
```

The inbox must remain outside the repository. The argument is never written to
tracked reports. Full extracted text is held under the ignored, run-scoped
`ai-manager/private-cache/source-intake-pilot/` directory. The tool does not run
OCR, access external references, or infer copyright, evidence, or clinical
approval. Legacy binary Office formats and unsupported/corrupt documents are
reported as metadata-only or failed rather than guessed.
