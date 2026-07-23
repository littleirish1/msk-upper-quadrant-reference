import fs from 'node:fs'
import path from 'node:path'
import {
  HUB_LIB_DIR,
  buildJsonSchemaDocument,
  loadEvidenceHubModule,
  stableJson,
} from './shared.mjs'

const module = await loadEvidenceHubModule()
const output = path.join(HUB_LIB_DIR, 'evidence-hub-v1.schema.json')
fs.writeFileSync(output, stableJson(buildJsonSchemaDocument(module)), 'utf8')
console.log('Evidence Hub JSON Schema written: ' + path.relative(process.cwd(), output).split(path.sep).join('/'))
