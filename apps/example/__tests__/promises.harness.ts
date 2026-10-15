import { expect, it } from 'react-native-harness'
import type { Car } from 'react-native-nitro-test'
import { TEST_CAR, TEST_CAR_2 } from './utils/fixtures'
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

const STILL_PENDING = 'still pending'

/**
 * Resolves to {@linkcode STILL_PENDING} if `promise` has not settled within
 * `ms`, otherwise settles like `promise`.
 */
function settledWithin<T>(
  promise: Promise<T>,
  ms = 100
): Promise<T | typeof STILL_PENDING> {
  const timeout = new Promise<typeof STILL_PENDING>((resolve) =>
    setTimeout(() => resolve(STILL_PENDING), ms)
  )
  return Promise.race([promise, timeout])
}

function delay<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

/** A JS reference implementation of `calculateFibonacciSync(n)`. */
function fibonacci(n: number): bigint {
  let current = 0n
  let next = 1n
  for (let i = 0; i < n; i++) {
    ;[current, next] = [next, current + next]
  }
  return current
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Matches `prefix` followed by exactly `message`. Kotlin exceptions reach JS
 * through fbjni as `<java class>: <message>` followed by `\n\tat ...` stack
 * lines, so an optional class name and trailing lines are allowed.
 */
function exactNativeMessage(prefix: string, message: string): RegExp {
  return new RegExp(
    `^${escapeRegExp(prefix)}(?:[\\w.$]+: )?${escapeRegExp(message)}(?:\\n|$)`
  )
}

/** Matches the message of a rejected native Promise (no method prefix). */
function rejectionMessage(message: string): RegExp {
  return exactNativeMessage('', message)
}

/** Matches the message of a synchronous throw from `<object>.<method>(...)`. */
function nativeErrorMessage(
  objectName: string,
  method: string,
  message: string
): RegExp {
  return exactNativeMessage(`${objectName}.${method}(...): `, message)
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
    // Native rejects the returned Promise instead of throwing synchronously.
    const promise = testObject.promiseThrows()
    expect(promise).toBeInstanceOf(Promise)
    await expect(promise).rejects.toBeInstanceOf(Error)
    await expect(promise).rejects.toThrow(rejectionMessage('Promise throws :)'))
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

  it('calculateFibonacciAsync(0) resolves to 0n', async () => {
    await expect(testObject.calculateFibonacciAsync(0)).resolves.toBe(0n)
  })

  it('calculateFibonacciAsync(1) resolves to 1n', async () => {
    await expect(testObject.calculateFibonacciAsync(1)).resolves.toBe(1n)
  })

  it('calculateFibonacciAsync(...) resolves 50 parallel calls with their own results', async () => {
    // The C++ implementation is recursive, so keep `n` small.
    const inputs = Array.from({ length: 50 }, (_, i) => i % 25)
    const results = await Promise.all(
      inputs.map((n) => testObject.calculateFibonacciAsync(n))
    )
    expect(results).toEqual(inputs.map(fibonacci))
  })

  it('wait(...) does not block the JS thread', async () => {
    // Kotlin truncates the seconds to a whole number, so wait at least 1s.
    const waited = testObject.wait(1).then(() => 'wait finished')
    await expect(
      Promise.race([waited, delay(20, 'JS timer fired')])
    ).resolves.toBe('JS timer fired')
  })
})

