import { expect, fn, it, waitFor } from 'react-native-harness'
import { itIf } from './utils/helpers'
import { describeEachTestObject, isSwift } from './utils/testObjects'

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

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Matches exactly `text`, not just a substring of the error message. */
function exactly(text: string): RegExp {
  return new RegExp(`^${escapeRegExp(text)}$`)
}

describeEachTestObject('Callbacks', (testObject) => {
  it('callCallback(...) calls the callback once without arguments', async () => {
    const callback = fn()
    testObject.callCallback(callback)
    await waitFor(
      () => expect(callback).toHaveBeenCalledTimes(1),
      CALLBACK_TIMEOUT
    )
    expect(callback).toHaveBeenCalledWith()
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

  it('callAll(...) calls all three callbacks in order', async () => {
    const calls: string[] = []
    const first = fn(() => {
      calls.push('first')
    })
    const second = fn(() => {
      calls.push('second')
    })
    const third = fn(() => {
      calls.push('third')
    })
    testObject.callAll(first, second, third)
    await waitFor(() => {
      expect(first).toHaveBeenCalledTimes(1)
      expect(second).toHaveBeenCalledTimes(1)
      expect(third).toHaveBeenCalledTimes(1)
    }, CALLBACK_TIMEOUT)
    expect(calls).toEqual(['first', 'second', 'third'])
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
      testObject.callbackAsyncPromiseBuffer(async () => {
        const buffer = await testObject.createArrayBufferAsync()
        // The 10 MB are uninitialized, so mark a few bytes to compare.
        const bytes = new Uint8Array(buffer)
        bytes.set([13, 37])
        bytes[bytes.length - 1] = 42
        return buffer
      })
    )
    expect(result).toBeInstanceOf(ArrayBuffer)
    expect(result.byteLength).toBe(CREATED_ARRAY_BUFFER_SIZE)
    const bytes = new Uint8Array(result)
    expect([bytes[0], bytes[1], bytes[bytes.length - 1]]).toEqual([13, 37, 42])
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
    // Kotlin's message is the JniException's text: the Throwable class name
    // prefix, possibly followed by a stack trace.
    expect(onError.mock.calls[0]?.[0]).toHaveProperty(
      'message',
      expect.stringMatching(/^(?:[\w.$]+: )?Some Error!(?:\n|$)/)
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

  it('callCallback(...) calls the callback only after returning', async () => {
    const callback = fn()
    testObject.callCallback(callback)
    expect(callback).not.toHaveBeenCalled()
    await waitFor(
      () => expect(callback).toHaveBeenCalledTimes(1),
      CALLBACK_TIMEOUT
    )
  })

  it('callWithOptional(0, ...) calls back with 0 instead of undefined', async () => {
    const callback = fn()
    testObject.callWithOptional(0, callback)
    await waitFor(
      () => expect(callback).toHaveBeenCalledWith(0),
      CALLBACK_TIMEOUT
    )
  })

  it('twoOptionalCallbacks(...) calls only the first callback without a second one', async () => {
    const first = fn()
    testObject.twoOptionalCallbacks(55, first)
    await waitFor(
      () => expect(first).toHaveBeenCalledWith(55),
      CALLBACK_TIMEOUT
    )
  })

  it('twoOptionalCallbacks(...) calls the second callback when the first is undefined', async () => {
    const second = fn()
    testObject.twoOptionalCallbacks(55, undefined, second)
    await waitFor(
      // Swift passes 'Hello', C++ and Kotlin pass 'Hello!'
      () =>
        expect(second).toHaveBeenCalledWith(expect.stringMatching(/^Hello/)),
      CALLBACK_TIMEOUT
    )
  })

  it('createNativeCallback(...) forwards every call in order', async () => {
    const wrapped = fn()
    const callback = testObject.createNativeCallback(wrapped)
    callback(1)
    callback(2)
    callback(3)
    await waitFor(
      () => expect(wrapped).toHaveBeenCalledTimes(3),
      CALLBACK_TIMEOUT
    )
    expect(wrapped.mock.calls).toEqual([[1], [2], [3]])
  })

  it('getComplexCallback() returns a function with length 1', () => {
    expect(testObject.getComplexCallback()).toHaveLength(1)
  })

  it('getComplexCallback() function throws when called without arguments', () => {
    const callback = testObject.getComplexCallback()
    expect(() =>
      // @ts-expect-error intentionally omitting the argument
      callback()
    ).toThrow(exactly('Function expected 1 arguments, but received 0!'))
  })

  it('getComplexCallback() function throws when called with too many arguments', () => {
    const callback = testObject.getComplexCallback()
    expect(() =>
      // @ts-expect-error intentionally passing an extra argument
      callback(1, 2)
    ).toThrow(exactly('Function expected 1 arguments, but received 2!'))
  })

  // TODO: Fix HybridTestObjectSwift.callSumUpNTimes - its `1...Int(n)` range traps for n < 1, so callSumUpNTimes(callback, 0) crashes the app (SIGTRAP); C++ and Kotlin resolve to 0
  itIf(!isSwift(testObject))(
    'callSumUpNTimes(..., 0) resolves to 0 without calling back',
    async () => {
      const callback = fn(() => 7)
      await expect(
        withTimeout(testObject.callSumUpNTimes(callback, 0))
      ).resolves.toBe(0)
      expect(callback).not.toHaveBeenCalled()
    }
  )

  it('callSumUpNTimes(..., 20) sums 20 sequential callback results', async () => {
    let count = 0
    const callback = fn(() => ++count)
    await expect(
      withTimeout(testObject.callSumUpNTimes(callback, 20), 5000)
    ).resolves.toBe((20 * 21) / 2)
    expect(callback).toHaveBeenCalledTimes(20)
  })

  it('callSumUpNTimes(...) rejects when the callback throws', async () => {
    const callback = () => {
      throw new Error('sum callback failed')
    }
    await expect(
      withTimeout(testObject.callSumUpNTimes(callback, 3))
    ).rejects.toThrow('sum callback failed')
  })

  it('callSumUpNTimes(...) stops calling back after the callback threw', async () => {
    let count = 0
    const callback = fn(() => {
      count++
      if (count === 2) {
        throw new Error('second call failed')
      }
      return 1
    })
    await expect(
      withTimeout(testObject.callSumUpNTimes(callback, 5))
    ).rejects.toThrow('second call failed')
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('getValueFromJSCallbackAndWait(...) rejects when getValue throws', async () => {
    const getValue = () => {
      throw new Error('getValue failed')
    }
    await expect(
      withTimeout(testObject.getValueFromJSCallbackAndWait(getValue))
    ).rejects.toThrow('getValue failed')
  })

  it('getValueFromJsCallback(...) rejects when the callback throws', async () => {
    const callback = () => {
      throw new Error('getting the value failed')
    }
    await expect(
      withTimeout(testObject.getValueFromJsCallback(callback, () => {}))
    ).rejects.toThrow('getting the value failed')
  })

  it('getValueFromJsCallback(...) skips andThenCall when the callback throws', async () => {
    const andThenCall = fn()
    const callback = () => {
      throw new Error('getting the value failed')
    }
    await expect(
      withTimeout(testObject.getValueFromJsCallback(callback, andThenCall))
    ).rejects.toThrow()
    expect(andThenCall).not.toHaveBeenCalled()
  })

  it('getValueFromJsCallback(...) passes a non-ASCII string unchanged', async () => {
    const value = 'Grüße, 世界 👋'
    const andThenCall = fn()
    await withTimeout(
      testObject.getValueFromJsCallback(() => value, andThenCall)
    )
    await waitFor(
      () => expect(andThenCall).toHaveBeenCalledWith(value),
      CALLBACK_TIMEOUT
    )
  })

  it('callbackAsyncPromise(...) awaits a callback that resolves later', async () => {
    const callback = () =>
      new Promise<number>((resolve) => setTimeout(() => resolve(21), 50))
    await expect(
      withTimeout(testObject.callbackAsyncPromise(callback))
    ).resolves.toBe(21)
  })

  it('callbackAsyncPromise(...) rejects with "<name>: <message>" when the async callback rejects', async () => {
    const callback = () =>
      Promise.reject<number>(new Error('rejected in an async callback'))
    await expect(
      withTimeout(testObject.callbackAsyncPromise(callback))
    ).rejects.toThrow('Error: rejected in an async callback')
  })

  // TODO: Fix HybridTestObjectCpp.callCallbackThatReturnsPromiseVoid - it calls `future.wait()` but never `future.get()`, so it resolves to undefined when the callback's Promise rejects; Swift and Kotlin reject
  itIf(testObject.name !== 'TestObjectCpp')(
    'callCallbackThatReturnsPromiseVoid(...) rejects when the returned Promise rejects',
    async () => {
      const callback = () =>
        Promise.reject<void>(new Error('void Promise rejected'))
      await expect(
        withTimeout(testObject.callCallbackThatReturnsPromiseVoid(callback))
      ).rejects.toThrow('Error: void Promise rejected')
    }
  )

  it('callbackAsyncPromiseBuffer(...) keeps the bytes of a JS ArrayBuffer', async () => {
    const buffer = new Uint8Array([0, 1, 127, 128, 255]).buffer
    const result = await withTimeout(
      testObject.callbackAsyncPromiseBuffer(() => Promise.resolve(buffer))
    )
    expect(result).toBeInstanceOf(ArrayBuffer)
    expect(new Uint8Array(result)).toEqual(
      new Uint8Array([0, 1, 127, 128, 255])
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

  it('callbackSync(...) calls the callback without arguments', () => {
    const callback = fn(() => 55)
    testObject.callbackSync(callback)
    expect(callback).toHaveBeenCalledWith()
  })

  it('callbackSync(...) returns a fractional result unchanged', () => {
    expect(testObject.callbackSync(() => -13.37)).toBe(-13.37)
  })

  // TODO: Fix in Nitro - callbackSync(...) with a throwing JS callback crashes the app on Swift (SIGABRT: the JS error escapes the `noexcept` bridge::swift::Func_double_Wrapper::call() -> std::terminate); C++ rethrows it
  itIf(!isSwift(testObject))(
    'callbackSync(...) rethrows the JS error with the method name',
    () => {
      const callback = () => {
        throw new Error('sync callback failed')
      }
      expect(() => testObject.callbackSync(callback)).toThrow(
        new RegExp(
          `^${escapeRegExp(`${testObject.name}.callbackSync(...): `)}.*sync callback failed`
        )
      )
    }
  )

  it('getSyncNumberCallback() function throws when called with an argument', () => {
    const callback = testObject.getSyncNumberCallback()
    expect(() =>
      // @ts-expect-error intentionally passing an extra argument
      callback(1)
    ).toThrow(exactly('Function expected 0 arguments, but received 1!'))
  })

  it('bounceSyncInt64Callback(...) returns the result of the JS callback', () => {
    const callback = testObject.bounceSyncInt64Callback((input) => input * 2n)
    expect(callback(21n)).toBe(42n)
  })

  it('bounceSyncInt64Callback(...) calls the JS callback synchronously', () => {
    const jsCallback = fn((input: bigint) => input)
    const callback = testObject.bounceSyncInt64Callback(jsCallback)
    callback(5n)
    expect(jsCallback).toHaveBeenCalledWith(5n)
  })
})
