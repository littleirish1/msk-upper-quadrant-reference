# Grounded Conversational Patient and Tutor

The Simulated Patient and Tutor are separate deterministic systems. The patient classifies intent locally, retrieves only projected truth IDs, and responds with an approved fact or a fixed unavailable/clarification template. It cannot teach, alter truth, or disclose diagnosis. A constrained adapter may propose only an allowed intent and non-sensitive paraphrase; invalid output is rejected, and provider-free operation is the default.

The tutor receives only the patient audit trail. It reports explored domains, omissions, clarification quality, an optional process hint, and checkpoint feedback. It never impersonates the patient, supplies a diagnosis, or mutates truth.

Six public conversation assets are generated under opaque filenames. They include only baseline-approved immediate presentation text and explicit unavailable states. Diagnosis, condition links, review metadata, private pilots, and learner identity are absent. Assets are loaded only after the learner enters Conversation or Hybrid mode.

Private provider-free transcripts record intent, retrieved truth IDs, template, adapter use, and validation without learner identifiers. Regression coverage includes prompt injection, hidden-truth and diagnosis requests, vague/multiple/repeated questions, misspellings, unsupported topics, invalid adapter output/model outage, and stale cross-case state.
