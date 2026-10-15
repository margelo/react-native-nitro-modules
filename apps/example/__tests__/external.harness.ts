import { describe, expect, fn, it } from 'react-native-harness'
import { NitroModules } from 'react-native-nitro-modules'
import { HybridSomeExternalObject } from 'react-native-nitro-test-external'
import { debugOnly, itIf } from './utils/helpers'
import { describeEachTestObject } from './utils/testObjects'

const IS_DEBUG = NitroModules.buildType === 'debug'
const INT64_MIN = -(2n ** 63n)
const INT64_MAX = 2n ** 63n - 1n
const UINT64_MAX = 2n ** 64n - 1n

// `toStrictEqual` so the empty optionals have to be present as `undefined` keys.
describe('SomeExternalObject optional primitives', () => {
  it('createOptionalPrimitivesHolder(5) only sets optionalNumber', () => {
    expect(
      HybridSomeExternalObject.createOptionalPrimitivesHolder(5)
    ).toStrictEqual({
      optionalNumber: 5,
      optionalBoolean: undefined,
      optionalUInt64: undefined,
      optionalInt64: undefined,
    })
  })

  it('createOptionalPrimitivesHolder(undefined, true) only sets optionalBoolean', () => {
    expect(
      HybridSomeExternalObject.createOptionalPrimitivesHolder(undefined, true)
    ).toStrictEqual({
      optionalNumber: undefined,
      optionalBoolean: true,
      optionalUInt64: undefined,
      optionalInt64: undefined,
    })
  })

  it('createOptionalPrimitivesHolder() leaves every field undefined', () => {
    expect(
      HybridSomeExternalObject.createOptionalPrimitivesHolder()
    ).toStrictEqual({
      optionalNumber: undefined,
      optionalBoolean: undefined,
      optionalUInt64: undefined,
      optionalInt64: undefined,
    })
  })

  it('createOptionalPrimitivesHolder(5, true, 7n, 13n) sets every field', () => {
    expect(
      HybridSomeExternalObject.createOptionalPrimitivesHolder(5, true, 7n, 13n)
    ).toStrictEqual({
      optionalNumber: 5,
      optionalBoolean: true,
      optionalUInt64: 7n,
      optionalInt64: 13n,
    })
  })

  it('createOptionalPrimitivesHolder(0, false, 0n, 0n) keeps falsy values', () => {
    expect(
      HybridSomeExternalObject.createOptionalPrimitivesHolder(0, false, 0n, 0n)
    ).toStrictEqual({
      optionalNumber: 0,
      optionalBoolean: false,
      optionalUInt64: 0n,
      optionalInt64: 0n,
    })
  })

  it('createOptionalPrimitivesHolder(...) keeps UInt64 max and Int64 min', () => {
    const holder = HybridSomeExternalObject.createOptionalPrimitivesHolder(
      undefined,
      undefined,
      UINT64_MAX,
      INT64_MIN
    )
    expect(holder.optionalUInt64).toBe(UINT64_MAX)
    expect(holder.optionalInt64).toBe(INT64_MIN)
  })

  it('createOptionalPrimitivesHolder(...) keeps Int64 max', () => {
    expect(
      HybridSomeExternalObject.createOptionalPrimitivesHolder(
        undefined,
        undefined,
        undefined,
        INT64_MAX
      ).optionalInt64
    ).toBe(INT64_MAX)
  })
})

describe('SomeExternalObject', () => {
  it('getValue() returns "Hello world!"', () => {
    expect(HybridSomeExternalObject.getValue()).toBe('Hello world!')
  })

  it('name is "SomeExternalObject"', () => {
    expect(HybridSomeExternalObject.name).toBe('SomeExternalObject')
  })

  it('toString() is "[HybridObject SomeExternalObject]"', () => {
    expect(HybridSomeExternalObject.toString()).toBe(
      '[HybridObject SomeExternalObject]'
    )
  })
})

