import { expect, fn, it, waitFor } from 'react-native-harness'
import { NitroModules } from 'react-native-nitro-modules'
import {
  type Base,
  type Car,
  OldEnum,
  type Powertrain,
  WeirdNumbersEnum,
} from 'react-native-nitro-test'
import { TEST_CAR, TEST_CAR_2, TEST_PERSON } from './utils/fixtures'
import { debugOnly, deferred } from './utils/helpers'
import { describeEachTestObject, type TestObject } from './utils/testObjects'

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
    // `toEqual({})` would also match a (release) HybridObject, so check that
    // it came back as an OptionalWrapper struct with every key.
    expect(testObject.passAllEmptyObjectVariant({})).toStrictEqual({
      optionalArrayBuffer: undefined,
      optionalString: undefined,
    })
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
    // The buffer is 10 MB of uninitialized memory, so don't compare (or
    // print) all of its bytes - only a few marked ones.
    const bytes = new Uint8Array(buffer)
    bytes.set([13, 37])
    bytes[bytes.length - 1] = 42
    const result = testObject.bounceComplexVariant(buffer)
    expect(result).toBeInstanceOf(ArrayBuffer)
    const resultBytes = new Uint8Array(result as ArrayBuffer)
    expect(resultBytes.byteLength).toBe(buffer.byteLength)
    expect([
      resultBytes[0],
      resultBytes[1],
      resultBytes[resultBytes.length - 1],
    ]).toEqual([13, 37, 42])
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

const POWERTRAINS: Powertrain[] = ['electric', 'gas', 'hybrid']
const WEIRD_NUMBERS = [
  WeirdNumbersEnum.A,
  WeirdNumbersEnum.B,
  WeirdNumbersEnum.C,
]
// A Car without any of its optional keys (not even set to `undefined`)
const MINIMAL_CAR: Car = {
  year: 2020,
  make: 'Tesla',
  model: 'Model 3',
  power: 283,
  powertrain: 'electric',
  passengers: [],
  performanceScores: [],
}

