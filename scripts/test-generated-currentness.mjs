import assert from 'node:assert/strict'
import { artifactsEqual, canonicalText } from './lib/artifactComparison.mjs'

const utf8 = (value) => Buffer.from(value, 'utf8')
const canonical = '{\n  "records": [\n    "first",\n    "second"\n  ]\n}\n'

assert.equal(artifactsEqual(utf8(canonical), utf8(canonical.replace(/\n/g, '\r\n'))), true)
assert.equal(artifactsEqual(utf8(canonical), utf8(`\uFEFF${canonical}`)), true)
assert.equal(canonicalText(utf8('first\rsecond\r\nthird')), 'first\nsecond\nthird')
assert.equal(
  artifactsEqual(utf8(canonical), utf8(canonical.replace('"second"', '"changed"'))),
  false,
)
assert.equal(
  artifactsEqual(utf8(canonical), utf8(canonical.replace('    "second"\n', ''))),
  false,
)
assert.equal(
  artifactsEqual(utf8(canonical), utf8(canonical.replace('"first",\n    "second"', '"second",\n    "first"'))),
  false,
)
assert.equal(
  artifactsEqual(Buffer.from([0, 13, 10, 255]), Buffer.from([0, 10, 255]), { kind: 'binary' }),
  false,
)

const lockfile = '{\n  "lockfileVersion": 3,\n  "packages": {}\n}\n'
assert.equal(artifactsEqual(utf8(lockfile), utf8(lockfile.replace(/\n/g, '\r\n'))), true)
assert.equal(
  artifactsEqual(utf8(lockfile), utf8(lockfile.replace('"packages": {}', '"packages": {"node_modules/example": {}}'))),
  false,
)

console.log('Generated-artifact currentness comparison tests passed.')
console.log('LF/CRLF and permitted BOM differences normalize; content, ordering, missing records, binary bytes, and lockfile drift remain strict.')
