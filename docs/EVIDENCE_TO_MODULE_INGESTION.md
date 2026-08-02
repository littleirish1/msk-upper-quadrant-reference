# Evidence-to-Module Ingestion

The ingestion pipeline is private, deterministic, and network-free in CI. It supports guidelines, systematic reviews, primary studies, textbooks/educational sources, PowerPoints, teaching PDFs, local policies, visual sources, user lists, and repository registries.

Each source is registered with a stable ID, revision, repository path, exact hash, extraction state, clearance state, and image-republication prohibition. Claim proposals require an exact page/slide/heading/passage locator, compliant excerpt, paraphrase, study type, population, setting, limitations, applicability, affected modules, conflicts, proposed action, and human review. Proposals can never apply themselves.

Offline fixtures cover DOI/Crossref-like, PubMed-like, Europe-PMC-like, guideline, user-list, and Google Scholar discovery-only adapters. Tests make zero network calls. PowerPoints and teaching PDFs are classified as secondary/educational until their underlying evidence is independently verified.

The current register hashes three genuine tracked repository sources but creates zero claim, module, or rule revisions because identifiers, passages, claims, evidence quality, and clearance have not been independently reviewed. Embedded images remain non-republishable.
