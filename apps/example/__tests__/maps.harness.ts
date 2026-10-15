import { expect, it } from 'react-native-harness'
import type { AnyMap, ValueType } from 'react-native-nitro-modules'
import { TEST_MAP, TEST_MAP_2, TEST_MAP_3, TEST_MAP_4 } from './utils/fixtures'
import { itIf } from './utils/helpers'
import {
  describeEachTestObject,
  type TestObject,
  isSwift,
} from './utils/testObjects'

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

const INT64_MIN = -(2n ** 63n)
const INT64_MAX = 2n ** 63n - 1n

// An AnyMap with objects and arrays nested a few levels deep.
const NESTED_MAP: AnyMap = {
  level1: {
    level2: {
      level3: {
        array: [1, ['two', [true, { deepest: 'value', bigint: 42n }]]],
      },
      empty: {},
    },
    emptyArray: [],
  },
  mixed: [1, 'two', false, 3n, [], {}],
}

function createKeys(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `key_${i}`)
}

// Every AnyMap value type, each kept as the only value of a map.
const ANY_MAP_VALUES: ReadonlyArray<[label: string, value: ValueType]> = [
  ['integer number', 55],
  ['fractional number', -13.37],
  ['true', true],
  ['false', false],
  ['string', 'hello'],
  ['empty string', ''],
  ['null', null],
  ['bigint', 1234567890123n],
  ['negative bigint', -55n],
  ['empty array', []],
  ['empty object', {}],
]

describeEachTestObject('AnyMap values', (testObject) => {
  for (const [label, value] of ANY_MAP_VALUES) {
    it(`mapRoundtrip(...) keeps a ${label} value`, () => {
      expect(testObject.mapRoundtrip({ value })).toStrictEqual({ value })
    })
  }

  it('mapRoundtrip(...) keeps the int64 boundaries as bigints', () => {
    expect(
      testObject.mapRoundtrip({ min: INT64_MIN, max: INT64_MAX })
    ).toStrictEqual({ min: INT64_MIN, max: INT64_MAX })
  })

  it('mapRoundtrip(...) keeps numbers beyond 2^53 as numbers', () => {
    const map = { big: 2 ** 64, max: Number.MAX_VALUE }
    expect(testObject.mapRoundtrip(map)).toStrictEqual(map)
  })

  it('mapRoundtrip(...) keeps nested objects and arrays', () => {
    expect(testObject.mapRoundtrip(NESTED_MAP)).toStrictEqual(NESTED_MAP)
  })

  it('mapRoundtrip(...) keeps null inside arrays', () => {
    const map = { array: [null, 1, null] }
    expect(testObject.mapRoundtrip(map)).toStrictEqual(map)
  })

  it('mapRoundtrip(...) keeps null inside objects', () => {
    const map = { object: { a: null, b: 1 } }
    expect(testObject.mapRoundtrip(map)).toStrictEqual(map)
  })

  it('copyAnyMap(...) keeps nested objects and arrays', () => {
    expect(testObject.copyAnyMap(NESTED_MAP)).toStrictEqual(NESTED_MAP)
  })

  // TODO: Fix in Nitro - Swift `AnyValue.fromAny(...)` (ios/core/AnyMap.swift) does not unwrap a nested `Optional<Any>.none` from `toAny()`, so on Swift copyAnyMap throws "Value Optional(nil) cannot be represented as AnyValue!"
  itIf(!isSwift(testObject))('copyAnyMap(...) keeps null inside arrays', () => {
    const map = { array: [null, 1, null] }
    expect(testObject.copyAnyMap(map)).toStrictEqual(map)
  })

  // TODO: Fix in Nitro - Swift `AnyValue.fromAny(...)` (ios/core/AnyMap.swift) does not unwrap a nested `Optional<Any>.none` from `toAny()`, so on Swift copyAnyMap throws "Value Optional(nil) cannot be represented as AnyValue!"
  itIf(!isSwift(testObject))(
    'copyAnyMap(...) keeps null inside objects',
    () => {
      const map = { object: { a: null, b: 1 } }
      expect(testObject.copyAnyMap(map)).toStrictEqual(map)
    }
  )

  it('copyAnyMap(...) keeps the int64 boundaries as bigints', () => {
    expect(
      testObject.copyAnyMap({ min: INT64_MIN, max: INT64_MAX })
    ).toStrictEqual({ min: INT64_MIN, max: INT64_MAX })
  })

  it('mapRoundtrip(...) returns a new object', () => {
    const map = { a: 1 }
    expect(testObject.mapRoundtrip(map)).not.toBe(map)
  })
})

