import { expect, fn, it, waitFor } from 'react-native-harness'
import type { Car, OptionalWrapper } from 'react-native-nitro-test'
import {
  sumUpAllPassengers,
  TEST_CAR,
  TEST_CAR_2,
  TEST_OPTIONAL_ENUM_WRAPPER,
  TEST_PERSON,
  TEST_WRAPPED_STRUCT,
} from './utils/fixtures'
import { describeEachTestObject } from './utils/testObjects'

const CAR_WITHOUT_DRIVER: Car = {
  make: 'Lamborghini',
  year: 2018,
  model: 'Huracan Performante',
  power: 640,
  passengers: [],
  powertrain: 'gas',
  isFast: true,
  performanceScores: [100, 0],
}

// TEST_OPTIONAL_WRAPPER's buffer is all zeros - use distinct bytes instead.
const OPTIONAL_WRAPPER_BYTES = Uint8Array.from(
  { length: 1024 },
  (_, i) => i % 256
)
const OPTIONAL_WRAPPER: OptionalWrapper = {
  optionalArrayBuffer: OPTIONAL_WRAPPER_BYTES.buffer,
  optionalString: 'hello!',
}

describeEachTestObject('Struct roundtrips', (testObject) => {
  it('bouncePartialStruct(...) keeps an empty struct', () => {
    expect(
      testObject.bouncePartialStruct({ name: undefined, age: undefined })
    ).toStrictEqual({ name: undefined, age: undefined })
  })

  it('bouncePartialStruct(...) keeps a struct with 1 key', () => {
    expect(
      testObject.bouncePartialStruct({ name: 'Marc', age: undefined })
    ).toStrictEqual({ name: 'Marc', age: undefined })
  })

  it('bouncePartialStruct(...) keeps a struct with all keys', () => {
    expect(
      testObject.bouncePartialStruct({ name: 'Marc', age: 25 })
    ).toStrictEqual({ name: 'Marc', age: 25 })
  })

  it('bounceWrappedJsStyleStruct(...) returns the same struct', () => {
    expect(testObject.bounceWrappedJsStyleStruct(TEST_WRAPPED_STRUCT)).toEqual({
      value: { value: 55.3, onChanged: expect.any(Function) },
      items: [],
    })
  })

  it('bounceOptionalWrapper(...) returns the same struct', () => {
    const result = testObject.bounceOptionalWrapper(OPTIONAL_WRAPPER)
    // Failure messages print an ArrayBuffer as '', so compare its bytes first
    expect(new Uint8Array(result.optionalArrayBuffer ?? [])).toEqual(
      OPTIONAL_WRAPPER_BYTES
    )
    // toStrictEqual also compares the ArrayBuffer's bytes, toEqual doesn't
    expect(result).toStrictEqual(OPTIONAL_WRAPPER)
  })

  it('bounceOptionalEnumStruct(...) returns the same struct', () => {
    expect(
      testObject.bounceOptionalEnumStruct(TEST_OPTIONAL_ENUM_WRAPPER)
    ).toEqual(TEST_OPTIONAL_ENUM_WRAPPER)
  })

  it('bounceOptionalEnumStruct(...) returns undefined for undefined', () => {
    expect(testObject.bounceOptionalEnumStruct(undefined)).toBeUndefined()
  })

  it('bounceOptionalCallback(...) returns a callable function', async () => {
    const callback = fn()
    const bounced = testObject.bounceOptionalCallback({ callback }).callback
    expect(bounced).toBeTypeOf('function')
    const call = bounced as () => void
    call()
    await waitFor(() => expect(callback).toHaveBeenCalledTimes(1), {
      timeout: 2000,
    })
  })

  it('bounceOptionalCallback(...) returns a number', () => {
    expect(testObject.bounceOptionalCallback({ callback: 55 }).callback).toBe(
      55
    )
  })

  it('bounceOptionalCallback(...) returns undefined for a missing callback', () => {
    expect(testObject.bounceOptionalCallback({}).callback).toBeUndefined()
  })
})

