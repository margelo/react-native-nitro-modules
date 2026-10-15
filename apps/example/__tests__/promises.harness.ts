import { expect, it } from 'react-native-harness'
import type { Car } from 'react-native-nitro-test'
import { TEST_CAR } from './utils/fixtures'
import { deferred } from './utils/helpers'
import { describeEachTestObject } from './utils/testObjects'

/**
 * Rejects if `promise` does not settle within `ms`. Native awaits the JS
 * Promise here, so a broken path would otherwise hang until the global
 * timeout and skip every remaining test in this file.
 */
function withTimeout<T>(promise: Promise<T>, ms = 2000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Promise did not settle within ${ms}ms`)),
      ms
    )
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

describeEachTestObject('Promises', (testObject) => {
  it('wait(0.1) resolves', async () => {
    await expect(testObject.wait(0.1)).resolves.toBeUndefined()
  })

  it('calculateFibonacciSync(10) returns 55n', () => {
    expect(testObject.calculateFibonacciSync(10)).toBe(55n)
  })

  it('calculateFibonacciAsync(10) resolves to 55n', async () => {
    await expect(testObject.calculateFibonacciAsync(10)).resolves.toBe(55n)
  })

  it('promiseThrows() rejects', async () => {
    await expect(testObject.promiseThrows()).rejects.toThrow(
      'Promise throws :)'
    )
  })

  it('promiseReturnsInstantly() resolves to 55', async () => {
    await expect(testObject.promiseReturnsInstantly()).resolves.toBe(55)
  })

  it('promiseReturnsInstantlyAsync() resolves to 55', async () => {
    await expect(testObject.promiseReturnsInstantlyAsync()).resolves.toBe(55)
  })

  it('promiseReturnsInstantlyAsync() resolves 100 parallel calls', async () => {
    const results = await Promise.all(
      Array.from({ length: 100 }, () =>
        testObject.promiseReturnsInstantlyAsync()
      )
    )
    expect(results).toEqual(Array(100).fill(55))
  })

  it('promiseThatResolvesVoidInstantly() resolves to undefined', async () => {
    await expect(
      testObject.promiseThatResolvesVoidInstantly()
    ).resolves.toBeUndefined()
  })

  it('promiseThatResolvesToUndefined() resolves to undefined', async () => {
    await expect(
      testObject.promiseThatResolvesToUndefined()
    ).resolves.toBeUndefined()
  })

  it('awaitNullablePromise() resolves to undefined', async () => {
    await expect(testObject.awaitNullablePromise()).resolves.toBeUndefined()
  })

  it('wait(0.5) twice runs in parallel', async () => {
    const start = performance.now()
    // 0.5s + 0.5s = ~1s in serial, ~0.5s in parallel
    await Promise.all([testObject.wait(0.5), testObject.wait(0.5)])
    const duration = performance.now() - start
    expect(duration, 'ms for two parallel wait(0.5) calls').toBeLessThan(1000)
  })
})

describeEachTestObject('JS Promises awaited on native', (testObject) => {
  it('awaitAndGetPromise(...) resolves to the JS number', async () => {
    const jsPromise = deferred<number>()
    const nativePromise = testObject.awaitAndGetPromise(jsPromise.promise)
    jsPromise.resolve(5)
    await expect(withTimeout(nativePromise)).resolves.toBe(5)
  })

  it('awaitAndGetComplexPromise(...) resolves to the JS Car', async () => {
    const jsPromise = deferred<Car>()
    const nativePromise = testObject.awaitAndGetComplexPromise(
      jsPromise.promise
    )
    jsPromise.resolve(TEST_CAR)
    await expect(withTimeout(nativePromise)).resolves.toEqual(TEST_CAR)
  })

  it('awaitPromise(...) resolves when the JS Promise resolves', async () => {
    const jsPromise = deferred<void>()
    const nativePromise = testObject.awaitPromise(jsPromise.promise)
    jsPromise.resolve()
    await expect(withTimeout(nativePromise)).resolves.toBeUndefined()
  })

  it('awaitPromise(...) rejects when the JS Promise rejects', async () => {
    const jsPromise = deferred<void>()
    const nativePromise = testObject.awaitPromise(jsPromise.promise)
    jsPromise.reject(new Error('rejected from JS!'))
    await expect(withTimeout(nativePromise)).rejects.toThrow(
      'rejected from JS!'
    )
  })
})
