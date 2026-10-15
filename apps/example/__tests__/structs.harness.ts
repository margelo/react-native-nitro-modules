import { expect, fn, it, waitFor } from 'react-native-harness'
import type { Car } from 'react-native-nitro-test'
import {
  sumUpAllPassengers,
  TEST_CAR,
  TEST_CAR_2,
  TEST_OPTIONAL_ENUM_WRAPPER,
  TEST_OPTIONAL_WRAPPER,
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
    // toStrictEqual also compares the ArrayBuffer's bytes, toEqual doesn't.
    expect(
      testObject.bounceOptionalWrapper(TEST_OPTIONAL_WRAPPER)
    ).toStrictEqual(TEST_OPTIONAL_WRAPPER)
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