describeEachTestObject('AnyMap keys', (testObject) => {
  it('mapRoundtrip(...) returns {} for an empty map', () => {
    expect(testObject.mapRoundtrip({})).toStrictEqual({})
  })

  it('copyAnyMap(...) returns {} for an empty map', () => {
    expect(testObject.copyAnyMap({})).toStrictEqual({})
  })

  it('getMapKeys(...) returns [] for an empty map', () => {
    expect(testObject.getMapKeys({})).toStrictEqual([])
  })

  it('mapRoundtrip(...) keeps 1,000 keys', () => {
    const map = Object.fromEntries(createKeys(1_000).map((key, i) => [key, i]))
    expect(testObject.mapRoundtrip(map)).toStrictEqual(map)
  })

  it('getMapKeys(...) returns each of 1,000 keys once', () => {
    const keys = createKeys(1_000)
    const map = Object.fromEntries(keys.map((key) => [key, true]))
    expect([...testObject.getMapKeys(map)].sort()).toEqual([...keys].sort())
  })

  // TODO: Fix in Nitro - values of non-ASCII keys are read as undefined (`PropNameIDCache` uses `PropNameID::forAscii`), throws 'Cannot convert "undefined" to any type in variant<...>'
  // it('mapRoundtrip(...) keeps unicode keys', () => {
  //   const map = { '🔥': 1, 'ключ': 'значение', '日本語': true }
  //   expect(testObject.mapRoundtrip(map)).toStrictEqual(map)
  // })

  it('mapRoundtrip(...) keeps an empty string key', () => {
    expect(testObject.mapRoundtrip({ '': 'empty' })).toStrictEqual({
      '': 'empty',
    })
  })

  it('mapRoundtrip(...) keeps numeric keys', () => {
    const map = { 0: 'zero', 42: 'answer' }
    expect(testObject.mapRoundtrip(map)).toStrictEqual(map)
  })
})

describeEachTestObject('AnyMap merging', (testObject) => {
  it('mergeMaps(...) returns {} for two empty maps', () => {
    expect(testObject.mergeMaps({}, {})).toStrictEqual({})
  })

  it('mergeMaps(...) returns the first map for an empty second map', () => {
    expect(testObject.mergeMaps({ a: 1, b: 'b' }, {})).toStrictEqual({
      a: 1,
      b: 'b',
    })
  })

  it('mergeMaps(...) returns the second map for an empty first map', () => {
    expect(testObject.mergeMaps({}, { a: 1, b: 'b' })).toStrictEqual({
      a: 1,
      b: 'b',
    })
  })

  it('mergeMaps(...) prefers values of the second map', () => {
    expect(
      testObject.mergeMaps({ a: 1, shared: 2 }, { shared: 3, b: 4 })
    ).toStrictEqual({ a: 1, shared: 3, b: 4 })
  })

  it('mergeMaps(...) replaces a value with one of a different type', () => {
    expect(
      testObject.mergeMaps({ shared: 1 }, { shared: [1n, 'one'] })
    ).toStrictEqual({ shared: [1n, 'one'] })
  })

  it('mergeMaps(...) replaces nested objects instead of merging them', () => {
    expect(
      testObject.mergeMaps({ nested: { a: 1, b: 2 } }, { nested: { b: 3 } })
    ).toStrictEqual({ nested: { b: 3 } })
  })
})

