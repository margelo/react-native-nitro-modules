import { expect, fn, it, waitFor } from 'react-native-harness'
import { HybridChild, type Powertrain } from 'react-native-nitro-test'
import { TEST_MAP, TEST_MAP_2 } from './utils/fixtures'
import { describeEachTestObject } from './utils/testObjects'

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

  it('bounceHybridObjects(...) returns the same HybridObjects', () => {
    const bounced = testObject.bounceHybridObjects([HybridChild, HybridChild])
    expect(bounced).toHaveLength(2)
    expect(bounced[0]).toBe(HybridChild)
    expect(bounced[1]).toBe(HybridChild)
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

  it('bounceArrayBuffers(...) returns ArrayBuffers of the same size', () => {
    const buffers = [
      testObject.createArrayBuffer(),
      testObject.createArrayBufferFromNativeBuffer(false),
      testObject.createArrayBufferFromNativeBuffer(true),
      new ArrayBuffer(50),
    ]
    const bounced = testObject.bounceArrayBuffers(buffers)
    expect(bounced).toEqual([
      expect.any(ArrayBuffer),
      expect.any(ArrayBuffer),
      expect.any(ArrayBuffer),
      expect.any(ArrayBuffer),
    ])
    expect(bounced.map((buffer) => buffer.byteLength)).toEqual(
      buffers.map((buffer) => buffer.byteLength)
    )
  })
})
