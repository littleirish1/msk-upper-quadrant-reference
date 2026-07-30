import fs from 'node:fs'
import {
  JSON_SCHEMA_FILE,
  loadGuidedCaseModule,
  relative,
  stableJson,
} from './shared.mjs'

const module = await loadGuidedCaseModule()
const schema = module.zodToJsonSchema(module.guidedCaseRecordSchema)
const document = {
  ...schema,
  $id: 'https://example.invalid/msk/guided-case/v2.schema.json',
  title: 'Governed guided case v2',
}
fs.writeFileSync(JSON_SCHEMA_FILE, stableJson(document), 'utf8')
console.log(`Guided-case JSON Schema written: ${relative(JSON_SCHEMA_FILE)}`)
