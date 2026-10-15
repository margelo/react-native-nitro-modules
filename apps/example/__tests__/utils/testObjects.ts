import { describe } from 'react-native-harness'
import { NitroModules } from 'react-native-nitro-modules'
import type {
  TestObjectCpp,
  TestObjectSwiftKotlin,
} from 'react-native-nitro-test'

export type TestObject = TestObjectCpp | TestObjectSwiftKotlin

/**
 * Both implementations of the `TestObject` spec. They share almost the entire
 * spec, so most tests run once against each of them.
 */
export const TEST_OBJECTS = [
  {
    name: 'TestObjectCpp',
    create: () =>
      NitroModules.createHybridObject<TestObjectCpp>('TestObjectCpp'),
  },
  {
    name: 'TestObjectSwiftKotlin',
    create: () =>
      NitroModules.createHybridObject<TestObjectSwiftKotlin>(
        'TestObjectSwiftKotlin'
      ),
  },
] as const

/**
 * Registers the tests in `fn` once per `TestObject` implementation.
 *
 * Each implementation gets its own `describe` named after the HybridObject
 * (`TestObjectCpp` / `TestObjectSwiftKotlin`), which is the immediate parent of
 * the tests - so `-t TestObjectCpp` runs only the C++ tests.
 *
 * Harness `describe` bodies must be synchronous, so `fn` must only register
 * tests and must not `await` anything.
 */
export function describeEachTestObject(
  name: string,
  fn: (testObject: TestObject) => void
): void {
  describe(name, () => {
    for (const { name: objectName, create } of TEST_OBJECTS) {
      describe(objectName, () => {
        fn(create())
      })
    }
  })
}
