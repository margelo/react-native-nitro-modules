// Must run before anything imports react-native-harness (and chai).
import './polyfills'
import { getTestCollector } from 'react-native-harness'
// Same setup the Harness CLI runs before every test file (setupFilesAfterEnv).
import '../../__tests__/setup/setupAfterEnv'

/**
 * A minimal runner for the Harness tests in `__tests__`, so they can be run
 * from the example app without the Harness CLI.
 *
 * It only supports what these tests use: `describe` and `it` (incl. `.skip`,
 * `.only` and `.todo`). Hooks and the test context (`skip`, `onTestFinished`,
 * ...) are not supported - tests that need them only run in the Harness CLI.
 */

type CollectionResult = Awaited<
  ReturnType<ReturnType<typeof getTestCollector>['collect']>
>
type TestSuite = CollectionResult['testSuite']
type TestCase = TestSuite['tests'][number]
type TestContext = Parameters<TestCase['fn']>[0]

/** Harness has no per-test timeout, so this applies to every test. */
const TEST_TIMEOUT_MS = 30_000

// The same files as `testMatch` in jest.harness.config.mjs, except for the UI
// tests (`*.harness.tsx`): they mount components with Harness' `render()`,
// which only works in the Harness CLI.
const testModules = require.context('../../__tests__', true, /\.harness\.ts$/)

export type TestStatus = 'passed' | 'failed' | 'skipped' | 'todo'

export interface InAppTest {
  id: string
  file: string
  ancestorTitles: string[]
  name: string
  testCase: TestCase
  /** Whether this test or one of its suites registers hooks. */
  usesHooks: boolean
}

export interface InAppTestFile {
  file: string
  tests: InAppTest[]
  loadError?: string
}

export interface InAppTestResult {
  status: TestStatus
  durationMs: number
  message?: string
}

const UNSUPPORTED_MESSAGE =
  'not supported in the example app - run this test with the Harness CLI.'

// Spy matcher messages from @vitest/expect are colored with ANSI escape codes.
// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g

function errorToString(error: unknown): string {
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  return message.replace(ANSI_PATTERN, '')
}

function hasHooks(suite: TestSuite): boolean {
  return (
    suite.beforeAll.length > 0 ||
    suite.afterAll.length > 0 ||
    suite.beforeEach.length > 0 ||
    suite.afterEach.length > 0
  )
}

function flattenTests(
  file: string,
  suite: TestSuite,
  ancestorTitles: string[] = [],
  ancestorsUseHooks = false
): InAppTest[] {
  const usesHooks = ancestorsUseHooks || hasHooks(suite)
  const tests = suite.tests.map((testCase) => ({
    id: `${file}::${[...ancestorTitles, testCase.name].join(' › ')}`,
    file,
    ancestorTitles,
    name: testCase.name,
    testCase,
    usesHooks,
  }))
  const nested = suite.suites.flatMap((child) =>
    flattenTests(file, child, [...ancestorTitles, child.name], usesHooks)
  )
  return [...tests, ...nested]
}

let collection: Promise<InAppTestFile[]> | undefined

/**
 * Collects all test files. Each file is evaluated only once per JS runtime (a
 * second `require` would hit Metro's module cache and register nothing), and
 * one after another because the collector state is global.
 */
export function collectTests(): Promise<InAppTestFile[]> {
  collection ??= (async () => {
    const files: InAppTestFile[] = []
    for (const file of testModules.keys()) {
      const collector = getTestCollector()
      try {
        const { testSuite } = await collector.collect(() => {
          testModules(file)
        }, file)
        files.push({ file, tests: flattenTests(file, testSuite) })
      } catch (error) {
        files.push({ file, tests: [], loadError: errorToString(error) })
      } finally {
        collector.dispose()
      }
    }
    return files
  })()
  return collection
}

// A test that uses the test context fails with a clear message.
const unsupportedContext = new Proxy({} as TestContext, {
  get(_, property) {
    throw new Error(
      `The test context (\`${String(property)}\`) is ${UNSUPPORTED_MESSAGE}`
    )
  },
})

function withTimeout(promise: Promise<void>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Test timed out after ${ms}ms`)),
      ms
    )
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

// Tests share HybridObjects and global state, so only one runs at a time.
let queue: Promise<unknown> = Promise.resolve()

/**
 * Runs a single test. Tests marked with `.skip` (and siblings of `.only`)
 * stay skipped - some of them are known to crash the app.
 */
export function runTest(test: InAppTest): Promise<InAppTestResult> {
  const run = queue.then(async (): Promise<InAppTestResult> => {
    const { status, fn } = test.testCase
    if (status !== 'active') {
      return { status, durationMs: 0 }
    }
    if (test.usesHooks) {
      return {
        status: 'failed',
        durationMs: 0,
        message: `Hooks are ${UNSUPPORTED_MESSAGE}`,
      }
    }
    const start = performance.now()
    try {
      await withTimeout(
        Promise.resolve().then(() => fn(unsupportedContext)),
        TEST_TIMEOUT_MS
      )
      return {
        status: 'passed',
        durationMs: Math.round(performance.now() - start),
      }
    } catch (error) {
      return {
        status: 'failed',
        durationMs: Math.round(performance.now() - start),
        message: errorToString(error),
      }
    }
  })
  queue = run.catch(() => {})
  return run
}
