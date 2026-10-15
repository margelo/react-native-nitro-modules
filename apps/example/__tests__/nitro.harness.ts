import { describe, expect, it } from 'react-native-harness'
import {
  getHybridObjectConstructor,
  NitroModules,
} from 'react-native-nitro-modules'
import {
  getHybridObjectConstructor as getCoreHybridObjectConstructor,
  getInstalledNitro,
  NitroModules as CoreNitroModules,
} from 'nitro-core'
import type {
  TestObjectCpp,
  TestObjectSwiftKotlin,
} from 'react-native-nitro-test'
import { getTests } from '../src/getTests'
import { harnessBackend } from '../src/testing/backends/harness'

function createTestRunner(
  testObject: TestObjectCpp | TestObjectSwiftKotlin
): () => void {
  return () => {
    const tests = getTests(testObject, { backend: harnessBackend })
    for (const test of tests) {
      it(test.name, async () => {
        const result = await test.run()
        if (result.status === 'failed') {
          throw new Error(result.message)
        }
      })
    }
  }
}

const testObjectCpp =
  NitroModules.createHybridObject<TestObjectCpp>('TestObjectCpp')
const testObjectSwiftKotlin =
  NitroModules.createHybridObject<TestObjectSwiftKotlin>(
    'TestObjectSwiftKotlin'
  )

describe('nitro-core integration', () => {
  it('shares the installed native proxy and constructor helper with React Native', () => {
    expect(getInstalledNitro()).toBe(NitroModules)
    expect(CoreNitroModules).toBe(NitroModules)
    expect(getCoreHybridObjectConstructor).toBe(getHybridObjectConstructor)
  })
})

describe('TestObject (C++)', createTestRunner(testObjectCpp))
describe('TestObject (Swift/Kotlin)', createTestRunner(testObjectSwiftKotlin))
