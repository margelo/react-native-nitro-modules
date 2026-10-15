import { expect, it } from 'react-native-harness'
import { describeEachTestObject } from './utils/testObjects'

const BASE_DATE = new Date()
const ONE_HOUR_IN_MS = 1000 * 60 * 60
const DATE_PLUS_1H = new Date(BASE_DATE.getTime() + ONE_HOUR_IN_MS)

describeEachTestObject('Primitive properties', (testObject) => {
  it('numberValue roundtrips', () => {
    testObject.numberValue = 13
    expect(testObject.numberValue).toBe(13)
    testObject.numberValue = 14
    expect(testObject.numberValue).toBe(14)
  })

  it('boolValue roundtrips', () => {
    testObject.boolValue = false
    expect(testObject.boolValue).toBe(false)
    testObject.boolValue = true
    expect(testObject.boolValue).toBe(true)
  })

  it('stringValue roundtrips', () => {
    testObject.stringValue = 'hello!'
    expect(testObject.stringValue).toBe('hello!')
  })

  it('int64Value roundtrips a positive BigInt', () => {
    testObject.int64Value = 7362572367826385n
    expect(testObject.int64Value).toBe(7362572367826385n)
  })

  it('int64Value roundtrips a negative BigInt', () => {
    testObject.int64Value = -7362572367826385n
    expect(testObject.int64Value).toBe(-7362572367826385n)
  })

  it('uint64Value roundtrips a positive BigInt', () => {
    testObject.uint64Value = 7362572367826385n
    expect(testObject.uint64Value).toBe(7362572367826385n)
  })

  it('uint64Value setter throws for a negative BigInt', () => {
    expect(() => {
      testObject.uint64Value = -7362572367826385n
    }).toThrow(`${testObject.name}.uint64Value`)
  })
})

describeEachTestObject('is*/has* accessor naming', (testObject) => {
  it('hasBoolean is false', () => {
    expect(testObject.hasBoolean).toBe(false)
  })

  it('hasBooleanWritable roundtrips', () => {
    testObject.hasBooleanWritable = true
    expect(testObject.hasBooleanWritable).toBe(true)
  })

  it('isBoolean is false', () => {
    expect(testObject.isBoolean).toBe(false)
  })

  it('isBooleanWritable roundtrips', () => {
    testObject.isBooleanWritable = true
    expect(testObject.isBooleanWritable).toBe(true)
  })

  it('isolatedBoolean roundtrips', () => {
    testObject.isolatedBoolean = true
    expect(testObject.isolatedBoolean).toBe(true)
  })

  it('isTextValue roundtrips', () => {
    testObject.isTextValue = 'hello'
    expect(testObject.isTextValue).toBe('hello')
  })
})

describeEachTestObject('Basic functions', (testObject) => {
  it('addNumbers(5, 13) returns 18', () => {
    expect(testObject.addNumbers(5, 13)).toBe(18)
  })

  it('addStrings("hello ", "world") returns "hello world"', () => {
    expect(testObject.addStrings('hello ', 'world')).toBe('hello world')
  })

  it('simpleFunc() returns undefined', () => {
    expect(testObject.simpleFunc()).toBeUndefined()
  })

  it('multipleArguments(...) returns undefined', () => {
    expect(testObject.multipleArguments(13, 'hello!', true)).toBeUndefined()
  })

  it('bounceNull(null) returns null', () => {
    expect(testObject.bounceNull(null)).toBeNull()
  })

  it('bounceNull(undefined) throws', () => {
    // @ts-expect-error
    expect(() => testObject.bounceNull(undefined)).toThrow(
      `${testObject.name}.bounceNull(...)`
    )
  })
})

describeEachTestObject('Dates', (testObject) => {
  it('currentDate() returns a Date', () => {
    expect(testObject.currentDate()).toBeInstanceOf(Date)
  })

  it('add1Hour(...) adds one hour', () => {
    expect(testObject.add1Hour(BASE_DATE)).toEqual(DATE_PLUS_1H)
  })

  it('currentDate() is within 10ms of the JS Date', () => {
    const nativeNow = testObject.currentDate()
    const jsNow = new Date()
    const msDiff = Math.abs(jsNow.getTime() - nativeNow.getTime())
    expect(msDiff).toBeLessThan(10)
  })
})