describeEachTestObject('Car and Person structs', (testObject) => {
  it('getCar() returns a Car with every key', () => {
    expect(testObject.getCar()).toStrictEqual({
      year: 2018,
      make: 'Lamborghini',
      model:
        testObject.name === 'TestObjectCpp' ? 'Huracan Performante' : 'Huracán',
      power: 640,
      powertrain: 'gas',
      driver: undefined,
      passengers: [],
      isFast: true,
      favouriteTrack: undefined,
      performanceScores: [100, 10],
      someVariant: undefined,
    })
  })

  it('sumUpAllPassengers(...) joins all passengers', () => {
    expect(testObject.sumUpAllPassengers([TEST_CAR, TEST_CAR_2])).toBe(
      sumUpAllPassengers([TEST_CAR, TEST_CAR_2])
    )
  })

  it('isCarElectric(...) returns false for a gas car', () => {
    expect(testObject.isCarElectric(CAR_WITHOUT_DRIVER)).toBe(false)
  })

  it('areCarsEqual(...) returns true for the same car', () => {
    expect(testObject.areCarsEqual(TEST_CAR, TEST_CAR)).toBe(true)
  })

  it('areCarsEqual(...) returns false for different cars', () => {
    expect(testObject.areCarsEqual(TEST_CAR, TEST_CAR_2)).toBe(false)
  })

  it('getDriver(...) returns undefined without a driver', () => {
    expect(testObject.getDriver(CAR_WITHOUT_DRIVER)).toBeUndefined()
  })

  it('getDriver(...) returns the driver', () => {
    expect(
      testObject.getDriver({
        ...CAR_WITHOUT_DRIVER,
        driver: { age: 24, name: 'marc' },
      })
    ).toEqual({ age: 24, name: 'marc' })
  })

  it('bounceCar(...) returns the same TEST_CAR', () => {
    expect(testObject.bounceCar(TEST_CAR)).toStrictEqual(TEST_CAR)
  })

  it('bounceCar(...) returns the same TEST_CAR_2', () => {
    expect(testObject.bounceCar(TEST_CAR_2)).toStrictEqual(TEST_CAR_2)
  })

  it('jsStyleObjectAsParameters(...) calls onChanged with the value', async () => {
    const onChanged = fn<(num: number) => void>()
    testObject.jsStyleObjectAsParameters({ value: 55, onChanged })
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1), {
      timeout: 2000,
    })
    expect(onChanged).toHaveBeenCalledWith(55)
  })
})

// Every key of `OptionalEnumWrapper`, all set to `undefined`.
const EMPTY_OPTIONAL_ENUM_WRAPPER = Object.fromEntries(
  Object.keys(TEST_OPTIONAL_ENUM_WRAPPER).map((key) => [key, undefined])
)

/**
 * Returns a copy of `value` without `key` - to pass a struct with a missing
 * required field.
 */
function withoutKey<T extends object>(value: T, key: keyof T): Partial<T> {
  const copy = { ...value }
  delete copy[key]
  return copy
}

describeEachTestObject('Struct keys', (testObject) => {
  it('bounceCar(...) returns a new object', () => {
    expect(testObject.bounceCar(TEST_CAR)).not.toBe(TEST_CAR)
  })

  it('bounceCar(...) sets omitted optional keys to undefined', () => {
    expect(testObject.bounceCar(CAR_WITHOUT_DRIVER)).toStrictEqual({
      ...CAR_WITHOUT_DRIVER,
      driver: undefined,
      favouriteTrack: undefined,
      someVariant: undefined,
    })
  })

  it('bounceCar(...) drops unknown keys', () => {
    const car = { ...TEST_CAR, color: 'red' }
    expect(testObject.bounceCar(car)).toStrictEqual(TEST_CAR)
  })

  it('bounceCar(...) drops unknown keys of nested structs', () => {
    const driver = { ...TEST_PERSON, nickname: 'mrousavy' }
    const passenger = { name: 'Lukas', age: 18, seat: 'back' }
    const car = { ...TEST_CAR_2, driver, passengers: [passenger] }
    expect(testObject.bounceCar(car)).toStrictEqual({
      ...TEST_CAR_2,
      driver: TEST_PERSON,
      passengers: [{ name: 'Lukas', age: 18 }],
    })
  })

  it('bouncePartialStruct(...) drops unknown keys', () => {
    const person = { name: 'Marc', age: 24, nickname: 'mrousavy' }
    expect(testObject.bouncePartialStruct(person)).toStrictEqual({
      name: 'Marc',
      age: 24,
    })
  })

  it('getDriver(...) drops unknown keys of the driver', () => {
    const driver = { ...TEST_PERSON, nickname: 'mrousavy' }
    expect(testObject.getDriver({ ...TEST_CAR, driver })).toStrictEqual(
      TEST_PERSON
    )
  })

  it('bounceOptionalWrapper(...) sets every key of {} to undefined', () => {
    expect(testObject.bounceOptionalWrapper({})).toStrictEqual({
      optionalArrayBuffer: undefined,
      optionalString: undefined,
    })
  })

  it('bounceOptionalEnumStruct(...) sets every key of {} to undefined', () => {
    expect(testObject.bounceOptionalEnumStruct({})).toStrictEqual(
      EMPTY_OPTIONAL_ENUM_WRAPPER
    )
  })
})

