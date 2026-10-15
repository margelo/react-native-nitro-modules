import { expect, fn, it, waitFor } from 'react-native-harness'
import { HybridChild, type Powertrain } from 'react-native-nitro-test'
import { TEST_MAP, TEST_MAP_2 } from './utils/fixtures'
import { itIf } from './utils/helpers'
import {
  describeEachTestObject,
  type TestObject,
  isKotlin,
} from './utils/testObjects'

/**
 * The size and the first, middle and last 16 bytes of `buffer`. The native
 * buffers are 10 MB - too large to compare (and print) byte by byte.
 */
function sampleBytes(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  const middle = Math.floor(bytes.length / 2)
  return {
    byteLength: buffer.byteLength,
    first: bytes.slice(0, 16),
    middle: bytes.slice(middle, middle + 16),
    last: bytes.slice(-16),
  }
}

describeEachTestObject('Arrays', (testObject) => {
  it('bounceNumbers(...) returns the same numbers', () => {
    expect(testObject.bounceNumbers([1, 2, 13, 42])).toEqual([1, 2, 13, 42])
  })

  it('bounceStrings(...) returns the same simple strings', () => {
    expect(testObject.bounceStrings(['hello', 'world', '!'])).toEqual([
      'hello',
      'world',
      '!',
    ])
  })

  it('bounceStrings(...) returns the same unicode/emoji strings', () => {
    expect(testObject.bounceStrings(['✨', '🔥', '🥳🥷🏼🥳'])).toEqual([
      '✨',
      '🔥',
      '🥳🥷🏼🥳',
    ])
  })

  it('bounceOptionals(...) keeps undefined elements', () => {
    const result = testObject.bounceOptionals(
      ['hello', undefined, 'world'],
      [new ArrayBuffer(16), undefined]
    )
    expect(result).toStrictEqual(['hello', undefined, 'world'])
  })

  it('bounceNulls(...) keeps null elements', () => {
    expect(testObject.bounceNulls(['hello', null, 'world'])).toStrictEqual([
      'hello',
      null,
      'world',
    ])
  })

  it('bounceOptionalNulls(...) keeps null and undefined elements', () => {
    expect(
      testObject.bounceOptionalNulls(['hello', null, undefined])
    ).toStrictEqual(['hello', null, undefined])
  })

  it('bounceEnums(...) returns the same enum values', () => {
    expect(testObject.bounceEnums(['gas', 'hybrid'])).toEqual(['gas', 'hybrid'])
  })

  it('bounceStructs(...) returns the same structs', () => {
    const people = [
      { age: 24, name: 'Marc' },
      { age: 5, name: 'Ben' },
    ]
    expect(testObject.bounceStructs(people)).toEqual([
      { age: 24, name: 'Marc' },
      { age: 5, name: 'Ben' },
    ])
  })

  it('bounceNestedArray(...) returns the same nested arrays', () => {
    const nested = [
      [
        { age: 24, name: 'Marc' },
        { age: 5, name: 'Ben' },
      ],
      [{ age: 30, name: 'Anna' }],
      [],
    ]
    expect(testObject.bounceNestedArray(nested)).toEqual([
      [
        { age: 24, name: 'Marc' },
        { age: 5, name: 'Ben' },
      ],
      [{ age: 30, name: 'Anna' }],
      [],
    ])
  })
})

