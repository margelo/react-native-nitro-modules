import { expect, it } from 'react-native-harness'
import { OldEnum } from 'react-native-nitro-test'
import { describeEachTestObject } from './utils/testObjects'

describeEachTestObject('Nullability & optional properties', (testObject) => {
  it('stringOrUndefined roundtrips a string and undefined', () => {
    testObject.stringOrUndefined = 'hello'
    expect(testObject.stringOrUndefined).toBe('hello')
    testObject.stringOrUndefined = undefined
    expect(testObject.stringOrUndefined).toBeUndefined()
  })

  it('stringOrUndefined setter throws for null', () => {
    expect(() => {
      // @ts-expect-error
      testObject.stringOrUndefined = null
    }).toThrow(`${testObject.name}.stringOrUndefined`)
  })

  it('optionalString roundtrips a string and undefined', () => {
    testObject.optionalString = 'hello'
    expect(testObject.optionalString).toBe('hello')
    testObject.optionalString = undefined
    expect(testObject.optionalString).toBeUndefined()
  })

  it('nullValue roundtrips null', () => {
    expect(testObject.nullValue).toBeNull()
    testObject.nullValue = null
    expect(testObject.nullValue).toBeNull()
  })

  it('nullValue setter throws for undefined', () => {
    expect(() => {
      // @ts-expect-error
      testObject.nullValue = undefined
    }).toThrow(`${testObject.name}.nullValue`)
  })

  it('nullValue setter throws for a number', () => {
    expect(() => {
      // @ts-expect-error
      testObject.nullValue = 19
    }).toThrow(`${testObject.name}.nullValue`)
  })

  it('stringOrNull roundtrips a string and null', () => {
    testObject.stringOrNull = 'hello'
    expect(testObject.stringOrNull).toBe('hello')
    testObject.stringOrNull = null
    expect(testObject.stringOrNull).toBeNull()
  })

  it('optionalArray roundtrips undefined', () => {
    testObject.optionalArray = undefined
    expect(testObject.optionalArray).toBeUndefined()
  })

  it('optionalArray roundtrips an array', () => {
    testObject.optionalArray = ['hello', 'world']
    expect(testObject.optionalArray).toEqual(['hello', 'world'])
  })

  it('optionalHybrid roundtrips undefined', () => {
    testObject.optionalHybrid = undefined
    expect(testObject.optionalHybrid).toBeUndefined()
  })

  it('optionalHybrid roundtrips the same HybridObject', () => {
    try {
      testObject.optionalHybrid = testObject
      expect(testObject.optionalHybrid).toBe(testObject)
    } finally {
      // Break the reference cycle (testObject holding itself)
      testObject.optionalHybrid = undefined
    }
  })

  it('optionalEnum roundtrips undefined', () => {
    testObject.optionalEnum = undefined
    expect(testObject.optionalEnum).toBeUndefined()
  })

  it('optionalEnum roundtrips a value', () => {
    testObject.optionalEnum = 'gas'
    expect(testObject.optionalEnum).toBe('gas')
  })

  it('optionalOldEnum roundtrips undefined', () => {
    testObject.optionalOldEnum = undefined
    expect(testObject.optionalOldEnum).toBeUndefined()
  })

  it('optionalOldEnum roundtrips a value', () => {
    testObject.optionalOldEnum = OldEnum.SECOND
    expect(testObject.optionalOldEnum).toBe(OldEnum.SECOND)
  })

  it('optionalCallback roundtrips a function and undefined', () => {
    testObject.optionalCallback = () => {}
    expect(testObject.optionalCallback).toBeTypeOf('function')
    testObject.optionalCallback = undefined
    expect(testObject.optionalCallback).toBeUndefined()
  })
})

describeEachTestObject(
  'Optional parameters & argument-count validation',
  (testObject) => {
    it('tryOptionalParams(...) with the optional param omitted', () => {
      expect(testObject.tryOptionalParams(13, true)).toBe('value omitted!')
    })

    it('tryOptionalParams(...) with the optional param provided', () => {
      expect(testObject.tryOptionalParams(13, true, 'hello')).toBe('hello')
    })

    it('tryOptionalParams(...) throws for one argument too many', () => {
      expect(() =>
        testObject.tryOptionalParams(
          13,
          true,
          'hello',
          // @ts-expect-error
          'too many args!'
        )
      ).toThrow(
        `\`${testObject.name}.tryOptionalParams(...)\` expected between 2 and 3 arguments, but received 4!`
      )
    })

    it('tryOptionalParams(...) throws for one argument too few', () => {
      // @ts-expect-error
      expect(() => testObject.tryOptionalParams(13)).toThrow(
        `\`${testObject.name}.tryOptionalParams(...)\` expected between 2 and 3 arguments, but received 1!`
      )
    })

    it('tryMiddleParam(...) with undefined in the middle', () => {
      expect(testObject.tryMiddleParam(13, undefined, 'hello!')).toBe('hello!')
    })

    it('tryMiddleParam(...) with true in the middle', () => {
      expect(testObject.tryMiddleParam(13, true, 'passed')).toBe('passed')
    })

    it('tryOptionalEnum(...) with a value', () => {
      expect(testObject.tryOptionalEnum('gas')).toBe('gas')
    })

    it('tryOptionalEnum(...) with undefined', () => {
      expect(testObject.tryOptionalEnum(undefined)).toBeUndefined()
    })

    it('tryTrailingOptional(...) with false', () => {
      expect(testObject.tryTrailingOptional(0, '', false)).toBe(false)
    })

    it('tryTrailingOptional(...) with true', () => {
      expect(testObject.tryTrailingOptional(0, '', true)).toBe(true)
    })
  }
)