describeEachTestObject('Struct values', (testObject) => {
  it('bounceCar(...) keeps isFast: false', () => {
    expect(testObject.bounceCar({ ...TEST_CAR, isFast: false }).isFast).toBe(
      false
    )
  })

  it('bounceCar(...) keeps an empty favouriteTrack', () => {
    expect(
      testObject.bounceCar({ ...TEST_CAR, favouriteTrack: '' }).favouriteTrack
    ).toBe('')
  })

  it('bounceCar(...) keeps a number someVariant', () => {
    expect(
      testObject.bounceCar({ ...TEST_CAR, someVariant: 55 }).someVariant
    ).toBe(55)
  })

  it('bounceCar(...) keeps a numeric string someVariant as a string', () => {
    expect(
      testObject.bounceCar({ ...TEST_CAR, someVariant: '55' }).someVariant
    ).toBe('55')
  })

  it('bounceOptionalEnumStruct(...) keeps falsy values', () => {
    expect(
      testObject.bounceOptionalEnumStruct({
        count: 0,
        ratio: 0,
        enabled: false,
        shouldRetry: false,
      })
    ).toStrictEqual({
      ...EMPTY_OPTIONAL_ENUM_WRAPPER,
      count: 0,
      ratio: 0,
      enabled: false,
      shouldRetry: false,
    })
  })

  it('bounceWrappedJsStyleStruct(...) keeps every item', () => {
    const result = testObject.bounceWrappedJsStyleStruct({
      value: { value: 1, onChanged: () => {} },
      items: [
        { value: 2, onChanged: () => {} },
        { value: 3, onChanged: () => {} },
      ],
    })
    expect(result.items).toEqual([
      { value: 2, onChanged: expect.any(Function) },
      { value: 3, onChanged: expect.any(Function) },
    ])
  })

  it('isCarElectric(...) returns true for an electric car', () => {
    expect(
      testObject.isCarElectric({
        ...CAR_WITHOUT_DRIVER,
        powertrain: 'electric',
      })
    ).toBe(true)
  })

  it('areCarsEqual(...) returns true for equal copies', () => {
    const copy = {
      ...TEST_CAR_2,
      driver: { ...TEST_PERSON },
      passengers: TEST_CAR_2.passengers.map((p) => ({ ...p })),
    }
    expect(testObject.areCarsEqual(TEST_CAR_2, copy)).toBe(true)
  })

  it('areCarsEqual(...) returns false when only a passenger differs', () => {
    const other = {
      ...TEST_CAR,
      passengers: [TEST_CAR.passengers[0]!, { name: 'Daniel', age: 28 }],
    }
    expect(testObject.areCarsEqual(TEST_CAR, other)).toBe(false)
  })

  it('areCarsEqual(...) returns false when only the driver is missing', () => {
    const other = { ...TEST_CAR_2, driver: undefined }
    expect(testObject.areCarsEqual(TEST_CAR_2, other)).toBe(false)
  })

  it('areCarsEqual(...) returns false for someVariant 1 vs "1"', () => {
    expect(
      testObject.areCarsEqual(
        { ...TEST_CAR, someVariant: 1 },
        { ...TEST_CAR, someVariant: '1' }
      )
    ).toBe(false)
  })

  it('sumUpAllPassengers(...) returns an empty string for no cars', () => {
    expect(testObject.sumUpAllPassengers([])).toBe('')
  })

  it('sumUpAllPassengers(...) returns an empty string without passengers', () => {
    expect(
      testObject.sumUpAllPassengers([CAR_WITHOUT_DRIVER, CAR_WITHOUT_DRIVER])
    ).toBe('')
  })

  it('sumUpAllPassengers(...) adds no separator for one passenger', () => {
    expect(
      testObject.sumUpAllPassengers([
        { ...CAR_WITHOUT_DRIVER, passengers: [{ name: 'Marc', age: 24 }] },
      ])
    ).toBe('Marc (24)')
  })
})