describeEachTestObject('Arrays of complex types', (testObject) => {
  it('complexEnumCallback(...) calls back with the same enum array', async () => {
    const callback = fn<(array: Powertrain[]) => void>()
    testObject.complexEnumCallback(['gas', 'electric'], callback)
    await waitFor(() => expect(callback).toHaveBeenCalledTimes(1), {
      timeout: 2000,
    })
    expect(callback).toHaveBeenCalledWith(['gas', 'electric'])
  })

  it('bounceHybridObjects(...) returns the same HybridObjects in order', () => {
    const child = testObject.createChild()
    const bounced = testObject.bounceHybridObjects([
      HybridChild,
      child,
      HybridChild,
    ])
    expect(bounced).toHaveLength(3)
    expect(bounced[0]).toBe(HybridChild)
    expect(bounced[1]).toBe(child)
    expect(bounced[2]).toBe(HybridChild)
  })

  it('bounceFunctions(...) returns callable functions', async () => {
    const first = fn()
    const second = fn()
    const bounced = testObject.bounceFunctions([first, second])
    expect(bounced).toEqual([expect.any(Function), expect.any(Function)])

    for (const bouncedFunction of bounced) {
      bouncedFunction()
    }
    await waitFor(
      () => {
        expect(first).toHaveBeenCalledTimes(1)
        expect(second).toHaveBeenCalledTimes(1)
      },
      { timeout: 2000 }
    )
  })

  it('bounceMaps(...) returns the same maps', () => {
    expect(testObject.bounceMaps([TEST_MAP, TEST_MAP_2])).toEqual([
      TEST_MAP,
      TEST_MAP_2,
    ])
  })

  it('bouncePromises(...) returns promises with the same results', async () => {
    const bounced = testObject.bouncePromises([
      (async () => 55)(),
      Promise.resolve(13),
    ])
    expect(bounced).toEqual([expect.any(Promise), expect.any(Promise)])
    await expect(Promise.all(bounced)).resolves.toEqual([55, 13])
  })

  it('bounceArrayBuffers(...) returns ArrayBuffers with the same bytes', () => {
    const jsBytes = Uint8Array.from({ length: 50 }, (_, i) => i + 1)
    const buffers = [
      testObject.createArrayBuffer(),
      testObject.createArrayBufferFromNativeBuffer(false),
      testObject.createArrayBufferFromNativeBuffer(true),
      jsBytes.buffer,
    ]
    const bounced = testObject.bounceArrayBuffers(buffers)
    expect(bounced).toEqual([
      expect.any(ArrayBuffer),
      expect.any(ArrayBuffer),
      expect.any(ArrayBuffer),
      expect.any(ArrayBuffer),
    ])
    expect(bounced.map(sampleBytes)).toEqual(buffers.map(sampleBytes))
    expect(new Uint8Array(bounced[3]!)).toEqual(jsBytes)
  })
})

// Calls every array method of the spec with an empty array.
const EMPTY_ARRAY_CALLS: ReadonlyArray<
  [method: string, call: (testObject: TestObject) => unknown[]]
> = [
  ['bounceNumbers', (testObject) => testObject.bounceNumbers([])],
  ['bounceStrings', (testObject) => testObject.bounceStrings([])],
  ['bounceStructs', (testObject) => testObject.bounceStructs([])],
  ['bounceNestedArray', (testObject) => testObject.bounceNestedArray([])],
  ['bounceEnums', (testObject) => testObject.bounceEnums([])],
  ['bounceHybridObjects', (testObject) => testObject.bounceHybridObjects([])],
  ['bounceFunctions', (testObject) => testObject.bounceFunctions([])],
  ['bounceMaps', (testObject) => testObject.bounceMaps([])],
  ['bouncePromises', (testObject) => testObject.bouncePromises([])],
  ['bounceArrayBuffers', (testObject) => testObject.bounceArrayBuffers([])],
  ['bounceOptionals', (testObject) => testObject.bounceOptionals([], [])],
  ['bounceNulls', (testObject) => testObject.bounceNulls([])],
  ['bounceOptionalNulls', (testObject) => testObject.bounceOptionalNulls([])],
]

describeEachTestObject('Empty arrays', (testObject) => {
  for (const [method, call] of EMPTY_ARRAY_CALLS) {
    it(`${method}(...) returns an empty array for []`, () => {
      expect(call(testObject)).toStrictEqual([])
    })
  }

  it('bounceNestedArray(...) keeps empty inner arrays', () => {
    expect(testObject.bounceNestedArray([[], [], []])).toStrictEqual([
      [],
      [],
      [],
    ])
  })

  it('complexEnumCallback(...) calls back with an empty array', async () => {
    const callback = fn<(array: Powertrain[]) => void>()
    testObject.complexEnumCallback([], callback)
    await waitFor(() => expect(callback).toHaveBeenCalledTimes(1), {
      timeout: 2000,
    })
    expect(callback).toHaveBeenCalledWith([])
  })
})

