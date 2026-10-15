import { expect, it } from 'react-native-harness'
import { HARDWARE_BUFFER_FORMATS } from './utils/fixtures'
import { describeEachTestObject } from './utils/testObjects'

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
