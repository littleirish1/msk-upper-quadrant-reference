# Patient Truth Records

`src/lib/clinical-platform/truthRecordSchema.ts` defines the single immutable truth model used by Guided, Conversation, and Hybrid case modes. The private authoritative records are generated into `ai-manager/clinical-platform/truth/patient-truth-records.json`; the learner application must consume only separately generated public projections.

The migration covers all six governed public cases and all three private pilots. It carries forward only source-supported meaning. Each supported truth domain is present exactly once. Missing information is represented as `unavailable-in-case`, `not-yet-assessed`, or `intentionally-withheld`; missing is never interpreted as negative.

Each item pins its source record, repository path, revision, SHA-256 hash, disclosure stage, retrieval intents, patient knowledge, uncertainty, clinical role, and module revision. Diagnosis and condition links remain intentionally withheld until final reveal. Records are deeply frozen when a session starts, and the same case revision and seed basis reproduce the same authoritative hash.

The migration report at `reports/clinical-platform/truth-record-migration.json` records counts without exporting private pilot content.

## Validation

- `npm run truth:generate`
- `npm run test:truth`