describeEachTestObject('Array values', (testObject) => {
  it('bounceNumbers(...) returns a new array', () => {
    const numbers = [1, 2, 3]
    const result = testObject.bounceNumbers(numbers)
    expect(result).not.toBe(numbers)
    expect(result).toEqual(numbers)
  })

  it('bounceNumbers(...) keeps -0', () => {
    expect(testObject.bounceNumbers([-0, 0])).toEqual([-0, 0])
  })

  it('bounceNumbers(...) keeps NaN and Infinity', () => {
    expect(testObject.bounceNumbers([NaN, Infinity, -Infinity])).toEqual([
      NaN,
      Infinity,
      -Infinity,
    ])
  })

  it('bounceNumbers(...) keeps extreme doubles', () => {
    const extremes = [
      Number.MAX_VALUE,
      -Number.MAX_VALUE,
      Number.MIN_VALUE,
      Number.MAX_SAFE_INTEGER,
      Number.MIN_SAFE_INTEGER,
      Number.EPSILON,
      0.1 + 0.2,
    ]
    expect(testObject.bounceNumbers(extremes)).toEqual(extremes)
  })

  it('bounceNumbers(...) returns all 10,000 numbers', () => {
    const numbers = Array.from({ length: 10_000 }, (_, i) => i * 1.5 - 500)
    expect(testObject.bounceNumbers(numbers)).toEqual(numbers)
  })

  it('bounceStrings(...) returns all 10,000 strings', () => {
    const strings = Array.from({ length: 10_000 }, (_, i) => `string #${i}`)
    expect(testObject.bounceStrings(strings)).toEqual(strings)
  })

  it('bounceStrings(...) keeps empty strings', () => {
    expect(testObject.bounceStrings(['', 'a', ''])).toEqual(['', 'a', ''])
  })

  // TODO: Fix in Nitro - bounceStrings(...) truncates strings at the first NUL on Kotlin (JHybridTestObjectSwiftKotlinSpec uses jni::make_jstring(std::string), which reads c_str()), so ['a\0b', '\0'] comes back as ['a', '']; C++ and Swift keep them
  itIf(!isKotlin(testObject))('bounceStrings(...) keeps NUL characters', () => {
    expect(testObject.bounceStrings(['a\0b', '\0'])).toEqual(['a\0b', '\0'])
  })

  it('bounceStrings(...) keeps a 100,000 character string', () => {
    const long = 'nitro🔥!'.repeat(100_000 / 8)
    expect(testObject.bounceStrings([long])).toEqual([long])
  })

  it('bounceStructs(...) returns all 1,000 structs', () => {
    const people = Array.from({ length: 1_000 }, (_, i) => ({
      name: `Person #${i}`,
      age: i,
    }))
    expect(testObject.bounceStructs(people)).toEqual(people)
  })

  it('bounceStructs(...) drops unknown keys of each element', () => {
    const person = { name: 'Marc', age: 24, nickname: 'mrousavy' }
    expect(testObject.bounceStructs([person])).toStrictEqual([
      { name: 'Marc', age: 24 },
    ])
  })

  it('bounceEnums(...) keeps duplicates and their order', () => {
    expect(
      testObject.bounceEnums(['hybrid', 'gas', 'hybrid', 'electric'])
    ).toEqual(['hybrid', 'gas', 'hybrid', 'electric'])
  })

  it('bounceOptionals(...) keeps an array of only undefined', () => {
    expect(
      testObject.bounceOptionals([undefined, undefined], [])
    ).toStrictEqual([undefined, undefined])
  })
})

