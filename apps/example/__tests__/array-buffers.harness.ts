import { expect, it } from 'react-native-harness'
import { NitroModules } from 'react-native-nitro-modules'
import { HARDWARE_BUFFER_FORMATS } from './utils/fixtures'
import { itIf } from './utils/helpers'
import { describeEachTestObject, isKotlin } from './utils/testObjects'

const IS_DEBUG = NitroModules.buildType === 'debug'
const LARGE_BUFFER_SIZE = 16 * 1024 * 1024

// `createArrayBuffer()` allocates 10 MiB on every platform
const NATIVE_ARRAY_BUFFER_SIZE = 10 * 1024 * 1024
// The bytes `fillTestPattern(...)` writes at the indices it returns
const TEST_PATTERN = [0, 255, 17, 42]

/**
 * Fills {@linkcode array} with a recognizable pattern and returns the indices
 * the tests sample: the first byte, a marker at 73, the middle and the last
 * byte.
 */
function fillTestPattern(array: Uint8Array): number[] {
  array.fill(17)
  array[0] = 0
  array[73] = 255
  const last = array.length - 1
  array[last] = 42
  return [0, 73, Math.floor(array.length / 2), last]
}

function bytesAt(array: Uint8Array, indices: number[]): number[] {
  return indices.map((index) => array[index])
}

/**
 * Creates a JS ArrayBuffer of {@linkcode size} bytes where byte `i` is `i % 256`.
 */
function createCountingBuffer(size: number): ArrayBuffer {
  const array = new Uint8Array(size)
  for (let i = 0; i < size; i++) {
    array[i] = i % 256
  }
  return array.buffer
}

describeEachTestObject('ArrayBuffers', (testObject) => {
  it('createArrayBuffer() returns a 10 MiB ArrayBuffer', () => {
    const buffer = testObject.createArrayBuffer()
    expect(buffer).toBeInstanceOf(ArrayBuffer)
    expect(buffer.byteLength).toBe(NATIVE_ARRAY_BUFFER_SIZE)
  })

  it('createArrayBufferFromNativeBuffer(copy) returns an ArrayBuffer', () => {
    const buffer = testObject.createArrayBufferFromNativeBuffer(true)
    expect(buffer).toBeInstanceOf(ArrayBuffer)
    expect(buffer.byteLength).toBeGreaterThan(0)
  })

  it('createArrayBufferFromNativeBuffer(wrap) returns an ArrayBuffer', () => {
    const buffer = testObject.createArrayBufferFromNativeBuffer(false)
    expect(buffer).toBeInstanceOf(ArrayBuffer)
    expect(buffer.byteLength).toBeGreaterThan(0)
  })

  it('getBufferLastItem(...) returns the last byte', () => {
    const buffer = new Uint8Array([13, 20, 55])
    expect(testObject.getBufferLastItem(buffer.buffer)).toBe(55)
  })

  it('setAllValuesTo(...) fills every byte', () => {
    const buffer = new Uint8Array(30)
    testObject.setAllValuesTo(buffer.buffer, 55)
    expect(buffer).toEqual(new Uint8Array(30).fill(55))
  })

  it('createArrayBufferAsync() resolves to a 10 MiB ArrayBuffer', async () => {
    const buffer = await testObject.createArrayBufferAsync()
    expect(buffer).toBeInstanceOf(ArrayBuffer)
    expect(buffer.byteLength).toBe(NATIVE_ARRAY_BUFFER_SIZE)
  })

  const bufferKinds = [
    { name: 'JS', create: () => new ArrayBuffer(1024) },
    {
      name: 'native allocation',
      create: () => testObject.createArrayBuffer(),
    },
    {
      name: 'native buffer',
      create: () => testObject.createArrayBufferFromNativeBuffer(false),
    },
    {
      name: 'NitroModules.createNativeArrayBuffer',
      create: () => NitroModules.createNativeArrayBuffer(1024),
    },
  ]
  for (const { name, create } of bufferKinds) {
    it(`copyBuffer(${name}) copies bytes into independent memory`, () => {
      const original = create()
      const originalArray = new Uint8Array(original)
      const indices = fillTestPattern(originalArray)
      const last = originalArray.length - 1

      const copy = testObject.copyBuffer(original)
      const copyArray = new Uint8Array(copy)
      expect(copy).not.toBe(original)
      expect(copy.byteLength).toBe(original.byteLength)
      expect(bytesAt(copyArray, indices)).toEqual(TEST_PATTERN)

      // JS writes to either buffer must leave the other buffer unchanged.
      originalArray[73] = 11
      originalArray[last] = 12
      expect(
        [copyArray[73], testObject.getBufferLastItem(copy)],
        'copy after writing to the original'
      ).toEqual([255, 42])
      copyArray[73] = 21
      copyArray[last] = 22
      expect(
        [originalArray[73], testObject.getBufferLastItem(original)],
        'original after writing to the copy'
      ).toEqual([11, 12])

      // Native writes must also stay within the chosen allocation.
      testObject.setAllValuesTo(original, 31)
      expect(
        [copyArray[73], testObject.getBufferLastItem(copy)],
        'copy after a native write to the original'
      ).toEqual([21, 22])
      testObject.setAllValuesTo(copy, 41)
      expect(
        bytesAt(originalArray, indices),
        'original after a native write to the copy'
      ).toEqual([31, 31, 31, 31])
      expect(bytesAt(copyArray, indices), 'copy after a native write').toEqual([
        41, 41, 41, 41,
      ])
    })

    it(`bounceArrayBuffer(${name}) shares memory across roundtrips`, () => {
      const original = create()
      const originalArray = new Uint8Array(original)
      const indices = fillTestPattern(originalArray)
      const last = originalArray.length - 1

      const bounced = testObject.bounceArrayBuffer(original)
      const bouncedAgain = testObject.bounceArrayBuffer(bounced)
      const bouncedArray = new Uint8Array(bounced)
      const bouncedAgainArray = new Uint8Array(bouncedAgain)
      expect(bounced.byteLength).toBe(original.byteLength)
      expect(bouncedAgain.byteLength).toBe(original.byteLength)
      expect(bytesAt(bouncedArray, indices)).toEqual(TEST_PATTERN)
      expect(bytesAt(bouncedAgainArray, indices)).toEqual(TEST_PATTERN)

      // Mutating the original must reach both aliases and native readers.
      originalArray[73] = 11
      originalArray[last] = 12
      expect(
        [
          bouncedArray[73],
          testObject.getBufferLastItem(bounced),
          bouncedAgainArray[73],
          testObject.getBufferLastItem(bouncedAgain),
        ],
        'aliases after writing to the original'
      ).toEqual([11, 12, 11, 12])

      // Mutating the latest alias must reach the original and earlier alias.
      bouncedAgainArray[73] = 21
      bouncedAgainArray[last] = 22
      expect(
        [
          originalArray[73],
          testObject.getBufferLastItem(original),
          bouncedArray[73],
          testObject.getBufferLastItem(bounced),
        ],
        'original and first alias after writing to the latest alias'
      ).toEqual([21, 22, 21, 22])

      testObject.setAllValuesTo(bounced, 31)
      expect(
        bytesAt(originalArray, indices),
        'original after a native write to the first alias'
      ).toEqual([31, 31, 31, 31])
      expect(
        bytesAt(bouncedAgainArray, indices),
        'latest alias after a native write to the first alias'
      ).toEqual([31, 31, 31, 31])
    })
  }

  it('bounceArrayBuffer(js buffer) returns the same ArrayBuffer', () => {
    const originalArray = new Uint8Array(100)
    originalArray[73] = 4
    const bounced = testObject.bounceArrayBuffer(originalArray.buffer)
    expect(bounced).toBe(originalArray.buffer)
    expect(new Uint8Array(bounced)[73]).toBe(4)
  })
})