describeEachTestObject('Struct conversion errors', (testObject) => {
  it('bounceCar(...) rejects a number', () => {
    // @ts-expect-error passing a number instead of a Car
    expect(() => testObject.bounceCar(5)).toThrow(
      `${testObject.name}.bounceCar(...): Value is a number, expected an Object`
    )
  })

  it('bounceCar(...) rejects null', () => {
    // @ts-expect-error passing null instead of a Car
    expect(() => testObject.bounceCar(null)).toThrow(
      `${testObject.name}.bounceCar(...): Value is null, expected an Object`
    )
  })

  it('bounceCar(...) rejects a missing string field', () => {
    const car = withoutKey(TEST_CAR, 'make')
    // @ts-expect-error passing a Car without a make
    expect(() => testObject.bounceCar(car)).toThrow(
      `${testObject.name}.bounceCar(...): Value is undefined, expected a String`
    )
  })

  it('bounceCar(...) rejects a missing number field', () => {
    const car = withoutKey(TEST_CAR, 'year')
    // @ts-expect-error passing a Car without a year
    expect(() => testObject.bounceCar(car)).toThrow(
      `${testObject.name}.bounceCar(...): Value is undefined, expected a number`
    )
  })

  it('bounceCar(...) rejects a missing array field', () => {
    const car = withoutKey(TEST_CAR, 'passengers')
    // @ts-expect-error passing a Car without passengers
    expect(() => testObject.bounceCar(car)).toThrow(
      `${testObject.name}.bounceCar(...): Value is undefined, expected an Object`
    )
  })

  it('bounceCar(...) rejects a string number field', () => {
    // @ts-expect-error passing a string power
    expect(() => testObject.bounceCar({ ...TEST_CAR, power: '640' })).toThrow(
      `${testObject.name}.bounceCar(...): Value is a string, expected a number`
    )
  })

  it('bounceCar(...) rejects a string optional boolean', () => {
    // @ts-expect-error passing a string isFast
    expect(() => testObject.bounceCar({ ...TEST_CAR, isFast: 'yes' })).toThrow(
      `${testObject.name}.bounceCar(...): Value is a string, expected a boolean`
    )
  })

  it('bounceCar(...) rejects an unknown powertrain', () => {
    expect(() =>
      // @ts-expect-error passing an unknown Powertrain
      testObject.bounceCar({ ...TEST_CAR, powertrain: 'diesel' })
    ).toThrow(
      `${testObject.name}.bounceCar(...): Cannot convert "diesel" to enum Powertrain - invalid value!`
    )
  })

  it('bounceCar(...) rejects a null driver', () => {
    // @ts-expect-error passing null where only undefined is optional
    expect(() => testObject.bounceCar({ ...TEST_CAR, driver: null })).toThrow(
      `${testObject.name}.bounceCar(...): Value is null, expected an Object`
    )
  })

  it('bounceCar(...) rejects a driver without an age', () => {
    const driver = withoutKey(TEST_PERSON, 'age')
    // @ts-expect-error passing a driver without an age
    expect(() => testObject.bounceCar({ ...TEST_CAR, driver })).toThrow(
      `${testObject.name}.bounceCar(...): Value is undefined, expected a number`
    )
  })

  it('bounceCar(...) rejects a passenger with a number name', () => {
    const passengers = [{ name: 5, age: 18 }]
    // @ts-expect-error passing a number as the passenger name
    expect(() => testObject.bounceCar({ ...TEST_CAR, passengers })).toThrow(
      `${testObject.name}.bounceCar(...): Value is a number, expected a String`
    )
  })

  it('bounceCar(...) rejects a string performance score', () => {
    const car = { ...TEST_CAR, performanceScores: [100, '0'] }
    // @ts-expect-error passing a string performance score
    expect(() => testObject.bounceCar(car)).toThrow(
      `${testObject.name}.bounceCar(...): Value is a string, expected a number`
    )
  })

  it('bounceCar(...) rejects a boolean someVariant', () => {
    const car = { ...TEST_CAR, someVariant: true }
    // @ts-expect-error passing a boolean someVariant
    expect(() => testObject.bounceCar(car)).toThrow(
      `${testObject.name}.bounceCar(...): Cannot convert "true" to any type in variant<`
    )
  })

  it('bouncePartialStruct(...) rejects a number name', () => {
    // @ts-expect-error passing a number name
    expect(() => testObject.bouncePartialStruct({ name: 5 })).toThrow(
      `${testObject.name}.bouncePartialStruct(...): Value is a number, expected a String`
    )
  })

  it('bounceOptionalEnumStruct(...) rejects an unknown enum value', () => {
    const wrapper = { tier: 'diesel' }
    // @ts-expect-error passing an unknown Powertrain
    expect(() => testObject.bounceOptionalEnumStruct(wrapper)).toThrow(
      `${testObject.name}.bounceOptionalEnumStruct(...): Cannot convert "diesel" to enum Powertrain - invalid value!`
    )
  })

  it('jsStyleObjectAsParameters(...) rejects a missing onChanged', () => {
    // @ts-expect-error passing a JsStyleStruct without onChanged
    expect(() => testObject.jsStyleObjectAsParameters({ value: 55 })).toThrow(
      `${testObject.name}.jsStyleObjectAsParameters(...): Value is undefined, expected an Object`
    )
  })
})