describeEachTestObject('Array conversion errors', (testObject) => {
  it('bounceNumbers(...) rejects a number', () => {
    // @ts-expect-error passing a number instead of an array
    expect(() => testObject.bounceNumbers(5)).toThrow(
      `${testObject.name}.bounceNumbers(...): Value is a number, expected an Object`
    )
  })

  it('bounceNumbers(...) rejects undefined', () => {
    // @ts-expect-error passing undefined instead of an array
    expect(() => testObject.bounceNumbers(undefined)).toThrow(
      `${testObject.name}.bounceNumbers(...): Value is undefined, expected an Object`
    )
  })

  it('bounceNumbers(...) rejects an array-like object', () => {
    const arrayLike = { length: 2, 0: 1, 1: 2 }
    // @ts-expect-error passing an array-like object instead of an array
    expect(() => testObject.bounceNumbers(arrayLike)).toThrow(
      `${testObject.name}.bounceNumbers(...): Object is an object, expected an array`
    )
  })

  it('bounceNumbers(...) rejects a typed array', () => {
    const typedArray = new Float64Array([1, 2])
    // @ts-expect-error passing a Float64Array instead of an array
    expect(() => testObject.bounceNumbers(typedArray)).toThrow(
      `${testObject.name}.bounceNumbers(...): Object is an object, expected an array`
    )
  })

  it('bounceNumbers(...) rejects a string element', () => {
    // @ts-expect-error passing a string element
    expect(() => testObject.bounceNumbers([1, '2'])).toThrow(
      `${testObject.name}.bounceNumbers(...): Value is a string, expected a number`
    )
  })

  it('bounceNumbers(...) rejects a bigint element', () => {
    // @ts-expect-error passing a bigint element
    expect(() => testObject.bounceNumbers([1, 2n])).toThrow(
      `${testObject.name}.bounceNumbers(...): Value is a bigint, expected a number`
    )
  })

  it('bounceStrings(...) rejects a number element', () => {
    // @ts-expect-error passing a number element
    expect(() => testObject.bounceStrings(['a', 5])).toThrow(
      `${testObject.name}.bounceStrings(...): Value is a number, expected a String`
    )
  })

  it('bounceStrings(...) rejects a null element', () => {
    // @ts-expect-error passing a null element
    expect(() => testObject.bounceStrings(['a', null])).toThrow(
      `${testObject.name}.bounceStrings(...): Value is null, expected a String`
    )
  })

  it('bounceEnums(...) rejects an unknown enum value', () => {
    // @ts-expect-error passing an unknown Powertrain
    expect(() => testObject.bounceEnums(['gas', 'diesel'])).toThrow(
      `${testObject.name}.bounceEnums(...): Cannot convert "diesel" to enum Powertrain - invalid value!`
    )
  })

  it('bounceStructs(...) rejects an element with a missing field', () => {
    // @ts-expect-error passing a Person without an age
    expect(() => testObject.bounceStructs([{ name: 'Marc' }])).toThrow(
      `${testObject.name}.bounceStructs(...): Value is undefined, expected a number`
    )
  })

  it('bounceStructs(...) rejects a non-object element', () => {
    // @ts-expect-error passing a string instead of a Person
    expect(() => testObject.bounceStructs(['Marc'])).toThrow(
      `${testObject.name}.bounceStructs(...): Value is a string, expected an Object`
    )
  })

  it('bounceNestedArray(...) rejects a struct instead of an inner array', () => {
    const person = { name: 'Marc', age: 24 }
    // @ts-expect-error passing a Person instead of Person[]
    expect(() => testObject.bounceNestedArray([[person], person])).toThrow(
      `${testObject.name}.bounceNestedArray(...): Object is an object, expected an array`
    )
  })

  it('bounceOptionals(...) rejects null elements', () => {
    // @ts-expect-error passing null where only undefined is optional
    expect(() => testObject.bounceOptionals(['a', null], [])).toThrow(
      `${testObject.name}.bounceOptionals(...): Value is null, expected a String`
    )
  })

  it('bounceNulls(...) rejects undefined elements', () => {
    // @ts-expect-error passing undefined where only null is allowed
    expect(() => testObject.bounceNulls(['a', undefined])).toThrow(
      `${testObject.name}.bounceNulls(...): Cannot convert "undefined" to any type in variant<`
    )
  })

  it('bounceOptionalNulls(...) rejects a number element', () => {
    // @ts-expect-error passing a number element
    expect(() => testObject.bounceOptionalNulls(['a', 5])).toThrow(
      `${testObject.name}.bounceOptionalNulls(...): Cannot convert "5" to any type in variant<`
    )
  })

  it('bounceFunctions(...) rejects a non-function element', () => {
    // @ts-expect-error passing an object instead of a function
    expect(() => testObject.bounceFunctions([() => {}, {}])).toThrow(
      `${testObject.name}.bounceFunctions(...): Object is an object, expected a function`
    )
  })
})