describeEachTestObject('External HybridObjects', (testObject) => {
  it('bounceExternalHybrid(...) returns the same object', () => {
    expect(testObject.bounceExternalHybrid(HybridSomeExternalObject)).toBe(
      HybridSomeExternalObject
    )
  })

  it('bounceExternalStruct(...) returns the same struct', () => {
    const result = testObject.bounceExternalStruct({
      someExternal: HybridSomeExternalObject,
    })
    expect(Object.keys(result)).toEqual(['someExternal'])
    expect(result.someExternal).toBe(HybridSomeExternalObject)
  })

  it('bounceExternalVariant(...) returns a string', () => {
    expect(testObject.bounceExternalVariant('Hello!')).toBe('Hello!')
  })

  it('bounceExternalVariant(...) returns an external object', () => {
    expect(testObject.bounceExternalVariant(HybridSomeExternalObject)).toBe(
      HybridSomeExternalObject
    )
  })

  it('createExternalVariantFromFunc(...) returns the factory result', () => {
    const factory = () => HybridSomeExternalObject
    expect(testObject.createExternalVariantFromFunc(factory)).toBe(
      HybridSomeExternalObject
    )
  })

  it('createInternalObject() returns a subclass that overrides getValue()', () => {
    const object = testObject.createInternalObject()
    expect(object).not.toBe(HybridSomeExternalObject)
    expect(object.getValue()).toBe('This is overridden!')
  })
})

describeEachTestObject('External HybridObject subclasses', (testObject) => {
  it('createInternalObject() is named "SomeExternalObject"', () => {
    expect(testObject.createInternalObject().name).toBe('SomeExternalObject')
  })

  it('createInternalObject() returns a new object every call', () => {
    expect(testObject.createInternalObject()).not.toBe(
      testObject.createInternalObject()
    )
  })

  it('createInternalObject() implements createOptionalPrimitivesHolder(...)', () => {
    expect(
      testObject
        .createInternalObject()
        .createOptionalPrimitivesHolder(1.5, false, 2n, -3n)
    ).toStrictEqual({
      optionalNumber: 1.5,
      optionalBoolean: false,
      optionalUInt64: 2n,
      optionalInt64: -3n,
    })
  })

  it('bounceExternalHybrid(createInternalObject()) returns the same object', () => {
    const internal = testObject.createInternalObject()
    expect(testObject.bounceExternalHybrid(internal)).toBe(internal)
  })

  it('bounceExternalVariant(createInternalObject()) returns the same object', () => {
    const internal = testObject.createInternalObject()
    expect(testObject.bounceExternalVariant(internal)).toBe(internal)
  })

  it('bounceExternalStruct(...) keeps an internal object', () => {
    const internal = testObject.createInternalObject()
    expect(
      testObject.bounceExternalStruct({ someExternal: internal }).someExternal
    ).toBe(internal)
  })

  it('createExternalVariantFromFunc(...) returns an internal object', () => {
    const internal = testObject.createInternalObject()
    expect(testObject.createExternalVariantFromFunc(() => internal)).toBe(
      internal
    )
  })
})

describeEachTestObject('External HybridObject conversions', (testObject) => {
  it('createExternalVariantFromFunc(...) calls the factory once', () => {
    const factory = fn(() => HybridSomeExternalObject)
    testObject.createExternalVariantFromFunc(factory)
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('bounceExternalVariant(number) throws', () => {
    // @ts-expect-error - a number is neither a string nor a SomeExternalObject
    expect(() => testObject.bounceExternalVariant(55)).toThrow(
      `${testObject.name}.bounceExternalVariant(...): Cannot convert "55" to any type in variant<${debugOnly('std::shared_ptr<margelo::nitro::test::external::HybridSomeExternalObjectSpec>, std::string>!')}`
    )
  })

  it('bounceExternalVariant(another HybridObject type) throws', () => {
    // @ts-expect-error - a TestObject is not a SomeExternalObject
    expect(() => testObject.bounceExternalVariant(testObject)).toThrow(
      `Cannot convert "[HybridObject ${testObject.name}]" to any type in variant<`
    )
  })

  itIf(IS_DEBUG)(
    'bounceExternalHybrid(another HybridObject type) throws',
    () => {
      // @ts-expect-error - a TestObject is not a SomeExternalObject
      expect(() => testObject.bounceExternalHybrid(testObject)).toThrow(
        'Downcasting failed - It has a different NativeState<T>!'
      )
    }
  )

  itIf(IS_DEBUG)(
    'bounceExternalHybrid({}) throws because it has no NativeState',
    () => {
      // @ts-expect-error - a plain object is not a SomeExternalObject
      const bouncePlainObject = () => testObject.bounceExternalHybrid({})
      expect(bouncePlainObject).toThrow(
        `${testObject.name}.bounceExternalHybrid(...)`
      )
      expect(bouncePlainObject).toThrow('It does not have a NativeState!')
    }
  )

  itIf(IS_DEBUG)(
    'bounceExternalStruct({}) throws for the missing object',
    () => {
      // @ts-expect-error - `someExternal` is missing
      expect(() => testObject.bounceExternalStruct({})).toThrow(
        'It is undefined!'
      )
    }
  )
})