describeEachTestObject('Pending native Promises', (testObject) => {
  // Each TestObject only has one pending Promise slot, so every test uses its
  // own TestObject to not leak a pending Promise into the next test.

  it('createPendingPromise() stays pending until it is triggered', async () => {
    const object = testObject.newTestObject()
    const promise = object.createPendingPromise()
    try {
      await expect(settledWithin(promise)).resolves.toBe(STILL_PENDING)
    } finally {
      object.resolvePendingPromiseOnWorker()
    }
  })

  it('resolvePendingPromiseOnWorker() resolves the pending Promise to 55', async () => {
    const object = testObject.newTestObject()
    const promise = object.createPendingPromise()
    object.resolvePendingPromiseOnWorker()
    await expect(withTimeout(promise)).resolves.toBe(55)
  })

  it('createPendingPromise() throws while another Promise is pending', async () => {
    const object = testObject.newTestObject()
    const first = object.createPendingPromise()
    try {
      expect(() => object.createPendingPromise()).toThrow(
        nativeErrorMessage(
          testObject.name,
          'createPendingPromise',
          'A pending Promise is already waiting for completion.'
        )
      )
    } finally {
      object.resolvePendingPromiseOnWorker()
    }
    await expect(withTimeout(first)).resolves.toBe(55)
  })

  it('resolvePendingPromiseOnWorker() throws without a pending Promise', () => {
    const object = testObject.newTestObject()
    expect(() => object.resolvePendingPromiseOnWorker()).toThrow(
      nativeErrorMessage(
        testObject.name,
        'resolvePendingPromiseOnWorker',
        'No pending Promise is waiting for completion.'
      )
    )
  })

  it('createPendingPromise() works again after the previous Promise resolved', async () => {
    const object = testObject.newTestObject()
    const first = object.createPendingPromise()
    object.resolvePendingPromiseOnWorker()
    await expect(withTimeout(first)).resolves.toBe(55)

    const second = object.createPendingPromise()
    object.resolvePendingPromiseOnWorker()
    await expect(withTimeout(second)).resolves.toBe(55)
  })

  it('createPendingPromise() has a separate pending slot per TestObject', async () => {
    const first = testObject.newTestObject()
    const second = testObject.newTestObject()
    const firstPromise = first.createPendingPromise()
    const secondPromise = second.createPendingPromise()
    first.resolvePendingPromiseOnWorker()
    second.resolvePendingPromiseOnWorker()
    await expect(
      withTimeout(Promise.all([firstPromise, secondPromise]))
    ).resolves.toEqual([55, 55])
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

  it('awaitAndGetPromise(...) stays pending while the JS Promise is pending', async () => {
    const jsPromise = deferred<number>()
    const nativePromise = testObject.awaitAndGetPromise(jsPromise.promise)
    try {
      await expect(settledWithin(nativePromise)).resolves.toBe(STILL_PENDING)
    } finally {
      jsPromise.resolve(0)
    }
  })

  it('awaitAndGetPromise(...) resolves an already resolved JS Promise', async () => {
    await expect(
      withTimeout(testObject.awaitAndGetPromise(Promise.resolve(42)))
    ).resolves.toBe(42)
  })

  it('awaitAndGetPromise(...) rejects with "<name>: <message>" of the JS error', async () => {
    const jsPromise = deferred<number>()
    const nativePromise = testObject.awaitAndGetPromise(jsPromise.promise)
    jsPromise.reject(new Error('rejected from JS!'))
    await expect(withTimeout(nativePromise)).rejects.toThrow(
      rejectionMessage('Error: rejected from JS!')
    )
  })

  it('awaitAndGetComplexPromise(...) rejects when the JS Promise rejects', async () => {
    const jsPromise = deferred<Car>()
    const nativePromise = testObject.awaitAndGetComplexPromise(
      jsPromise.promise
    )
    jsPromise.reject(new Error('no car from JS!'))
    await expect(withTimeout(nativePromise)).rejects.toThrow(
      'Error: no car from JS!'
    )
  })

  it('awaitPromise(...) rejection keeps the name of a TypeError', async () => {
    const jsPromise = deferred<void>()
    const nativePromise = testObject.awaitPromise(jsPromise.promise)
    jsPromise.reject(new TypeError('wrong type from JS!'))
    await expect(withTimeout(nativePromise)).rejects.toThrow(
      'TypeError: wrong type from JS!'
    )
  })

  it('awaitAndGetComplexPromise(...) keeps every optional Car field', async () => {
    await expect(
      withTimeout(
        testObject.awaitAndGetComplexPromise(Promise.resolve(TEST_CAR_2))
      )
    ).resolves.toEqual(TEST_CAR_2)
  })

  it('awaitAndGetPromise(...) resolves 50 parallel JS Promises with their own values', async () => {
    const jsPromises = Array.from({ length: 50 }, () => deferred<number>())
    const nativePromises = jsPromises.map((jsPromise) =>
      testObject.awaitAndGetPromise(jsPromise.promise)
    )
    // Settle them in reverse order, so results can't line up by accident.
    for (let i = jsPromises.length - 1; i >= 0; i--) {
      jsPromises[i]!.resolve(i * 1.5)
    }
    await expect(withTimeout(Promise.all(nativePromises))).resolves.toEqual(
      jsPromises.map((_, i) => i * 1.5)
    )
  })

  it('awaitPromise(...) throws synchronously for a non-Promise argument', () => {
    expect(() =>
      // @ts-expect-error intentionally passing a number instead of a Promise
      testObject.awaitPromise(5)
    ).toThrow(`${testObject.name}.awaitPromise(...): `)
  })
})
