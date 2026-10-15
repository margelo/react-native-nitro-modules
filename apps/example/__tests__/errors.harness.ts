import { expect, it } from 'react-native-harness'
import { describeEachTestObject } from './utils/testObjects'

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Matches exactly `text`, not just a substring of the error message. */
function exactly(text: string): RegExp {
  return new RegExp(`^${escapeRegExp(text)}$`)
}

/** Matches a message whose first line is exactly `text`. */
function firstLine(text: string): RegExp {
  return new RegExp(`^${escapeRegExp(text)}(?:\\n|$)`)
}

/**
 * Matches the first line of an error thrown by a native method:
 * `<HybridObject name>.<method>(...): <native message>`.
 * Kotlin exceptions reach JS as `<java class>: <message>` followed by the
 * Java stack trace, so an optional class name may sit between the method
 * name and the native message, and anything after the first line is ignored.
 */
function nativeErrorMessage(
  objectName: string,
  method: string,
  message: string
): RegExp {
  const prefix = escapeRegExp(`${objectName}.${method}(...): `)
  return new RegExp(
    `^${prefix}(?:[\\w.$]+: )?${escapeRegExp(message)}(?:\\n|$)`
  )
}

describeEachTestObject('Errors', (testObject) => {
  it('funcThatThrows() throws with the method name and message', () => {
    expect(() => testObject.funcThatThrows()).toThrow(
      `${testObject.name}.funcThatThrows(...):`
    )
    expect(() => testObject.funcThatThrows()).toThrow(
      'This function will only work after sacrificing seven lambs!'
    )
  })

  it('funcThatThrowsBeforePromise() throws before creating a Promise', () => {
    expect(() => testObject.funcThatThrowsBeforePromise()).toThrow(
      `${testObject.name}.funcThatThrowsBeforePromise(...):`
    )
    expect(() => testObject.funcThatThrowsBeforePromise()).toThrow(
      'This function will only work after sacrificing eight lambs!'
    )
  })

  it('throwError(error) rethrows the JS error message', () => {
    const error = new Error('rethrowing a JS error from native!')
    expect(() => testObject.throwError(error)).toThrow(
      `${testObject.name}.throwError(...):`
    )
    // Native keeps the JS error's name, so `Error: ` is part of the message.
    expect(() => testObject.throwError(error)).toThrow(
      'Error: rethrowing a JS error from native!'
    )
  })

  const nativeErrors = [
    {
      method: 'funcThatThrows',
      call: () => testObject.funcThatThrows(),
      message: 'This function will only work after sacrificing seven lambs!',
    },
    {
      method: 'funcThatThrowsBeforePromise',
      call: () => testObject.funcThatThrowsBeforePromise(),
      message: 'This function will only work after sacrificing eight lambs!',
    },
    {
      method: 'throwError',
      call: () =>
        testObject.throwError(new Error('rethrowing a JS error from native!')),
      message: 'Error: rethrowing a JS error from native!',
    },
    {
      method: 'castBase',
      call: () => testObject.castBase(testObject.createBase()),
      message: 'Cannot cast Base to Child!',
    },
  ]
  for (const { method, call, message } of nativeErrors) {
    it(`${method}(...) error message is "<name>.${method}(...): <native message>"`, () => {
      expect(call).toThrow(nativeErrorMessage(testObject.name, method, message))
    })
  }

  it('funcThatThrows() throws an Error instance', () => {
    expect(() => testObject.funcThatThrows()).toThrow(Error)
  })

  it('throwError(...) keeps the name of a TypeError', () => {
    expect(() =>
      testObject.throwError(new TypeError('wrong type from JS'))
    ).toThrow('TypeError: wrong type from JS')
  })

  it('throwError(...) keeps a custom error name', () => {
    const error = new Error('invalid input from JS')
    error.name = 'ValidationError'
    expect(() => testObject.throwError(error)).toThrow(
      'ValidationError: invalid input from JS'
    )
  })

  it('throwError(...) throws a conversion error for a non-Error argument', () => {
    expect(() =>
      // @ts-expect-error intentionally passing a string instead of an Error
      testObject.throwError('not an error')
    ).toThrow(
      firstLine(
        `${testObject.name}.throwError(...): Value is a string, expected an Object`
      )
    )
  })

  it('throwError() without an argument throws an argument count error', () => {
    expect(() =>
      // @ts-expect-error intentionally omitting the required argument
      testObject.throwError()
    ).toThrow(
      exactly(
        `\`${testObject.name}.throwError(...)\` expected 1 arguments, but received 0!`
      )
    )
  })

  it('funcThatThrows(1) throws an argument count error', () => {
    expect(() =>
      // @ts-expect-error intentionally passing an extra argument
      testObject.funcThatThrows(1)
    ).toThrow(
      exactly(
        `\`${testObject.name}.funcThatThrows(...)\` expected 0 arguments, but received 1!`
      )
    )
  })

  it('addNumbers(...) still works after funcThatThrows() threw', () => {
    expect(() => testObject.funcThatThrows()).toThrow()
    expect(testObject.addNumbers(2, 3)).toBe(5)
  })
})
