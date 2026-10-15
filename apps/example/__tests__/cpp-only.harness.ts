import { describe, expect, it } from 'react-native-harness'
import { NitroModules } from 'react-native-nitro-modules'
import type { TestObjectCpp } from 'react-native-nitro-test'
import { HybridSomeExternalObject } from 'react-native-nitro-test-external'
import { TEST_CUSTOM_TYPE } from './utils/fixtures'
import { debugOnly } from './utils/helpers'

// `rawJsiFunc` is registered as a raw JSI method in `HybridTestObjectCpp.hpp`,
// so it is not part of the `TestObjectCpp` spec.
interface WithRawJsiFunc {
  rawJsiFunc(...args: unknown[]): unknown
}

describe('C++ only', () => {
  describe('TestObjectCpp', () => {
    const testObject =
      NitroModules.createHybridObject<TestObjectCpp>('TestObjectCpp')

    it('getVariantTuple(...) converts Float2', () => {
      expect(testObject.getVariantTuple([10, 20])).toEqual([10, 20])
    })

    it('getVariantTuple(...) converts Float3', () => {
      expect(testObject.getVariantTuple([10, 20, 30])).toEqual([10, 20, 30])
    })

    it('getVariantTuple(...) throws at wrong size (5 items)', () => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantTuple([10, 20, 30, 40, 50])
      ).toThrow(`${testObject.name}.getVariantTuple(...): Cannot convert`)
    })

    it('getVariantTuple(...) throws at wrong type (string)', () => {
      // @ts-expect-error
      expect(() => testObject.getVariantTuple('hello')).toThrow(
        `${testObject.name}.getVariantTuple(...): Cannot convert`
      )
    })

    it('getVariantTuple(...) throws at wrong type (string[])', () => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantTuple(['hello', 'world'])
      ).toThrow(`${testObject.name}.getVariantTuple(...): Cannot convert`)
    })

    it("someTuple roundtrips [55, 'hello']", () => {
      testObject.someTuple = [55, 'hello']
      expect(testObject.someTuple).toEqual([55, 'hello'])
    })

    it('flip([10, 20, 30]) reverses the tuple', () => {
      expect(testObject.flip([10, 20, 30])).toEqual([30, 20, 10])
    })

    it('flip([10, 20]) throws at wrong size', () => {
      const flipTwoItems = () =>
        testObject.flip(
          // @ts-expect-error
          [10, 20]
        )
      expect(flipTwoItems).toThrow(
        `${testObject.name}.flip(...): The given JS Array has 2 items, but ${debugOnly('std::tuple<double, double, double>')}`
      )
      expect(flipTwoItems).toThrow('expects 3 items')
    })

    it('passTuple(...) returns the same tuple', () => {
      expect(testObject.passTuple([13, 'hello', true])).toEqual([
        13,
        'hello',
        true,
      ])
    })

    it('bounceCustomType(...) returns the same value', () => {
      expect(testObject.bounceCustomType(TEST_CUSTOM_TYPE)).toBe(
        TEST_CUSTOM_TYPE
      )
    })

    it('bounceAnyHybrid(...) returns the same object', () => {
      expect(testObject.bounceAnyHybrid(HybridSomeExternalObject)).toBe(
        HybridSomeExternalObject
      )
    })

    it('bounceAnyHybrid(...) result does not equal a different object', () => {
      const external = testObject.bounceAnyHybrid(HybridSomeExternalObject)
      expect(external.equals(testObject)).toBe(false)
    })

    it('rawJsiFunc(...) returns its arguments as an array', () => {
      const result = (testObject as TestObjectCpp & WithRawJsiFunc).rawJsiFunc(
        55,
        false,
        'hello',
        { obj: true }
      )
      expect(result).toEqual([55, false, 'hello', { obj: true }])
    })
  })
})
