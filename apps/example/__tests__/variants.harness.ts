import { expect, fn, it, waitFor } from 'react-native-harness'
import { NitroModules } from 'react-native-nitro-modules'
import { type Base, OldEnum, WeirdNumbersEnum } from 'react-native-nitro-test'
import { TEST_CAR, TEST_PERSON } from './utils/fixtures'
import { debugOnly, deferred } from './utils/helpers'
import { describeEachTestObject } from './utils/testObjects'

const BASE = NitroModules.createHybridObject<Base>('Base')

describeEachTestObject('Variants', (testObject) => {
  it('someVariant roundtrips a number', () => {
    testObject.someVariant = 55
    expect(testObject.someVariant).toBe(55)
  })

  it('someVariant roundtrips a string', () => {
    testObject.someVariant = 'some-string'
    expect(testObject.someVariant).toBe('some-string')
  })

  it('someVariant throws when set to a boolean', () => {
    expect(() => {
      // @ts-expect-error
      testObject.someVariant = false
    }).toThrow(
      `${testObject.name}.someVariant: Cannot convert "false" to any type in ${debugOnly('variant<double, std::string>!')}`
    )
  })

  it('passVariant(...) returns a fallback for an array', () => {
    expect(testObject.passVariant([1, 2, 3])).toBe('holds something else!')
  })

  it('passVariant(...) bounces a string', () => {
    expect(testObject.passVariant('hello!')).toBe('hello!')
  })

  it('passVariant(...) bounces a number', () => {
    expect(testObject.passVariant(5)).toBe(5)
  })

  it('passVariant(...) throws for an object', () => {
    expect(() =>
      testObject.passVariant(
        // @ts-expect-error
        {}
      )
    ).toThrow(
      `${testObject.name}.passVariant(...): Cannot convert "[object Object]" to any type in `
    )
  })

  it('passAllEmptyObjectVariant(...) bounces an empty object', () => {
    expect(testObject.passAllEmptyObjectVariant({})).toEqual({})
  })

  it('passAllEmptyObjectVariant(...) bounces an OptionalWrapper', () => {
    expect(
      testObject.passAllEmptyObjectVariant({
        optionalString: 'optional string!',
      })
    ).toEqual({ optionalString: 'optional string!' })
  })

  it('passAllEmptyObjectVariant(...) bounces a Base', () => {
    expect(testObject.passAllEmptyObjectVariant(BASE)).toBe(BASE)
  })

  it('bounceComplexVariant(...) bounces an ArrayBuffer', () => {
    const buffer = testObject.createArrayBuffer()
    const result = testObject.bounceComplexVariant(buffer)
    expect(result).toBeInstanceOf(ArrayBuffer)
    // The buffer is 10 MB, so don't compare (or print) its bytes.
    expect((result as ArrayBuffer).byteLength).toBe(buffer.byteLength)
  })

  it('bounceComplexVariant(...) bounces a Promise', async () => {
    const { promise, resolve } = deferred<number>()
    const result = testObject.bounceComplexVariant(promise)
    expect(result).toBeInstanceOf(Promise)
    resolve(55)
    await expect(result).resolves.toBe(55)
  })

  it('bounceComplexVariant(...) bounces a callback', async () => {
    const callback = fn<(value: number) => void>()
    const result = testObject.bounceComplexVariant(callback)
    expect(result).toBeTypeOf('function')
    const bounced = result as (value: number) => void
    bounced(5)
    await waitFor(() => expect(callback).toHaveBeenCalledWith(5), {
      timeout: 2000,
    })
  })

  it('bounceComplexVariant(...) bounces a struct', () => {
    expect(
      testObject.bounceComplexVariant({
        items: [],
        value: { onChanged: () => {}, value: 55 },
      })
    ).toEqual({
      items: [],
      value: { onChanged: expect.any(Function), value: 55 },
    })
  })

  it('bounceComplexVariant(...) bounces an AnyMap', () => {
    expect(testObject.bounceComplexVariant({ whateverValue: 55 })).toEqual({
      whateverValue: 55,
    })
  })

  it('bounceComplexVariant(...) bounces a Date', () => {
    const date = new Date()
    const result = testObject.bounceComplexVariant(date)
    expect(result).toBeInstanceOf(Date)
    expect(result).toEqual(date)
  })

  it('createChild().bounceVariant(...) bounces a string', () => {
    expect(testObject.createChild().bounceVariant('hello!')).toBe('hello!')
  })

  it('getVariantEnum(...) bounces an enum', () => {
    expect(testObject.getVariantEnum(OldEnum.THIRD)).toBe(OldEnum.THIRD)
  })

  it('getVariantEnum(...) bounces a boolean', () => {
    expect(testObject.getVariantEnum(true)).toBe(true)
  })

  it('getVariantEnum(...) throws for a string', () => {
    expect(() =>
      // @ts-expect-error
      testObject.getVariantEnum('string')
    ).toThrow(
      `${testObject.name}.getVariantEnum(...): Cannot convert "string" to any type in ${debugOnly('variant<margelo::nitro::test::OldEnum, bool>!')}`
    )
  })

  it('getVariantEnum(...) throws for an out-of-range number', () => {
    expect(() =>
      // @ts-expect-error
      testObject.getVariantEnum(9999)
    ).toThrow(
      `${testObject.name}.getVariantEnum(...): Cannot convert "9999" to any type in ${debugOnly('variant<margelo::nitro::test::OldEnum, bool>!')}`
    )
  })

  it("bounceVariantUnionEnum(...) bounces 'gas'", () => {
    expect(testObject.bounceVariantUnionEnum('gas')).toBe('gas')
  })

  it('bounceVariantUnionEnum(...) bounces a Car', () => {
    expect(testObject.bounceVariantUnionEnum(TEST_CAR)).toEqual(TEST_CAR)
  })

  it('bounceVariantUnionEnum(...) throws for an unknown string', () => {
    expect(() =>
      // @ts-expect-error
      testObject.bounceVariantUnionEnum('diesel')
    ).toThrow(
      `${testObject.name}.bounceVariantUnionEnum(...): Cannot convert "diesel" to any type in `
    )
  })

  it('bounceVariantUnionEnum(...) throws for a wrong object', () => {
    expect(() =>
      // @ts-expect-error
      testObject.bounceVariantUnionEnum({})
    ).toThrow(
      `${testObject.name}.bounceVariantUnionEnum(...): Cannot convert "[object Object]" to any type in `
    )
  })

  it('bounceVariantUnionEnum(...) throws for a boolean', () => {
    expect(() =>
      // @ts-expect-error
      testObject.bounceVariantUnionEnum(true)
    ).toThrow(
      `${testObject.name}.bounceVariantUnionEnum(...): Cannot convert "true" to any type in `
    )
  })

  it('getVariantWeirdNumbersEnum(...) bounces an enum', () => {
    expect(testObject.getVariantWeirdNumbersEnum(WeirdNumbersEnum.C)).toBe(
      WeirdNumbersEnum.C
    )
  })

  it('getVariantWeirdNumbersEnum(...) bounces a boolean', () => {
    expect(testObject.getVariantWeirdNumbersEnum(true)).toBe(true)
  })

  it('getVariantWeirdNumbersEnum(...) throws for a string', () => {
    expect(() =>
      // @ts-expect-error
      testObject.getVariantWeirdNumbersEnum('string')
    ).toThrow(
      `${testObject.name}.getVariantWeirdNumbersEnum(...): Cannot convert "string" to any type in ${debugOnly('variant<margelo::nitro::test::WeirdNumbersEnum, bool>!')}`
    )
  })

  it('getVariantWeirdNumbersEnum(...) throws for an out-of-range number', () => {
    expect(() =>
      // @ts-expect-error
      testObject.getVariantWeirdNumbersEnum(99999)
    ).toThrow(
      `${testObject.name}.getVariantWeirdNumbersEnum(...): Cannot convert "99999" to any type in ${debugOnly('variant<margelo::nitro::test::WeirdNumbersEnum, bool>!')}`
    )
  })

  it('getVariantObjects(...) bounces a Person', () => {
    expect(testObject.getVariantObjects(TEST_PERSON)).toEqual(TEST_PERSON)
  })

  it('getVariantObjects(...) bounces a Car', () => {
    expect(testObject.getVariantObjects(TEST_CAR)).toEqual(TEST_CAR)
  })

  it('getVariantObjects(...) bounces a Car with a driver', () => {
    const car = { ...TEST_CAR, driver: TEST_PERSON }
    expect(testObject.getVariantObjects(car)).toEqual(car)
  })

  it('getVariantObjects(...) throws for a string', () => {
    expect(() =>
      // @ts-expect-error
      testObject.getVariantObjects('some-string')
    ).toThrow(
      `${testObject.name}.getVariantObjects(...): Cannot convert "some-string" to any type in ${debugOnly('variant<margelo::nitro::test::Person, margelo::nitro::test::Car>!')}`
    )
  })

  it('getVariantObjects(...) throws for a wrong object', () => {
    expect(() =>
      // @ts-expect-error
      testObject.getVariantObjects({ someValue: 55 })
    ).toThrow(
      `${testObject.name}.getVariantObjects(...): Cannot convert "[object Object]" to any type in ${debugOnly('variant<margelo::nitro::test::Person, margelo::nitro::test::Car>!')}`
    )
  })

  it('getVariantHybrid(...) bounces a HybridObject', () => {
    // @ts-expect-error `testObject` is a union of both TestObject types
    const result = testObject.getVariantHybrid(testObject)
    expect(result).toBe(testObject)
  })

  it('getVariantHybrid(...) bounces a Person', () => {
    expect(testObject.getVariantHybrid(TEST_PERSON)).toEqual(TEST_PERSON)
  })

  it('getVariantHybrid(...) throws for a string', () => {
    expect(() =>
      // @ts-expect-error
      testObject.getVariantHybrid('some-string')
    ).toThrow(
      `${testObject.name}.getVariantHybrid(...): Cannot convert "some-string" to any type in `
    )
  })

  it('getVariantHybrid(...) throws for a wrong object', () => {
    expect(() =>
      // @ts-expect-error
      testObject.getVariantHybrid({ someValue: 55 })
    ).toThrow(
      `${testObject.name}.getVariantHybrid(...): Cannot convert "[object Object]" to any type in `
    )
  })

  it('passNamedVariant(...) bounces a string', () => {
    expect(testObject.passNamedVariant('Hello world!')).toBe('Hello world!')
  })
})