describeEachTestObject('HardwareBuffers', (testObject) => {
  for (const { format, bytesPerPixel } of HARDWARE_BUFFER_FORMATS) {
    it(`createHardwareBuffer(${format}) size is in bytes`, () => {
      const buffer = testObject.createHardwareBuffer(100, 100, 1, format)
      // On Android the row stride may be padded, so the size can be larger -
      // but if the size was computed in pixels instead of bytes, it'd be smaller.
      expect(buffer.byteLength).toBeGreaterThanOrEqual(
        100 * 100 * bytesPerPixel
      )
    })
  }

  it('createHardwareBuffer(blob) size is exactly `width` bytes', () => {
    // BLOB HardwareBuffers hold exactly `width` bytes flat.
    const buffer = testObject.createHardwareBuffer(12345, 1, 1, 'blob')
    expect(buffer.byteLength).toBe(12345)
  })

  it('copyBuffer(createHardwareBuffer(..)) keeps size and data', () => {
    const original = testObject.createHardwareBuffer(100, 100, 1, 'rgba-8888')
    const originalArray = new Uint8Array(original)
    originalArray[originalArray.length - 1] = 42
    const copy = testObject.copyBuffer(original)
    const copyArray = new Uint8Array(copy)
    expect(copy.byteLength).toBe(original.byteLength)
    expect(copyArray[copyArray.length - 1]).toBe(42)
  })
})

