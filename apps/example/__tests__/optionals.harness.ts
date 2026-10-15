import { expect, fn, it, waitFor } from 'react-native-harness'
import { OldEnum } from 'react-native-nitro-test'
import { debugOnly } from './utils/helpers'
import { describeEachTestObject } from './utils/testObjects'

const TRUCK_POWERTRAINS = ['electric', 'gas', 'hybrid', 'diesel'] as const

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

    it('tryOptionalParams(...) treats an explicit undefined as omitted', () => {
      expect(testObject.tryOptionalParams(13, true, undefined)).toBe(
        'value omitted!'
      )
    })

    it('tryOptionalParams(...) keeps an empty string', () => {
      expect(testObject.tryOptionalParams(13, true, '')).toBe('')
    })

    it('tryOptionalParams(...) throws for null as the optional param', () => {
      // @ts-expect-error
      expect(() => testObject.tryOptionalParams(13, true, null)).toThrow(
        `${testObject.name}.tryOptionalParams(...): Value is null, expected a String`
      )
    })

    it('tryMiddleParam(...) throws when the last param is omitted', () => {
      // A middle optional param does not make the params after it optional
      // @ts-expect-error
      expect(() => testObject.tryMiddleParam(13, undefined)).toThrow(
        `\`${testObject.name}.tryMiddleParam(...)\` expected 3 arguments, but received 2!`
      )
    })

    it('tryOptionalEnum() with no arguments returns undefined', () => {
      expect(testObject.tryOptionalEnum()).toBeUndefined()
    })

    it('tryOptionalEnum(...) throws for an invalid enum value', () => {
      // @ts-expect-error
      expect(() => testObject.tryOptionalEnum('diesel')).toThrow(
        `${testObject.name}.tryOptionalEnum(...): Cannot convert "diesel" to enum Powertrain - invalid value!`
      )
    })

    it('tryOptionalEnum(...) throws for two arguments', () => {
      // @ts-expect-error
      expect(() => testObject.tryOptionalEnum('gas', 'gas')).toThrow(
        `\`${testObject.name}.tryOptionalEnum(...)\` expected between 0 and 1 arguments, but received 2!`
      )
    })

    it('tryTrailingOptional(...) returns false with the optional param omitted', () => {
      expect(testObject.tryTrailingOptional(0, '')).toBe(false)
    })

    it('tryTrailingOptional(...) throws for one argument', () => {
      // @ts-expect-error
      expect(() => testObject.tryTrailingOptional(0)).toThrow(
        `\`${testObject.name}.tryTrailingOptional(...)\` expected between 2 and 3 arguments, but received 1!`
      )
    })
  }
)

describeEachTestObject('optionalEnumPlusOne', (testObject) => {
  for (const value of TRUCK_POWERTRAINS) {
    it(`optionalEnumPlusOne roundtrips '${value}'`, () => {
      testObject.optionalEnumPlusOne = value
      expect(testObject.optionalEnumPlusOne).toBe(value)
    })
  }

  it('optionalEnumPlusOne roundtrips undefined', () => {
    testObject.optionalEnumPlusOne = 'diesel'
    testObject.optionalEnumPlusOne = undefined
    expect(testObject.optionalEnumPlusOne).toBeUndefined()
  })

  it('optionalEnumPlusOne setter throws for a value outside the union', () => {
    expect(() => {
      // @ts-expect-error
      testObject.optionalEnumPlusOne = 'petrol'
    }).toThrow(
      `${testObject.name}.optionalEnumPlusOne: Cannot convert "petrol" to enum TruckPowertrain - invalid value!`
    )
  })

  it('optionalEnumPlusOne setter is case-sensitive', () => {
    expect(() => {
      // @ts-expect-error
      testObject.optionalEnumPlusOne = 'Diesel'
    }).toThrow(
      `${testObject.name}.optionalEnumPlusOne: Cannot convert "Diesel" to enum TruckPowertrain - invalid value!`
    )
  })

  it('optionalEnum setter throws for the TruckPowertrain-only value', () => {
    expect(() => {
      // @ts-expect-error
      testObject.optionalEnum = 'diesel'
    }).toThrow(
      `${testObject.name}.optionalEnum: Cannot convert "diesel" to enum Powertrain - invalid value!`
    )
  })
})

