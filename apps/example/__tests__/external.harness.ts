import { describe, expect, it } from 'react-native-harness'
import { HybridSomeExternalObject } from 'react-native-nitro-test-external'
import { describeEachTestObject } from './utils/testObjects'

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