describeEachTestObject('AnyMap conversion errors', (testObject) => {
  it('mapRoundtrip(...) rejects a number', () => {
    // @ts-expect-error passing a number instead of an AnyMap
    expect(() => testObject.mapRoundtrip(5)).toThrow(
      `${testObject.name}.mapRoundtrip(...): Value is a number, expected an Object`
    )
  })

  it('mapRoundtrip(...) rejects undefined values', () => {
    // @ts-expect-error passing an undefined value
    expect(() => testObject.mapRoundtrip({ a: undefined })).toThrow(
      `${testObject.name}.mapRoundtrip(...): Cannot convert "undefined" to any type in variant<`
    )
  })

  it('mapRoundtrip(...) rejects undefined inside an array', () => {
    // @ts-expect-error passing an undefined array element
    expect(() => testObject.mapRoundtrip({ a: [1, undefined] })).toThrow(
      `${testObject.name}.mapRoundtrip(...): Cannot convert "undefined" to any type in variant<`
    )
  })

  it('mapRoundtrip(...) rejects function values', () => {
    // @ts-expect-error passing a function value
    const roundtrip = () => testObject.mapRoundtrip({ a: () => {} })
    expect(roundtrip).toThrow(
      `${testObject.name}.mapRoundtrip(...): Cannot convert "`
    )
    expect(roundtrip).toThrow('to any type in variant<')
  })

  it('mapRoundtrip(...) rejects ArrayBuffer values', () => {
    // @ts-expect-error passing an ArrayBuffer value
    const roundtrip = () => testObject.mapRoundtrip({ a: new ArrayBuffer(8) })
    expect(roundtrip).toThrow(
      `${testObject.name}.mapRoundtrip(...): Cannot convert "[object ArrayBuffer]" to any type in variant<`
    )
  })

  it('mapRoundtrip(...) rejects a bigint beyond int64', () => {
    expect(() => testObject.mapRoundtrip({ a: INT64_MAX + 1n })).toThrow(
      `${testObject.name}.mapRoundtrip(...): Cannot convert "9223372036854775808" to any type in variant<`
    )
  })
})

describeEachTestObject('Typed map edge cases', (testObject) => {
  it('bounceSimpleMap(...) returns {} for an empty map', () => {
    expect(testObject.bounceSimpleMap({})).toStrictEqual({})
  })

  it('bounceSimpleMap(...) keeps 1,000 keys', () => {
    const map = Object.fromEntries(createKeys(1_000).map((key, i) => [key, i]))
    expect(testObject.bounceSimpleMap(map)).toStrictEqual(map)
  })

  // TODO: Fix in Nitro - values of non-ASCII keys are read as undefined (`PropNameIDCache` uses `PropNameID::forAscii`, also used by `JSIConverter<unordered_map>::toJSI` for the returned keys), throws "Value is undefined, expected a number"
  // it('bounceSimpleMap(...) keeps unicode keys', () => {
  //   const map = { '🔥': 1, 'ключ': 2, '日本語': 3 }
  //   expect(testObject.bounceSimpleMap(map)).toStrictEqual(map)
  // })

  it('bounceMap(...) keeps booleans and numbers apart', () => {
    const map = { zero: 0, one: 1, no: false, yes: true }
    expect(testObject.bounceMap(map)).toStrictEqual(map)
  })

  it('extractMap(...) returns {} for an empty map', () => {
    expect(
      testObject.extractMap({ map: {}, secondMap: { second: {} } })
    ).toStrictEqual({})
  })

  it('bounceSimpleMap(...) rejects a number', () => {
    // @ts-expect-error passing a number instead of a map
    expect(() => testObject.bounceSimpleMap(5)).toThrow(
      `${testObject.name}.bounceSimpleMap(...): Value is a number, expected an Object`
    )
  })

  it('bounceSimpleMap(...) rejects a string value', () => {
    // @ts-expect-error passing a string value
    expect(() => testObject.bounceSimpleMap({ a: 1, b: '2' })).toThrow(
      `${testObject.name}.bounceSimpleMap(...): Value is a string, expected a number`
    )
  })

  it('bounceMap(...) rejects a string value', () => {
    // @ts-expect-error passing a string value
    expect(() => testObject.bounceMap({ a: 'yes' })).toThrow(
      `${testObject.name}.bounceMap(...): Cannot convert "yes" to any type in variant<`
    )
  })

  it('bounceOptionalMap(...) rejects null values', () => {
    // @ts-expect-error passing null where only undefined is optional
    expect(() => testObject.bounceOptionalMap({ a: null })).toThrow(
      `${testObject.name}.bounceOptionalMap(...): Value is null, expected a String`
    )
  })

  it('bounceNullMap(...) rejects undefined values', () => {
    // @ts-expect-error passing undefined where only null is allowed
    expect(() => testObject.bounceNullMap({ a: undefined })).toThrow(
      `${testObject.name}.bounceNullMap(...): Cannot convert "undefined" to any type in variant<`
    )
  })

  it('extractMap(...) rejects a missing secondMap', () => {
    // @ts-expect-error passing a MapWrapper without secondMap
    expect(() => testObject.extractMap({ map: {} })).toThrow(
      `${testObject.name}.extractMap(...): Value is undefined, expected an Object`
    )
  })
})
