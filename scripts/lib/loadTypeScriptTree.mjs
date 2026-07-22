import fs from 'node:fs'
import path from 'node:path'
import { builtinModules, createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const BUILT_INS = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)])

export async function loadTypeScriptTree(entryFile, sourceRoot = path.dirname(entryFile)) {
  const root = path.resolve(sourceRoot)
  const entry = path.resolve(entryFile)
  if (!isInsideOrEqual(root, entry)) throw new Error('TypeScript entry must be inside its source root')

  const cacheRoot = path.join(process.cwd(), 'node_modules', '.cache')
  fs.mkdirSync(cacheRoot, { recursive: true })
  const outputRoot = fs.mkdtempSync(path.join(cacheRoot, 'msk-ts-module-'))
  const compiled = new Map()
  try {
    compile(entry)
    return await import(pathToFileURL(outputPath(entry)).href + `?v=${Date.now()}`)
  } finally {
    fs.rmSync(outputRoot, { recursive: true, force: true })
  }

  function compile(sourceFile) {
    if (compiled.has(sourceFile)) return compiled.get(sourceFile)
    if (!fs.existsSync(sourceFile)) throw new Error(`Missing TypeScript module: ${relative(sourceFile)}`)

    const source = fs.readFileSync(sourceFile, 'utf8')
    const dependencies = localSpecifiers(source).map((specifier) => ({
      specifier,
      file: resolveLocalModule(sourceFile, specifier),
    }))
    for (const dependency of dependencies) compile(dependency.file)

    let output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      fileName: sourceFile,
    }).outputText

    for (const dependency of dependencies) {
      output = replaceSpecifier(output, dependency.specifier, relativeImport(outputPath(sourceFile), outputPath(dependency.file)))
    }
    for (const specifier of externalSpecifiers(source)) {
      if (BUILT_INS.has(specifier)) continue
      output = replaceSpecifier(output, specifier, pathToFileURL(require.resolve(specifier)).href)
    }

    const destination = outputPath(sourceFile)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.writeFileSync(destination, output, 'utf8')
    compiled.set(sourceFile, destination)
    return destination
  }

  function outputPath(sourceFile) {
    const relativeFile = path.relative(root, sourceFile).replace(/\.tsx?$/, '.mjs')
    return path.join(outputRoot, relativeFile)
  }

  function relative(file) {
    return path.relative(root, file).split(path.sep).join('/')
  }
}

function importSpecifiers(source) {
  return [...new Set([...source.matchAll(/(?:from\s+|import\s*\()(['"])([^'"]+)\1/g)].map((match) => match[2]))]
}

function localSpecifiers(source) {
  return importSpecifiers(source).filter((specifier) => specifier.startsWith('.'))
}

function externalSpecifiers(source) {
  return importSpecifiers(source).filter((specifier) => !specifier.startsWith('.'))
}

function resolveLocalModule(importer, specifier) {
  const candidate = path.resolve(path.dirname(importer), specifier)
  const options = path.extname(candidate)
    ? [candidate]
    : [`${candidate}.ts`, `${candidate}.tsx`, path.join(candidate, 'index.ts')]
  const resolved = options.find((item) => fs.existsSync(item))
  if (!resolved) throw new Error(`Unable to resolve ${specifier} from ${importer}`)
  return resolved
}

function replaceSpecifier(source, original, replacement) {
  return source
    .replaceAll(`'${original}'`, `'${replacement}'`)
    .replaceAll(`"${original}"`, `"${replacement}"`)
}

function relativeImport(fromFile, toFile) {
  let value = path.relative(path.dirname(fromFile), toFile).split(path.sep).join('/')
  if (!value.startsWith('.')) value = `./${value}`
  return value
}

function isInsideOrEqual(root, candidate) {
  const relative = path.relative(root, candidate)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}
