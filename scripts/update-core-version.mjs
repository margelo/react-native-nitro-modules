import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => JSON.parse(readFileSync(path.join(root, file), 'utf8'))
const version = read(
  'packages/react-native-nitro-modules/nitro/packages/nitro-core/package.json'
).version
const nitrogen = read(
  'packages/react-native-nitro-modules/nitro/packages/nitrogen/package.json'
)
const nitrogenVersion = nitrogen.version
if (nitrogen.dependencies['nitro-core'] !== `^${version}`) {
  throw new Error('Nitrogen must depend on the matching nitro-core version.')
}
const jsVersion = readFileSync(
  path.join(
    root,
    'packages/react-native-nitro-modules/nitro/packages/nitro-core/js/version.ts'
  ),
  'utf8'
).match(/^export const version = '([^']+)'$/m)?.[1]
const nativeVersion = readFileSync(
  path.join(
    root,
    'packages/react-native-nitro-modules/nitro/packages/nitro-core/cpp/utils/NitroDefines.hpp'
  ),
  'utf8'
).match(/#define NITRO_VERSION "([^"]+)"/)?.[1]
if (
  [nitrogenVersion, jsVersion, nativeVersion].some((value) => value !== version)
) {
  throw new Error(
    'Update the authoritative package versions, embedded JS version and NITRO_VERSION in nitro first, then commit and pin that core revision.'
  )
}
for (const file of [
  'package.json',
  'packages/react-native-nitro-modules/package.json',
  'packages/react-native-nitro-test/package.json',
  'packages/react-native-nitro-test-external/package.json',
  'apps/example/package.json',
]) {
  const pkg = read(file)
  const usesCore =
    file === 'packages/react-native-nitro-modules/package.json' ||
    file === 'apps/example/package.json'
  if (process.argv.includes('--check')) {
    if (
      pkg.version !== version ||
      (usesCore && pkg.dependencies?.['nitro-core'] !== version)
    )
      throw new Error(
        `${file} must use core version ${version}. Run bun update-core-version.`
      )
  } else {
    pkg.version = version
    if (usesCore)
      pkg.dependencies = { ...pkg.dependencies, 'nitro-core': version }
    writeFileSync(path.join(root, file), `${JSON.stringify(pkg, null, 2)}\n`)
  }
}
