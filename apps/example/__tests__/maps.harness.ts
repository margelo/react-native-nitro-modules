import { expect, it } from 'react-native-harness'
import { TEST_MAP, TEST_MAP_2, TEST_MAP_3, TEST_MAP_4 } from './utils/fixtures'
import { describeEachTestObject, type TestObject } from './utils/testObjects'

// createMap() builds its values from these getters - seed non-default values
// so AnyMap has to carry a true bool, a non-empty string and a negative int64.
function seedPrimitives(testObject: TestObject) {
  testObject.numberValue = 14
  testObject.boolValue = true
  testObject.stringValue = 'hello!'
  testObject.int64Value = -7362572367826385n
}

describeEachTestObject('AnyMap', (testObject) => {
  it('createMap() contains every value type', () => {
    seedPrimitives(testObject)
    expect(testObject.createMap()).toEqual({
      number: 14,
      bool: true,
      string: 'hello!',
      int64: -7362572367826385n,
      null: null,
      array: expect.any(Array),
      object: expect.any(Object),
    })
  })

  it('createMap().array contains every value type', () => {
    seedPrimitives(testObject)
    expect(testObject.createMap().array).toEqual([
      testObject.numberValue,
      testObject.boolValue,
      testObject.stringValue,
      testObject.int64Value,
    ])
  })

  it('createMap().object contains every value type', () => {
    seedPrimitives(testObject)
    const values = [
      testObject.numberValue,
      testObject.boolValue,
      testObject.stringValue,
      testObject.int64Value,
    ]
    expect(testObject.createMap().object).toEqual({
      array: [...values, values],
      int64: testObject.int64Value,
      bool: testObject.boolValue,
      string: testObject.stringValue,
      number: testObject.numberValue,
      null: null,
    })
  })

  it('mapRoundtrip(...) returns an equal map', () => {
    seedPrimitives(testObject)
    const map = testObject.createMap()
    expect(testObject.mapRoundtrip(map)).toEqual(map)
  })

  it('getMapKeys(...) returns all keys', () => {
    seedPrimitives(testObject)
    const map = testObject.createMap()
    const keys = testObject.getMapKeys(map)
    expect([...keys].sort()).toEqual(Object.keys(map).sort())
  })

  it('mergeMaps(...) merges both maps', () => {
    expect(testObject.mergeMaps(TEST_MAP, TEST_MAP_2)).toEqual({
      ...TEST_MAP,
      ...TEST_MAP_2,
    })
  })

  it('copyAnyMap(...) returns an equal map', () => {
    expect(testObject.copyAnyMap(TEST_MAP_4)).toEqual(TEST_MAP_4)
  })
})

describeEachTestObject('Typed maps', (testObject) => {
  it('bounceMap(...) returns an equal map', () => {
    expect(testObject.bounceMap(TEST_MAP)).toEqual(TEST_MAP)
  })

  it('bounceSimpleMap(...) returns an equal map', () => {
    expect(testObject.bounceSimpleMap(TEST_MAP_3)).toEqual(TEST_MAP_3)
  })

  it('bounceOptionalMap(...) keeps undefined values', () => {
    expect(
      testObject.bounceOptionalMap({ a: 'b', c: undefined })
    ).toStrictEqual({ a: 'b', c: undefined })
  })

  it('bounceNullMap(...) keeps null values', () => {
    expect(testObject.bounceNullMap({ a: 'b', c: null })).toStrictEqual({
      a: 'b',
      c: null,
    })
  })

  it('bounceOptionalNullMap(...) keeps null and undefined values', () => {
    expect(
      testObject.bounceOptionalNullMap({ a: 'b', b: null, c: undefined })
    ).toStrictEqual({ a: 'b', b: null, c: undefined })
  })

  it('extractMap(...) returns mapWrapper.map', () => {
    expect(
      testObject.extractMap({
        map: TEST_MAP_2,
        secondMap: { second: TEST_MAP_2 },
      })
    ).toEqual(TEST_MAP_2)
  })
})
