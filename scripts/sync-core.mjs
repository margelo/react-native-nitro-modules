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
const core = path.join(root, 'core')
const packagePath = 'packages/react-native-nitro-modules'
// Only these directories and the license are owned by this command.
const directories = ['cpp', 'ios', 'android/src', 'src']
const git = (cwd, ...args) =>
  execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim()
const json = (file) => JSON.parse(readFileSync(file, 'utf8'))

if (!existsSync(path.join(core, packagePath, 'package.json'))) {
  throw new Error(
    'Initialize the pinned core checkout first: git submodule update --init --recursive'
  )
}
const pinned = git(root, 'ls-files', '--stage', 'core').split(/\s+/)[1]
if (git(core, 'rev-parse', 'HEAD') !== pinned) {
  throw new Error(
    'core differs from the pinned commit. Restore it with git submodule update, or stage an intentional update with git add core.'
  )
}
if (process.argv.includes('--check-clean')) {
  execFileSync('git', ['-C', core, 'diff', '--exit-code', 'HEAD'], {
    stdio: 'inherit',
  })
}
const version = json(path.join(root, packagePath, 'package.json')).version
const sourceVersion = json(path.join(core, packagePath, 'package.json')).version
const nitrogen = json(path.join(core, 'packages/nitrogen/package.json'))
const nitrogenVersion = nitrogen.version
if (nitrogen.dependencies['react-native-nitro-modules'] !== `^${version}`) {
  throw new Error('Nitrogen must depend on the matching runtime version.')
}
const nativeVersion = readFileSync(
  path.join(core, packagePath, 'cpp/utils/NitroDefines.hpp'),
  'utf8'
).match(/#define NITRO_VERSION "([^"]+)"/)?.[1]
if (
  [sourceVersion, nitrogenVersion, nativeVersion].some(
    (value) => value !== version
  )
) {
  throw new Error(
    'Wrapper, core, Nitrogen and NITRO_VERSION must match. Run bun update-core-version after pinning the core release commit.'
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
    ...directories.map((dir) => `${packagePath}/${dir}`),
  ],
  { encoding: 'utf8' }
)
  .split('\0')
  .filter(Boolean)
// Validate all inputs before removing stale output, and never copy checkout caches.
for (const dir of directories) {
  if (!files.some((file) => file.startsWith(`${packagePath}/${dir}/`)))
    throw new Error(`Missing shared source directory: ${dir}`)
}
for (const file of [...files, 'LICENSE']) {
  if (!lstatSync(path.join(core, file)).isFile())
    throw new Error(`Shared source must be a regular file: ${file}`)
}
const destination = path.join(root, packagePath)
for (const dir of directories)
  rmSync(path.join(destination, dir), { recursive: true, force: true })
for (const file of files) {
  const target = path.join(root, file)
  mkdirSync(path.dirname(target), { recursive: true })
  copyFileSync(path.join(core, file), target)
  chmodSync(target, lstatSync(path.join(core, file)).mode & 0o777)
}
copyFileSync(path.join(core, 'LICENSE'), path.join(destination, 'LICENSE'))
console.log(
  `Staged ${files.length} shared files from core ${pinned.slice(0, 12)} (${version}).`
)