describeEachTestObject('ArrayBuffer edge cases', (testObject) => {
  it('bounceArrayBuffer(empty buffer) returns the same buffer', () => {
    const empty = new ArrayBuffer(0)
    expect(testObject.bounceArrayBuffer(empty)).toBe(empty)
  })

  it('copyBuffer(empty buffer) returns an empty ArrayBuffer', () => {
    const copy = testObject.copyBuffer(new ArrayBuffer(0))
    expect(copy).toBeInstanceOf(ArrayBuffer)
    expect(copy.byteLength).toBe(0)
  })

  it('getBufferLastItem(1-byte buffer) returns that byte', () => {
    expect(testObject.getBufferLastItem(new Uint8Array([42]).buffer)).toBe(42)
  })

  it('setAllValuesTo(1-byte buffer) sets that byte', () => {
    const array = new Uint8Array(1)
    testObject.setAllValuesTo(array.buffer, 42)
    expect(array[0]).toBe(42)
  })

  for (const value of [0, 127, 128, 255]) {
    // TODO: Fix HybridTestObjectKotlin.getBufferLastItem - it converts a
    // signed Kotlin `Byte` to Double, so it returns -128 for 128 and -1 for 255.
    const isKotlinSignedByte = isKotlin(testObject) && value > 127
    itIf(!isKotlinSignedByte)(
      `getBufferLastItem(...) reads ${value} as an unsigned byte`,
      () => {
        const array = new Uint8Array([1, 2, value])
        expect(testObject.getBufferLastItem(array.buffer)).toBe(value)
      }
    )
  }

  for (const value of [0, 128, 255]) {
    it(`setAllValuesTo(..., ${value}) writes ${value} to every byte`, () => {
      const array = new Uint8Array(16).fill(7)
      testObject.setAllValuesTo(array.buffer, value)
      expect(array).toEqual(new Uint8Array(16).fill(value))
    })
  }

  it('copyBuffer(...) copies every byte of an odd-sized buffer', () => {
    const original = createCountingBuffer(4099)
    const copy = testObject.copyBuffer(original)
    expect(copy.byteLength).toBe(original.byteLength)
    // Compares Uint8Array views - `toEqual` ignores ArrayBuffer contents.
    expect(new Uint8Array(copy)).toEqual(new Uint8Array(original))
  })

  it('copyBuffer(16 MiB buffer) keeps its size and bytes', () => {
    const original = new Uint8Array(LARGE_BUFFER_SIZE)
    original[0] = 7
    original[LARGE_BUFFER_SIZE / 2] = 99
    original[LARGE_BUFFER_SIZE - 1] = 42
    const copy = new Uint8Array(testObject.copyBuffer(original.buffer))
    expect(copy.byteLength).toBe(LARGE_BUFFER_SIZE)
    expect([
      copy[0],
      copy[LARGE_BUFFER_SIZE / 2],
      copy[LARGE_BUFFER_SIZE - 1],
    ]).toEqual([7, 99, 42])
  })

  it('getBufferLastItem(view.buffer) reads the whole underlying buffer', () => {
    // `.buffer` of a view is the entire backing ArrayBuffer, not just the view.
    const view = new Uint8Array([1, 2, 3, 4]).subarray(0, 2)
    expect(testObject.getBufferLastItem(view.buffer)).toBe(4)
  })

  it('createArrayBuffer() returns independent memory every call', () => {
    const a = new Uint8Array(testObject.createArrayBuffer())
    const b = new Uint8Array(testObject.createArrayBuffer())
    a[0] = 1
    b[0] = 2
    expect([a[0], b[0]]).toEqual([1, 2])
  })

  itIf(IS_DEBUG)(
    'getBufferLastItem(Uint8Array) throws a TypedArray hint',
    () => {
      const typedArray = new Uint8Array([1, 2, 3])
      // @ts-expect-error - a Uint8Array is not an ArrayBuffer
      const getLastItem = () => testObject.getBufferLastItem(typedArray)
      expect(getLastItem).toThrow(`${testObject.name}.getBufferLastItem(...)`)
      expect(getLastItem).toThrow(
        'Object "1,2,3" is not an ArrayBuffer! Are you maybe passing a TypedArray (e.g. Uint8Array)? Try to pass its `.buffer` value.'
      )
    }
  )

  itIf(IS_DEBUG)('getBufferLastItem({}) throws "is not an ArrayBuffer"', () => {
    // @ts-expect-error - a plain object is not an ArrayBuffer
    expect(() => testObject.getBufferLastItem({})).toThrow(
      'Object "[object Object]" is not an ArrayBuffer!'
    )
  })

  itIf(IS_DEBUG)(
    'getBufferLastItem(number) throws "not even an object"',
    () => {
      // @ts-expect-error - a number is not an ArrayBuffer
      expect(() => testObject.getBufferLastItem(55)).toThrow(
        `Value "55" is not an ArrayBuffer - in fact, it's not even an object!`
      )
    }
  )
})

describeEachTestObject('ArrayBuffer identity', (testObject) => {
  it('bounceArrayBuffers(...) returns the same JS ArrayBuffers', () => {
    const a = new ArrayBuffer(8)
    const b = new ArrayBuffer(16)
    const result = testObject.bounceArrayBuffers([a, b, a])
    expect(result).toHaveLength(3)
    expect(result[0]).toBe(a)
    expect(result[1]).toBe(b)
    expect(result[2]).toBe(a)
  })

  it('bounceOptionalWrapper(...) keeps the same JS ArrayBuffer', () => {
    const buffer = new ArrayBuffer(8)
    expect(
      testObject.bounceOptionalWrapper({ optionalArrayBuffer: buffer })
        .optionalArrayBuffer
    ).toBe(buffer)
  })

  it('bounceComplexVariant(...) returns the same JS ArrayBuffer', () => {
    const buffer = new ArrayBuffer(8)
    expect(testObject.bounceComplexVariant(buffer)).toBe(buffer)
  })
})
