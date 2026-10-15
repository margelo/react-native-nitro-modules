import { expect, fn, it, waitFor } from 'react-native-harness'
import { describeEachTestObject } from './utils/testObjects'

// Nitro calls void and Promise-returning JS callbacks asynchronously (through
// the JS dispatcher), so a spy passed to native is only called some time
// after the native method returned.
const CALLBACK_TIMEOUT = { timeout: 2000 }

// Bounds a native Promise that only settles once native called back into JS,
// so a broken callback dispatch fails this test instead of hanging the file.
function withTimeout<T>(
  promise: Promise<T>,
  ms = CALLBACK_TIMEOUT.timeout
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Promise did not settle within ${ms}ms`)),
      ms
    )
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

// `createArrayBuffer()` allocates 10 MB on every platform.
const CREATED_ARRAY_BUFFER_SIZE = 1024 * 1024 * 10

describeEachTestObject('Callbacks', (testObject) => {
  it('callCallback(...) calls the callback', async () => {
    const callback = fn()
    testObject.callCallback(callback)
    await waitFor(
      () => expect(callback).toHaveBeenCalledTimes(1),
      CALLBACK_TIMEOUT
    )
  })

  it('callWithOptional(undefined) calls back with undefined', async () => {
    const callback = fn()
    testObject.callWithOptional(undefined, callback)
    await waitFor(
      () => expect(callback).toHaveBeenCalledWith(undefined),
      CALLBACK_TIMEOUT
    )
  })

  it('callWithOptional(433) calls back with 433', async () => {
    const callback = fn()
    testObject.callWithOptional(433, callback)
    await waitFor(
      () => expect(callback).toHaveBeenCalledWith(433),
      CALLBACK_TIMEOUT
    )
  })

  it('getValueFromJsCallback(...) passes the JS value to the second callback', async () => {
    const andThenCall = fn()
    await withTimeout(
      testObject.getValueFromJsCallback(() => 'hello', andThenCall)
    )
    await waitFor(
      () => expect(andThenCall).toHaveBeenCalledWith('hello'),
      CALLBACK_TIMEOUT
    )
  })

  it('callCallbackThatReturnsPromiseVoid(...) awaits the returned Promise', async () => {
    const callback = fn(() => Promise.resolve())
    await expect(
      withTimeout(testObject.callCallbackThatReturnsPromiseVoid(callback))
    ).resolves.toBeUndefined()
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('getValueFromJSCallbackAndWait(...) awaits a single callback', async () => {
    await expect(
      withTimeout(testObject.getValueFromJSCallbackAndWait(() => 73))
    ).resolves.toBe(73)
  })

  it('callAll(...) calls all three callbacks', async () => {
    const first = fn()
    const second = fn()
    const third = fn()
    testObject.callAll(first, second, third)
    await waitFor(() => {
      expect(first).toHaveBeenCalledTimes(1)
      expect(second).toHaveBeenCalledTimes(1)
      expect(third).toHaveBeenCalledTimes(1)
    }, CALLBACK_TIMEOUT)
  })

  it('callSumUpNTimes(...) calls the callback multiple times', async () => {
    const callback = fn(() => 7)
    await expect(
      withTimeout(testObject.callSumUpNTimes(callback, 5))
    ).resolves.toBe(7 * 5)
    expect(callback).toHaveBeenCalledTimes(5)
  })

  it('callbackAsyncPromise(...) awaits an async callback on native', async () => {
    await expect(
      withTimeout(testObject.callbackAsyncPromise(async () => 13))
    ).resolves.toBe(13)
  })

  it('callbackAsyncPromiseBuffer(...) awaits an async ArrayBuffer callback on native', async () => {
    const result = await withTimeout(
      testObject.callbackAsyncPromiseBuffer(
        async () => await testObject.createArrayBufferAsync()
      )
    )
    expect(result).toBeInstanceOf(ArrayBuffer)
    expect(result.byteLength).toBe(CREATED_ARRAY_BUFFER_SIZE)
  })

  it('callbackAsyncPromise(...) rejects when the JS callback throws', async () => {
    await expect(
      withTimeout(
        testObject.callbackAsyncPromise(() => {
          throw new Error('throwing in JS!')
        })
      )
    ).rejects.toThrow('throwing in JS!')
  })

  it('getComplexCallback() returns a native function', () => {
    const callback = testObject.getComplexCallback()
    expect(callback).toBeTypeOf('function')
    expect(callback(55)).toBeUndefined()
  })

  it('twoOptionalCallbacks(...) calls both callbacks', async () => {
    const first = fn()
    const second = fn()
    testObject.twoOptionalCallbacks(55, first, second)
    await waitFor(() => {
      expect(first).toHaveBeenCalledWith(55)
      // Swift passes 'Hello', C++ and Kotlin pass 'Hello!'
      expect(second).toHaveBeenCalledWith(expect.stringContaining('Hello'))
    }, CALLBACK_TIMEOUT)
  })

  it('twoOptionalCallbacks(...) works without callbacks', () => {
    testObject.twoOptionalCallbacks(55)
  })

  it('errorCallback(...) calls back with an Error', async () => {
    const onError = fn()
    testObject.errorCallback(onError)
    await waitFor(
      () => expect(onError).toHaveBeenCalledWith(expect.any(Error)),
      CALLBACK_TIMEOUT
    )
    expect(onError.mock.calls[0]?.[0]).toHaveProperty(
      'message',
      expect.stringContaining('Some Error!')
    )
  })

  it('createNativeCallback(...) invokes the wrapped JS callback', async () => {
    const wrapped = fn()
    const callback = testObject.createNativeCallback(wrapped)
    callback(55)
    await waitFor(
      () => expect(wrapped).toHaveBeenCalledWith(55),
      CALLBACK_TIMEOUT
    )
  })
})

describeEachTestObject('Sync callbacks', (testObject) => {
  it('callbackSync(...) calls the callback synchronously', () => {
    const callback = fn(() => 55)
    expect(testObject.callbackSync(callback)).toBe(55)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('getSyncNumberCallback() returns a callback that returns 55', () => {
    const callback = testObject.getSyncNumberCallback()
    expect(callback()).toBe(55)
  })

  for (const value of [-(2n ** 63n), -1n, 0n, 2n ** 63n - 1n]) {
    it(`bounceSyncInt64Callback(...) roundtrips ${value}`, () => {
      const callback = testObject.bounceSyncInt64Callback((input) => input)
      expect(callback(value)).toBe(value)
    })
  }
})
