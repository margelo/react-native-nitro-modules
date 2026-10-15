import { expect, it } from 'react-native-harness'
import { describeEachTestObject } from './utils/testObjects'

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
})
