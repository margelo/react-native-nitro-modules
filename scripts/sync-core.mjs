import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const submodulePath = 'packages/react-native-nitro-modules/nitro'
const core = path.join(root, submodulePath)
const packagePath = 'packages/react-native-nitro-modules'
// Only these directories and the license are owned by this command.
const directories = [
  { source: 'packages/nitro-core/cpp', destination: 'cpp' },
  { source: 'packages/nitro-core/apple', destination: 'ios' },
  { source: 'packages/nitro-core/android/src', destination: 'android/src' },
]
const git = (cwd, ...args) =>
  execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim()
const json = (file) => JSON.parse(readFileSync(file, 'utf8'))

if (!existsSync(path.join(core, 'packages/nitro-core/package.json'))) {
  throw new Error(
    'Initialize the pinned core checkout first: git submodule update --init --recursive'
  )
}
const pinned = git(root, 'ls-files', '--stage', submodulePath).split(/\s+/)[1]
if (git(core, 'rev-parse', 'HEAD') !== pinned) {
  throw new Error(
    'core differs from the pinned commit. Restore it with git submodule update, or stage an intentional update with git add packages/react-native-nitro-modules/nitro.'
  )
}
if (process.argv.includes('--check-clean')) {
  execFileSync('git', ['-C', core, 'diff', '--exit-code', 'HEAD'], {
    stdio: 'inherit',
  })
}
const version = json(path.join(root, packagePath, 'package.json')).version
const nitrogen = json(path.join(core, 'packages/nitrogen/package.json'))
const nitrogenVersion = nitrogen.version
const coreVersion = json(
  path.join(core, 'packages/nitro-core/package.json')
).version
const jsVersion = readFileSync(
  path.join(core, 'packages/nitro-core/js/version.ts'),
  'utf8'
).match(/^export const version = '([^']+)'$/m)?.[1]
const wrapper = json(path.join(root, packagePath, 'package.json'))
if (
  nitrogen.dependencies['nitro-core'] !== `^${version}` ||
  wrapper.dependencies['nitro-core'] !== version
) {
  throw new Error(
    'Nitrogen and the RN package must depend on the matching nitro-core version.'
  )
}
const nativeVersion = readFileSync(
  path.join(core, 'packages/nitro-core/cpp/utils/NitroDefines.hpp'),
  'utf8'
).match(/#define NITRO_VERSION "([^"]+)"/)?.[1]
if (
  [coreVersion, nitrogenVersion, jsVersion, nativeVersion].some(
    (value) => value !== version
  )
) {
  throw new Error(
    'Wrapper, core, Nitrogen, embedded JS version and NITRO_VERSION must match. Run bun update-core-version after pinning the core release commit.'
  )
}
const files = execFileSync(
  'git',
  [
    '-C',
    core,
    'ls-files',
    '-z',
    '--',
    ...directories.map(({ source }) => source),
  ],
  { encoding: 'utf8' }
)
  .split('\0')
  .filter(Boolean)
// Validate all inputs before removing stale output, and never copy checkout caches.
for (const { source } of directories) {
  if (!files.some((file) => file.startsWith(`${source}/`)))
    throw new Error(`Missing shared source directory: ${source}`)
}
for (const file of [...files, 'LICENSE']) {
  if (!lstatSync(path.join(core, file)).isFile())
    throw new Error(`Shared source must be a regular file: ${file}`)
}
const destination = path.join(root, packagePath)
for (const { destination: dir } of directories)
  rmSync(path.join(destination, dir), { recursive: true, force: true })
for (const file of files) {
  const mapping = directories.find(({ source }) =>
    file.startsWith(`${source}/`)
  )
  const relative = path.relative(mapping.source, file)
  const target = path.join(destination, mapping.destination, relative)
  mkdirSync(path.dirname(target), { recursive: true })
  copyFileSync(path.join(core, file), target)
  chmodSync(target, lstatSync(path.join(core, file)).mode & 0o777)
}
copyFileSync(path.join(core, 'LICENSE'), path.join(destination, 'LICENSE'))
console.log(
  `Staged ${files.length} shared files from core ${pinned.slice(0, 12)} (${version}).`
)