describeEachTestObject('Variant edge cases', (testObject) => {
  it('someVariant switches from a string back to a number', () => {
    testObject.someVariant = 'some-string'
    testObject.someVariant = 55
    expect(testObject.someVariant).toBe(55)
  })

  it('someVariant keeps a numeric string a string', () => {
    testObject.someVariant = '55'
    expect(testObject.someVariant).toBe('55')
  })

  it('someVariant roundtrips -0', () => {
    testObject.someVariant = -0
    expect(testObject.someVariant).toBe(-0)
  })

  it('someVariant throws when set to null', () => {
    expect(() => {
      // @ts-expect-error
      testObject.someVariant = null
    }).toThrow(
      `${testObject.name}.someVariant: Cannot convert "null" to any type in ${debugOnly('variant<double, std::string>!')}`
    )
  })

  it('someVariant throws when set to undefined', () => {
    expect(() => {
      // @ts-expect-error
      testObject.someVariant = undefined
    }).toThrow(
      `${testObject.name}.someVariant: Cannot convert "undefined" to any type in ${debugOnly('variant<double, std::string>!')}`
    )
  })

  it('someVariant keeps its value after a failed set', () => {
    testObject.someVariant = 'before'
    expect(() => {
      // @ts-expect-error
      testObject.someVariant = false
    }).toThrow(`${testObject.name}.someVariant: Cannot convert "false"`)
    expect(testObject.someVariant).toBe('before')
  })

  it('passVariant(...) bounces 0 as a number', () => {
    expect(testObject.passVariant(0)).toBe(0)
  })

  it('passVariant(...) bounces NaN', () => {
    expect(testObject.passVariant(NaN)).toBeNaN()
  })

  it('passVariant(...) bounces an empty string', () => {
    expect(testObject.passVariant('')).toBe('')
  })

  it('passVariant(...) keeps a numeric string a string', () => {
    expect(testObject.passVariant('5')).toBe('5')
  })

  it('passVariant(...) returns a fallback for false', () => {
    expect(testObject.passVariant(false)).toBe('holds something else!')
  })

  it('passVariant(...) returns a fallback for an empty array', () => {
    expect(testObject.passVariant([])).toBe('holds something else!')
  })

  it('passVariant(...) returns a fallback for a string array', () => {
    expect(testObject.passVariant(['a', 'b'])).toBe('holds something else!')
  })

  it('passVariant(...) throws for null with every accepted type', () => {
    expect(() =>
      // @ts-expect-error
      testObject.passVariant(null)
    ).toThrow(
      `${testObject.name}.passVariant(...): Cannot convert "null" to any type in ${debugOnly('variant<bool, std::vector<double>, std::vector<std::string>, double, std::string>!')}`
    )
  })

  it('passVariant(...) throws for a bigint', () => {
    expect(() =>
      // @ts-expect-error
      testObject.passVariant(5n)
    ).toThrow(
      `${testObject.name}.passVariant(...): Cannot convert "5" to any type in `
    )
  })

  it('passVariant(...) throws for nested arrays', () => {
    expect(() =>
      testObject.passVariant(
        // @ts-expect-error
        [[1, 2], [3]]
      )
    ).toThrow(
      `${testObject.name}.passVariant(...): Cannot convert "1,2,3" to any type in `
    )
  })

  it('passVariant(...) throws for a mixed number/string array', () => {
    expect(() =>
      testObject.passVariant(
        // @ts-expect-error
        [1, 'two']
      )
    ).toThrow(`${testObject.name}.passVariant(...): `)
  })

  it('getVariantEnum(...) bounces OldEnum.FIRST (0)', () => {
    expect(testObject.getVariantEnum(OldEnum.FIRST)).toBe(OldEnum.FIRST)
  })

  it('getVariantEnum(...) bounces false', () => {
    expect(testObject.getVariantEnum(false)).toBe(false)
  })

  it('getVariantEnum(...) throws one past the last enum value', () => {
    expect(() =>
      // @ts-expect-error
      testObject.getVariantEnum(3)
    ).toThrow(
      `${testObject.name}.getVariantEnum(...): Cannot convert "3" to any type in `
    )
  })

  it('getVariantEnum(...) throws for a negative number', () => {
    expect(() =>
      // @ts-expect-error
      testObject.getVariantEnum(-1)
    ).toThrow(
      `${testObject.name}.getVariantEnum(...): Cannot convert "-1" to any type in `
    )
  })

  it('getVariantEnum(...) throws for a fractional number', () => {
    expect(() =>
      // @ts-expect-error
      testObject.getVariantEnum(1.5)
    ).toThrow(
      `${testObject.name}.getVariantEnum(...): Cannot convert "1.5" to any type in `
    )
  })

  it('getVariantWeirdNumbersEnum(...) bounces every enum value', () => {
    for (const value of WEIRD_NUMBERS) {
      expect(testObject.getVariantWeirdNumbersEnum(value), `${value}`).toBe(
        value
      )
    }
  })

  it('getVariantWeirdNumbersEnum(...) bounces false', () => {
    expect(testObject.getVariantWeirdNumbersEnum(false)).toBe(false)
  })

  it('getVariantWeirdNumbersEnum(...) throws between two enum values', () => {
    expect(() =>
      // @ts-expect-error
      testObject.getVariantWeirdNumbersEnum(33)
    ).toThrow(
      `${testObject.name}.getVariantWeirdNumbersEnum(...): Cannot convert "33" to any type in `
    )
  })

  it('bounceVariantUnionEnum(...) bounces every Powertrain', () => {
    for (const powertrain of POWERTRAINS) {
      expect(testObject.bounceVariantUnionEnum(powertrain), powertrain).toBe(
        powertrain
      )
    }
  })

  it('bounceVariantUnionEnum(...) throws for a differently cased Powertrain', () => {
    expect(() =>
      // @ts-expect-error
      testObject.bounceVariantUnionEnum('GAS')
    ).toThrow(
      `${testObject.name}.bounceVariantUnionEnum(...): Cannot convert "GAS" to any type in ${debugOnly('variant<margelo::nitro::test::Powertrain, margelo::nitro::test::Car>!')}`
    )
  })

  it('bounceVariantUnionEnum(...) throws for a Car with an unknown powertrain', () => {
    expect(() =>
      testObject.bounceVariantUnionEnum({
        ...TEST_CAR,
        // @ts-expect-error
        powertrain: 'diesel',
      })
    ).toThrow(
      `${testObject.name}.bounceVariantUnionEnum(...): Cannot convert "[object Object]" to any type in `
    )
  })

  it('getVariantObjects(...) resolves an object matching Person and Car to Person', () => {
    const personAndCar = { ...TEST_CAR, ...TEST_PERSON }
    expect(testObject.getVariantObjects(personAndCar)).toStrictEqual(
      TEST_PERSON
    )
  })

  it('getVariantObjects(...) drops unknown keys from a Person', () => {
    const person = { ...TEST_PERSON, nickname: 'mrousavy' }
    expect(testObject.getVariantObjects(person)).toStrictEqual(TEST_PERSON)
  })

  it('getVariantObjects(...) bounces a Car without optional keys', () => {
    expect(testObject.getVariantObjects(MINIMAL_CAR)).toEqual(MINIMAL_CAR)
  })

  it('getVariantObjects(...) throws for a Person without age', () => {
    expect(() =>
      // @ts-expect-error
      testObject.getVariantObjects({ name: 'Marc' })
    ).toThrow(
      `${testObject.name}.getVariantObjects(...): Cannot convert "[object Object]" to any type in `
    )
  })

  it('getVariantObjects(...) throws for a Car without passengers', () => {
    expect(() =>
      // @ts-expect-error
      testObject.getVariantObjects({ ...TEST_CAR, passengers: undefined })
    ).toThrow(
      `${testObject.name}.getVariantObjects(...): Cannot convert "[object Object]" to any type in `
    )
  })

  it('getVariantObjects(...) throws for an array of Persons', () => {
    expect(() =>
      // @ts-expect-error
      testObject.getVariantObjects([TEST_PERSON])
    ).toThrow(
      `${testObject.name}.getVariantObjects(...): Cannot convert "[object Object]" to any type in `
    )
  })

  it('getVariantHybrid(...) bounces another instance of the same type', () => {
    const other = testObject.newTestObject()
    // @ts-expect-error `testObject` is a union of both TestObject types
    expect(testObject.getVariantHybrid(other)).toBe(other)
  })

  it('getVariantHybrid(...) throws for the other TestObject implementation', () => {
    const otherName =
      testObject.name === 'TestObjectCpp'
        ? 'TestObjectSwiftKotlin'
        : 'TestObjectCpp'
    const other = NitroModules.createHybridObject<TestObject>(otherName)
    expect(() =>
      // @ts-expect-error
      testObject.getVariantHybrid(other)
    ).toThrow(
      `${testObject.name}.getVariantHybrid(...): Cannot convert "${String(other)}" to any type in `
    )
  })

  it('passNamedVariant(...) bounces a Car', () => {
    expect(testObject.passNamedVariant(TEST_CAR_2)).toEqual(TEST_CAR_2)
  })

  it('passNamedVariant(...) throws for a number', () => {
    expect(() =>
      // @ts-expect-error
      testObject.passNamedVariant(55)
    ).toThrow(
      `${testObject.name}.passNamedVariant(...): Cannot convert "55" to any type in ${debugOnly('variant<std::string, margelo::nitro::test::Car>!')}`
    )
  })

  it('createChild().bounceVariant(...) bounces a Car', () => {
    expect(testObject.createChild().bounceVariant(TEST_CAR_2)).toEqual(
      TEST_CAR_2
    )
  })

  it('createChild().bounceVariant(...) throws for a number', () => {
    const child = testObject.createChild()
    expect(() =>
      // @ts-expect-error
      child.bounceVariant(55)
    ).toThrow(
      `${child.name}.bounceVariant(...): Cannot convert "55" to any type in `
    )
  })

  it('passAllEmptyObjectVariant(...) bounces a Child as the same object', () => {
    const child = testObject.createChild()
    expect(testObject.passAllEmptyObjectVariant(child)).toBe(child)
  })

  it('passAllEmptyObjectVariant(...) throws for a non-Base HybridObject', () => {
    expect(() => testObject.passAllEmptyObjectVariant(testObject)).toThrow(
      `${testObject.name}.passAllEmptyObjectVariant(...): Cannot convert "${String(testObject)}" to any type in `
    )
  })

  it('passAllEmptyObjectVariant(...) throws for a wrongly typed OptionalWrapper', () => {
    expect(() =>
      // @ts-expect-error
      testObject.passAllEmptyObjectVariant({ optionalString: 55 })
    ).toThrow(
      `${testObject.name}.passAllEmptyObjectVariant(...): Cannot convert "[object Object]" to any type in `
    )
  })

  it('bounceComplexVariant(...) falls back to an AnyMap for a mismatching struct', () => {
    const map = { value: 55, items: 'not-an-array' }
    expect(testObject.bounceComplexVariant(map)).toEqual(map)
  })

  it('bounceComplexVariant(...) throws for a number', () => {
    expect(() =>
      // @ts-expect-error
      testObject.bounceComplexVariant(55)
    ).toThrow(
      `${testObject.name}.bounceComplexVariant(...): Cannot convert "55" to any type in `
    )
  })
})
