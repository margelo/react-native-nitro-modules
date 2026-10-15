import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => JSON.parse(readFileSync(path.join(root, file), 'utf8'))
const version = read(
  'core/packages/react-native-nitro-modules/package.json'
).version
const nitrogen = read('core/packages/nitrogen/package.json')
const nitrogenVersion = nitrogen.version
if (nitrogen.dependencies['react-native-nitro-modules'] !== `^${version}`) {
  throw new Error('Nitrogen must depend on the matching runtime version.')
}
const nativeVersion = readFileSync(
  path.join(
    root,
    'core/packages/react-native-nitro-modules/cpp/utils/NitroDefines.hpp'
  ),
  'utf8'
).match(/#define NITRO_VERSION "([^"]+)"/)?.[1]
if (version !== nitrogenVersion || version !== nativeVersion) {
  throw new Error(
    'Update the authoritative package versions and NITRO_VERSION in nitro first, then commit and pin that core revision.'
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
  if (process.argv.includes('--check')) {
    if (pkg.version !== version)
      throw new Error(
        `${file} must use core version ${version}. Run bun update-core-version.`
      )
  } else {
    pkg.version = version
    writeFileSync(path.join(root, file), `${JSON.stringify(pkg, null, 2)}\n`)
  }
}
