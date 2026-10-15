import { describe, expect, it } from 'react-native-harness'
import { NitroModules } from 'react-native-nitro-modules'
import type {
  Base,
  Child,
  Powertrain,
  TestObjectCpp,
  TestObjectSwiftKotlin,
} from 'react-native-nitro-test'
import { HybridSomeExternalObject } from 'react-native-nitro-test-external'
import { TEST_CUSTOM_TYPE, TEST_PERSON } from './utils/fixtures'
import { debugOnly, itIf } from './utils/helpers'

// `rawJsiFunc` is registered as a raw JSI method in `HybridTestObjectCpp.hpp`,
// so it is not part of the `TestObjectCpp` spec.
interface WithRawJsiFunc {
  rawJsiFunc(...args: unknown[]): unknown
}

const POWERTRAINS: Powertrain[] = ['electric', 'gas', 'hybrid']
const IS_DEBUG = NitroModules.buildType === 'debug'

describe('C++ only', () => {
  describe('TestObjectCpp', () => {
    const testObject =
      NitroModules.createHybridObject<TestObjectCpp>('TestObjectCpp')
    const swiftKotlinObject =
      NitroModules.createHybridObject<TestObjectSwiftKotlin>(
        'TestObjectSwiftKotlin'
      )
    const rawObject = testObject as TestObjectCpp & WithRawJsiFunc

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
      const result = rawObject.rawJsiFunc(55, false, 'hello', { obj: true })
      expect(result).toEqual([55, false, 'hello', { obj: true }])
    })

    it('getVariantHybridEnum(...) bounces a HybridObject', () => {
      expect(testObject.getVariantHybridEnum(testObject)).toBe(testObject)
    })

    it('getVariantHybridEnum(...) bounces every Powertrain', () => {
      for (const powertrain of POWERTRAINS) {
        expect(testObject.getVariantHybridEnum(powertrain), powertrain).toBe(
          powertrain
        )
      }
    })

    it('getVariantHybridEnum(...) throws for an unknown string', () => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantHybridEnum('diesel')
      ).toThrow(
        `${testObject.name}.getVariantHybridEnum(...): Cannot convert "diesel" to any type in ${debugOnly('variant<std::shared_ptr<margelo::nitro::test::HybridTestObjectCppSpec>, margelo::nitro::test::Powertrain>!')}`
      )
    })

    it('getVariantHybridEnum(...) throws for a TestObjectSwiftKotlin', () => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantHybridEnum(swiftKotlinObject)
      ).toThrow(
        `${testObject.name}.getVariantHybridEnum(...): Cannot convert "${String(swiftKotlinObject)}" to any type in `
      )
    })

    it('getVariantHybridEnum(...) throws for a Person', () => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantHybridEnum(TEST_PERSON)
      ).toThrow(
        `${testObject.name}.getVariantHybridEnum(...): Cannot convert "[object Object]" to any type in `
      )
    })

    it('getVariantTuple(...) checks every item, not just the first', () => {
      expect(() =>
        testObject.getVariantTuple(
          // @ts-expect-error
          [10, 'twenty']
        )
      ).toThrow(
        `${testObject.name}.getVariantTuple(...): Cannot convert "10,twenty" to any type in `
      )
    })

    it('getVariantTuple(...) throws for an empty array', () => {
      expect(() =>
        // @ts-expect-error
        testObject.getVariantTuple([])
      ).toThrow(
        `${testObject.name}.getVariantTuple(...): Cannot convert "" to any type in `
      )
    })

    it('getVariantTuple(...) keeps NaN and Infinity', () => {
      expect(testObject.getVariantTuple([NaN, Infinity])).toEqual([
        NaN,
        Infinity,
      ])
    })

    it('someTuple roundtrips NaN and an empty string', () => {
      testObject.someTuple = [NaN, '']
      expect(testObject.someTuple).toEqual([NaN, ''])
    })

    it('someTuple throws for 1 item', () => {
      const setOneItem = () => {
        // @ts-expect-error
        testObject.someTuple = [55]
      }
      expect(setOneItem).toThrow(
        `${testObject.name}.someTuple: The given JS Array has 1 items, but ${debugOnly('std::tuple<double, std::string>')}`
      )
      expect(setOneItem).toThrow('expects 2 items')
    })

    it('someTuple throws for a number in place of the string', () => {
      expect(() => {
        // @ts-expect-error
        testObject.someTuple = [55, 66]
      }).toThrow(
        `${testObject.name}.someTuple: Value is a number, expected a String`
      )
    })

    it('someTuple keeps its value after a failed set', () => {
      testObject.someTuple = [13, 'before']
      expect(() => {
        // @ts-expect-error
        testObject.someTuple = [55, 66]
      }).toThrow(`${testObject.name}.someTuple: `)
      expect(testObject.someTuple).toEqual([13, 'before'])
    })

    it('flip(...) keeps NaN, Infinity and -0', () => {
      expect(testObject.flip([NaN, Infinity, -0])).toEqual([-0, Infinity, NaN])
    })

    it('flip(...) throws for 4 items', () => {
      const flipFourItems = () =>
        testObject.flip(
          // @ts-expect-error
          [1, 2, 3, 4]
        )
      expect(flipFourItems).toThrow(
        `${testObject.name}.flip(...): The given JS Array has 4 items, but ${debugOnly('std::tuple<double, double, double>')}`
      )
      expect(flipFourItems).toThrow('expects 3 items')
    })

    it('flip(...) throws for an empty array', () => {
      expect(() =>
        // @ts-expect-error
        testObject.flip([])
      ).toThrow(`${testObject.name}.flip(...): The given JS Array has 0 items`)
    })

    it('flip(...) throws for a string item', () => {
      expect(() =>
        testObject.flip(
          // @ts-expect-error
          [1, 'two', 3]
        )
      ).toThrow(
        `${testObject.name}.flip(...): Value is a string, expected a number`
      )
    })

    it('flip(...) throws for a non-array object', () => {
      expect(() =>
        // @ts-expect-error
        testObject.flip({ 0: 1, 1: 2, 2: 3, length: 3 })
      ).toThrow(
        `${testObject.name}.flip(...): Object is an object, expected an array`
      )
    })

    it('flip(...) throws for a string', () => {
      expect(() =>
        // @ts-expect-error
        testObject.flip('abc')
      ).toThrow(
        `${testObject.name}.flip(...): Value is a string, expected an Object`
      )
    })

    it('passTuple(...) bounces falsy values', () => {
      expect(testObject.passTuple([0, '', false])).toEqual([0, '', false])
    })

    it('passTuple(...) throws for a string in place of the boolean', () => {
      expect(() =>
        testObject.passTuple(
          // @ts-expect-error
          [13, 'hello', 'true']
        )
      ).toThrow(
        `${testObject.name}.passTuple(...): Value is a string, expected a boolean`
      )
    })

    it('passTuple(...) throws for a number in place of the string', () => {
      expect(() =>
        testObject.passTuple(
          // @ts-expect-error
          [13, 42, true]
        )
      ).toThrow(
        `${testObject.name}.passTuple(...): Value is a number, expected a String`
      )
    })

    it('passTuple(...) throws for 4 items', () => {
      const passFourItems = () =>
        testObject.passTuple(
          // @ts-expect-error
          [13, 'hello', true, 'extra']
        )
      expect(passFourItems).toThrow(
        `${testObject.name}.passTuple(...): The given JS Array has 4 items, but ${debugOnly('std::tuple<double, std::string, bool>')}`
      )
      expect(passFourItems).toThrow('expects 3 items')
    })

    it('bounceCustomType(...) bounces an empty string', () => {
      expect(testObject.bounceCustomType('')).toBe('')
    })

    it('bounceCustomType(...) bounces a unicode string', () => {
      expect(testObject.bounceCustomType('héllo 👋 世界')).toBe('héllo 👋 世界')
    })

    it('bounceCustomType(...) keeps an embedded NUL character', () => {
      expect(testObject.bounceCustomType('a\0b')).toBe('a\0b')
    })

    it('bounceCustomType(...) throws for a number', () => {
      expect(() =>
        // @ts-expect-error
        testObject.bounceCustomType(55)
      ).toThrow(
        `${testObject.name}.bounceCustomType(...): Value is a number, expected a String`
      )
    })

    it('bounceAnyHybrid(...) bounces itself', () => {
      expect(testObject.bounceAnyHybrid(testObject)).toBe(testObject)
    })

    it('bounceAnyHybrid(...) bounces a TestObjectSwiftKotlin', () => {
      expect(testObject.bounceAnyHybrid(swiftKotlinObject)).toBe(
        swiftKotlinObject
      )
    })

    it('bounceAnyHybrid(...) bounces a C++ Child', () => {
      const child = testObject.createChild()
      expect(testObject.bounceAnyHybrid(child)).toBe(child)
    })

    it('bounceAnyHybrid(...) bounces a Swift/Kotlin Child', () => {
      const child = NitroModules.createHybridObject<Child>('Child')
      expect(testObject.bounceAnyHybrid(child)).toBe(child)
    })

    it('bounceAnyHybrid(...) bounces a Swift/Kotlin Base', () => {
      const base = NitroModules.createHybridObject<Base>('Base')
      expect(testObject.bounceAnyHybrid(base)).toBe(base)
    })

    it('bounceAnyHybrid(...) throws for a plain object', () => {
      expect(() =>
        // @ts-expect-error
        testObject.bounceAnyHybrid({})
      ).toThrow(
        `${testObject.name}.bounceAnyHybrid(...): Cannot convert "[object Object]" to NativeState<${debugOnly('margelo::nitro::HybridObject>! It does not have a NativeState!')}`
      )
    })

    itIf(IS_DEBUG)('bounceAnyHybrid(...) throws for undefined', () => {
      expect(() =>
        // @ts-expect-error
        testObject.bounceAnyHybrid(undefined)
      ).toThrow(
        `${testObject.name}.bounceAnyHybrid(...): Cannot convert "undefined" to NativeState<margelo::nitro::HybridObject>! It is undefined!`
      )
    })

    it('rawJsiFunc() returns an empty array without arguments', () => {
      expect(rawObject.rawJsiFunc()).toEqual([])
    })

    it('rawJsiFunc(...) keeps undefined and null arguments', () => {
      expect(rawObject.rawJsiFunc(undefined, null)).toStrictEqual([
        undefined,
        null,
      ])
    })

    it('rawJsiFunc(...) passes objects by reference', () => {
      const object = { some: 'object' }
      const [result] = rawObject.rawJsiFunc(object) as unknown[]
      expect(result).toBe(object)
    })

    it('rawJsiFunc(...) passes functions by reference', () => {
      const func = () => {}
      const [result] = rawObject.rawJsiFunc(func) as unknown[]
      expect(result).toBe(func)
    })

    itIf(IS_DEBUG)(
      'rawJsiFunc(...) throws for a `this` without NativeState',
      () => {
        expect(() => rawObject.rawJsiFunc.call({})).toThrow(
          'Cannot call hybrid function `HybridTestObjectCpp.rawJsiFunc(...)` - `this` does not have a NativeState!'
        )
      }
    )

    itIf(IS_DEBUG)(
      'rawJsiFunc(...) throws for a different HybridObject as `this`',
      () => {
        expect(() =>
          rawObject.rawJsiFunc.call(HybridSomeExternalObject)
        ).toThrow(
          "Cannot call hybrid function `HybridTestObjectCpp.rawJsiFunc(...)` - `this` has a NativeState, but it's the wrong type!"
        )
      }
    )
  })
})