describeEachTestObject('Optional properties reject null', (testObject) => {
  it('optionalString setter throws for null', () => {
    expect(() => {
      // @ts-expect-error
      testObject.optionalString = null
    }).toThrow(
      `${testObject.name}.optionalString: Value is null, expected a String`
    )
  })

  it('optionalString keeps its value when the setter throws', () => {
    testObject.optionalString = 'hello'
    expect(() => {
      // @ts-expect-error
      testObject.optionalString = null
    }).toThrow()
    expect(testObject.optionalString).toBe('hello')
  })

  it('optionalArray setter throws for null', () => {
    expect(() => {
      // @ts-expect-error
      testObject.optionalArray = null
    }).toThrow(
      `${testObject.name}.optionalArray: Value is null, expected an Object`
    )
  })

  it('optionalEnum setter throws for null', () => {
    expect(() => {
      // @ts-expect-error
      testObject.optionalEnum = null
    }).toThrow(
      `${testObject.name}.optionalEnum: Value is null, expected a String`
    )
  })

  it('optionalEnumPlusOne setter throws for null', () => {
    expect(() => {
      // @ts-expect-error
      testObject.optionalEnumPlusOne = null
    }).toThrow(
      `${testObject.name}.optionalEnumPlusOne: Value is null, expected a String`
    )
  })

  it('optionalOldEnum setter throws for null', () => {
    expect(() => {
      // @ts-expect-error
      testObject.optionalOldEnum = null
    }).toThrow(
      `${testObject.name}.optionalOldEnum: Value is null, expected a number`
    )
  })

  it('optionalCallback setter throws for null', () => {
    expect(() => {
      // @ts-expect-error
      testObject.optionalCallback = null
    }).toThrow(
      `${testObject.name}.optionalCallback: Value is null, expected an Object`
    )
  })

  it('optionalHybrid setter throws for null', () => {
    expect(() => {
      // @ts-expect-error
      testObject.optionalHybrid = null
    }).toThrow(
      `${testObject.name}.optionalHybrid: ${debugOnly('Cannot convert "null" to NativeState<')}`
    )
  })

  it('stringOrNull setter throws for undefined', () => {
    expect(() => {
      // @ts-expect-error
      testObject.stringOrNull = undefined
    }).toThrow(
      `${testObject.name}.stringOrNull: Cannot convert "undefined" to any type in variant<`
    )
  })
})

describeEachTestObject(
  'Optional properties keep falsy values',
  (testObject) => {
    it('optionalString keeps an empty string', () => {
      testObject.optionalString = ''
      expect(testObject.optionalString).toBe('')
    })

    it('stringOrUndefined keeps an empty string', () => {
      testObject.stringOrUndefined = ''
      expect(testObject.stringOrUndefined).toBe('')
    })

    it('stringOrNull keeps an empty string', () => {
      testObject.stringOrNull = ''
      expect(testObject.stringOrNull).toBe('')
    })

    it('optionalArray keeps an empty array', () => {
      testObject.optionalArray = []
      expect(testObject.optionalArray).toEqual([])
    })

    it('optionalOldEnum keeps OldEnum.FIRST (0)', () => {
      testObject.optionalOldEnum = OldEnum.FIRST
      expect(testObject.optionalOldEnum).toBe(OldEnum.FIRST)
    })
  }
)

describeEachTestObject('optionalCallback getter', (testObject) => {
  it('optionalCallback getter returns a function that calls the JS callback', async () => {
    const callback = fn<(value: number) => void>()
    try {
      testObject.optionalCallback = callback
      const forward = testObject.optionalCallback
      expect(forward).toBeTypeOf('function')
      forward?.(55)
      await waitFor(() => expect(callback).toHaveBeenCalledWith(55), {
        timeout: 2000,
      })
    } finally {
      testObject.optionalCallback = undefined
    }
  })

  it('optionalCallback getter returns a function that checks its argument count', () => {
    try {
      testObject.optionalCallback = () => {}
      const forward = testObject.optionalCallback
      expect(forward).toBeTypeOf('function')
      // @ts-expect-error
      expect(() => forward?.()).toThrow(
        'Function expected 1 arguments, but received 0!'
      )
    } finally {
      testObject.optionalCallback = undefined
    }
  })
})
