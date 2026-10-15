import { expect, it } from 'react-native-harness'
import { debugOnly, itIf } from './utils/helpers'
import { describeEachTestObject, isKotlin, isSwift } from './utils/testObjects'

const BASE_DATE = new Date()
const ONE_HOUR_IN_MS = 1000 * 60 * 60
const DATE_PLUS_1H = new Date(BASE_DATE.getTime() + ONE_HOUR_IN_MS)

const INT64_MAX = 9223372036854775807n // 2^63 - 1
const INT64_MIN = -9223372036854775808n // -(2^63)
const UINT64_MAX = 18446744073709551615n // 2^64 - 1
const ONE_MIB = 1024 * 1024

describeEachTestObject('Primitive properties', (testObject) => {
  it('numberValue roundtrips', () => {
    testObject.numberValue = 13
    expect(testObject.numberValue).toBe(13)
    testObject.numberValue = 14
    expect(testObject.numberValue).toBe(14)
  })

  it('boolValue roundtrips', () => {
    testObject.boolValue = false
    expect(testObject.boolValue).toBe(false)
    testObject.boolValue = true
    expect(testObject.boolValue).toBe(true)
  })

  it('stringValue roundtrips', () => {
    testObject.stringValue = 'hello!'
    expect(testObject.stringValue).toBe('hello!')
  })

  it('int64Value roundtrips a positive BigInt', () => {
    testObject.int64Value = 7362572367826385n
    expect(testObject.int64Value).toBe(7362572367826385n)
  })

  it('int64Value roundtrips a negative BigInt', () => {
    testObject.int64Value = -7362572367826385n
    expect(testObject.int64Value).toBe(-7362572367826385n)
  })

  it('uint64Value roundtrips a positive BigInt', () => {
    testObject.uint64Value = 7362572367826385n
    expect(testObject.uint64Value).toBe(7362572367826385n)
  })

  it('uint64Value setter throws for a negative BigInt', () => {
    expect(() => {
      testObject.uint64Value = -7362572367826385n
    }).toThrow(
      `${testObject.name}.uint64Value: Lossy truncation in BigInt64::asUint64`
    )
  })
})

describeEachTestObject('is*/has* accessor naming', (testObject) => {
  it('hasBoolean is false', () => {
    expect(testObject.hasBoolean).toBe(false)
  })

  it('hasBooleanWritable roundtrips', () => {
    testObject.hasBooleanWritable = true
    expect(testObject.hasBooleanWritable).toBe(true)
  })

  it('isBoolean is false', () => {
    expect(testObject.isBoolean).toBe(false)
  })

  it('isBooleanWritable roundtrips', () => {
    testObject.isBooleanWritable = true
    expect(testObject.isBooleanWritable).toBe(true)
  })

  it('isolatedBoolean roundtrips', () => {
    testObject.isolatedBoolean = true
    expect(testObject.isolatedBoolean).toBe(true)
  })

  it('isTextValue roundtrips', () => {
    testObject.isTextValue = 'hello'
    expect(testObject.isTextValue).toBe('hello')
  })
})

describeEachTestObject('Basic functions', (testObject) => {
  it('addNumbers(5, 13) returns 18', () => {
    expect(testObject.addNumbers(5, 13)).toBe(18)
  })

  it('addStrings("hello ", "world") returns "hello world"', () => {
    expect(testObject.addStrings('hello ', 'world')).toBe('hello world')
  })

  it('simpleFunc() returns undefined', () => {
    expect(testObject.simpleFunc()).toBeUndefined()
  })

  it('multipleArguments(...) returns undefined', () => {
    expect(testObject.multipleArguments(13, 'hello!', true)).toBeUndefined()
  })

  it('bounceNull(null) returns null', () => {
    expect(testObject.bounceNull(null)).toBeNull()
  })

  it('bounceNull(undefined) throws', () => {
    // @ts-expect-error
    expect(() => testObject.bounceNull(undefined)).toThrow(
      `${testObject.name}.bounceNull(...)`
    )
  })
})

describeEachTestObject('Dates', (testObject) => {
  it('currentDate() returns a Date', () => {
    expect(testObject.currentDate()).toBeInstanceOf(Date)
  })

  it('add1Hour(...) adds one hour', () => {
    expect(testObject.add1Hour(BASE_DATE)).toEqual(DATE_PLUS_1H)
  })

  it('currentDate() is within 10ms of the JS Date', () => {
    const nativeNow = testObject.currentDate()
    const jsNow = new Date()
    const msDiff = Math.abs(jsNow.getTime() - nativeNow.getTime())
    expect(msDiff).toBeLessThan(10)
  })

  it('add1Hour(...) handles the Unix epoch', () => {
    expect(testObject.add1Hour(new Date(0))).toEqual(
      new Date('1970-01-01T01:00:00.000Z')
    )
  })

  it('add1Hour(...) handles dates before the Unix epoch', () => {
    expect(testObject.add1Hour(new Date('1900-01-01T00:00:00.000Z'))).toEqual(
      new Date('1900-01-01T01:00:00.000Z')
    )
  })

  it('add1Hour(...) keeps the milliseconds of a present-day date', () => {
    expect(testObject.add1Hour(new Date('2024-02-29T12:34:56.789Z'))).toEqual(
      new Date('2024-02-29T13:34:56.789Z')
    )
  })

  // TODO: Fix in Nitro - on Swift this returns 1970-01-01T00:59:59.998Z (1 ms off).
  // Date+fromChrono.swift / DateToChronoDate.hpp convert via floating-point
  // seconds and truncate with duration_cast instead of rounding to whole ms.
  itIf(!isSwift(testObject))(
    'add1Hour(...) keeps millisecond precision right before the epoch',
    () => {
      expect(testObject.add1Hour(new Date('1969-12-31T23:59:59.999Z'))).toEqual(
        new Date('1970-01-01T00:59:59.999Z')
      )
    }
  )

  it('add1Hour(...) does not mutate its argument', () => {
    const date = new Date(0)
    testObject.add1Hour(date)
    expect(date).toEqual(new Date(0))
  })

  it('add1Hour(...) throws for a number instead of a Date', () => {
    // @ts-expect-error
    expect(() => testObject.add1Hour(0)).toThrow(
      `${testObject.name}.add1Hour(...): ${debugOnly('Value "0" is not a Date')}`
    )
  })
})

describeEachTestObject('Number edge cases', (testObject) => {
  it('numberValue roundtrips NaN', () => {
    testObject.numberValue = NaN
    expect(testObject.numberValue).toBeNaN()
  })

  it('numberValue roundtrips Infinity', () => {
    testObject.numberValue = Infinity
    expect(testObject.numberValue).toBe(Infinity)
  })

  it('numberValue roundtrips -Infinity', () => {
    testObject.numberValue = -Infinity
    expect(testObject.numberValue).toBe(-Infinity)
  })

  it('numberValue keeps the sign of -0', () => {
    testObject.numberValue = -0
    expect(testObject.numberValue).toBe(-0)
  })

  it('numberValue roundtrips Number.MAX_VALUE', () => {
    testObject.numberValue = Number.MAX_VALUE
    expect(testObject.numberValue).toBe(Number.MAX_VALUE)
  })

  it('numberValue roundtrips the subnormal Number.MIN_VALUE', () => {
    testObject.numberValue = Number.MIN_VALUE
    expect(testObject.numberValue).toBe(Number.MIN_VALUE)
  })

  it('numberValue roundtrips Number.MAX_SAFE_INTEGER', () => {
    testObject.numberValue = Number.MAX_SAFE_INTEGER
    expect(testObject.numberValue).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('numberValue roundtrips 2^64 without integer truncation', () => {
    testObject.numberValue = 2 ** 64
    expect(testObject.numberValue).toBe(2 ** 64)
  })

  it('numberValue keeps full double precision', () => {
    testObject.numberValue = 1 / 3
    expect(testObject.numberValue).toBe(1 / 3)
  })

  it('addNumbers(0.1, 0.2) matches JS double addition', () => {
    expect(testObject.addNumbers(0.1, 0.2)).toBe(0.1 + 0.2)
  })

  it('addNumbers(-0, -0) returns -0', () => {
    expect(testObject.addNumbers(-0, -0)).toBe(-0)
  })

  it('addNumbers(Infinity, -Infinity) returns NaN', () => {
    expect(testObject.addNumbers(Infinity, -Infinity)).toBeNaN()
  })

  it('addNumbers(NaN, 1) returns NaN', () => {
    expect(testObject.addNumbers(NaN, 1)).toBeNaN()
  })

  it('addNumbers(MAX_VALUE, MAX_VALUE) overflows to Infinity', () => {
    expect(testObject.addNumbers(Number.MAX_VALUE, Number.MAX_VALUE)).toBe(
      Infinity
    )
  })

  it('addNumbers(MIN_VALUE, MIN_VALUE) does not flush subnormals to 0', () => {
    expect(testObject.addNumbers(Number.MIN_VALUE, Number.MIN_VALUE)).toBe(
      Number.MIN_VALUE * 2
    )
  })

  it('addNumbers(MAX_SAFE_INTEGER, 2) rounds to 2^53', () => {
    expect(testObject.addNumbers(Number.MAX_SAFE_INTEGER, 2)).toBe(2 ** 53)
  })
})

describeEachTestObject('String edge cases', (testObject) => {
  it('stringValue roundtrips an empty string', () => {
    testObject.stringValue = 'hello!'
    testObject.stringValue = ''
    expect(testObject.stringValue).toBe('')
  })

  it('stringValue roundtrips emoji (surrogate pairs and ZWJ sequences)', () => {
    testObject.stringValue = '👋🏽 🇦🇹 👨‍👩‍👧'
    expect(testObject.stringValue).toBe('👋🏽 🇦🇹 👨‍👩‍👧')
  })

  it('stringValue roundtrips multi-byte UTF-8 text', () => {
    testObject.stringValue = 'Grüße, 日本語, עברית'
    expect(testObject.stringValue).toBe('Grüße, 日本語, עברית')
  })

  it('stringValue keeps combining characters unnormalized', () => {
    // "e" + COMBINING ACUTE ACCENT must not become the precomposed "\u00e9"
    testObject.stringValue = 'e\u0301'
    expect(testObject.stringValue).toBe('e\u0301')
  })

  it('stringValue roundtrips newlines and tabs', () => {
    testObject.stringValue = 'line 1\nline 2\r\n\tindented'
    expect(testObject.stringValue).toBe('line 1\nline 2\r\n\tindented')
  })

  // TODO: Fix in Nitro - on Android the generated JNI code passes std::string to
  // Kotlin via jni::make_jstring(std::string), which uses c_str() and cuts the
  // string at the first '\0' (TestObjectSwiftKotlin.stringValue becomes 'before').
  itIf(!isKotlin(testObject))(
    'stringValue roundtrips an embedded NUL character',
    () => {
      testObject.stringValue = 'before\0after'
      expect(testObject.stringValue).toBe('before\0after')
    }
  )

  it('stringValue roundtrips a 1 MiB string', () => {
    const largeString = 'x'.repeat(ONE_MIB)
    testObject.stringValue = largeString
    const result = testObject.stringValue
    // Compare the length first so a mismatch doesn't print 2 MiB of text
    expect(result.length).toBe(ONE_MIB)
    expect(result).toBe(largeString)
  })

  it('addStrings(...) concatenates emoji', () => {
    expect(testObject.addStrings('👋🏽', '🇦🇹')).toBe('👋🏽🇦🇹')
  })

  it('addStrings("", "") returns an empty string', () => {
    expect(testObject.addStrings('', '')).toBe('')
  })

  // TODO: Fix in Nitro - on Android jni::make_jstring(std::string) cuts both
  // arguments at the first '\0', so TestObjectSwiftKotlin returns 'a'.
  itIf(!isKotlin(testObject))('addStrings(...) keeps NUL characters', () => {
    expect(testObject.addStrings('a\0', '\0b')).toBe('a\0\0b')
  })
})

describeEachTestObject('BigInt boundaries', (testObject) => {
  it('int64Value roundtrips INT64_MAX', () => {
    testObject.int64Value = INT64_MAX
    expect(testObject.int64Value).toBe(INT64_MAX)
  })

  it('int64Value roundtrips INT64_MIN', () => {
    testObject.int64Value = INT64_MIN
    expect(testObject.int64Value).toBe(INT64_MIN)
  })

  it('int64Value roundtrips 0n', () => {
    testObject.int64Value = 5n
    testObject.int64Value = 0n
    expect(testObject.int64Value).toBe(0n)
  })

  it('int64Value setter throws for INT64_MAX + 1n', () => {
    expect(() => {
      testObject.int64Value = INT64_MAX + 1n
    }).toThrow(
      `${testObject.name}.int64Value: Lossy truncation in BigInt64::asInt64`
    )
  })

  it('int64Value setter throws for INT64_MIN - 1n', () => {
    expect(() => {
      testObject.int64Value = INT64_MIN - 1n
    }).toThrow(
      `${testObject.name}.int64Value: Lossy truncation in BigInt64::asInt64`
    )
  })

  it('int64Value keeps its value when the setter throws', () => {
    testObject.int64Value = 42n
    expect(() => {
      testObject.int64Value = INT64_MAX + 1n
    }).toThrow()
    expect(testObject.int64Value).toBe(42n)
  })

  it('uint64Value roundtrips UINT64_MAX', () => {
    testObject.uint64Value = UINT64_MAX
    expect(testObject.uint64Value).toBe(UINT64_MAX)
  })

  it('uint64Value roundtrips values above INT64_MAX', () => {
    testObject.uint64Value = INT64_MAX + 1n
    expect(testObject.uint64Value).toBe(INT64_MAX + 1n)
  })

  it('uint64Value roundtrips 0n', () => {
    testObject.uint64Value = 5n
    testObject.uint64Value = 0n
    expect(testObject.uint64Value).toBe(0n)
  })

  it('uint64Value setter throws for UINT64_MAX + 1n', () => {
    expect(() => {
      testObject.uint64Value = UINT64_MAX + 1n
    }).toThrow(
      `${testObject.name}.uint64Value: Lossy truncation in BigInt64::asUint64`
    )
  })
})

describeEachTestObject('Argument type validation', (testObject) => {
  it('addNumbers(...) throws for a numeric string', () => {
    // @ts-expect-error
    expect(() => testObject.addNumbers('1', 2)).toThrow(
      `${testObject.name}.addNumbers(...): Value is a string, expected a number`
    )
  })

  it('addNumbers(...) throws for a BigInt', () => {
    // @ts-expect-error
    expect(() => testObject.addNumbers(1, 2n)).toThrow(
      `${testObject.name}.addNumbers(...): Value is a bigint, expected a number`
    )
  })

  it('addNumbers(...) throws for an explicit undefined', () => {
    // @ts-expect-error
    expect(() => testObject.addNumbers(1, undefined)).toThrow(
      `${testObject.name}.addNumbers(...): Value is undefined, expected a number`
    )
  })

  it('addStrings(...) throws for a number', () => {
    // @ts-expect-error
    expect(() => testObject.addStrings('a', 1)).toThrow(
      `${testObject.name}.addStrings(...): Value is a number, expected a String`
    )
  })

  it('multipleArguments(...) throws for a number instead of a boolean', () => {
    // @ts-expect-error
    expect(() => testObject.multipleArguments(13, 'hello!', 1)).toThrow(
      `${testObject.name}.multipleArguments(...): Value is a number, expected a boolean`
    )
  })

  it('bounceNull(...) throws for a falsy non-null value', () => {
    // @ts-expect-error
    expect(() => testObject.bounceNull(0)).toThrow(
      `${testObject.name}.bounceNull(...): Cannot convert non-null value to NullType!`
    )
  })

  it('numberValue setter throws for a numeric string', () => {
    expect(() => {
      // @ts-expect-error
      testObject.numberValue = '13'
    }).toThrow(
      `${testObject.name}.numberValue: Value is a string, expected a number`
    )
  })

  it('numberValue setter throws for a BigInt', () => {
    expect(() => {
      // @ts-expect-error
      testObject.numberValue = 13n
    }).toThrow(
      `${testObject.name}.numberValue: Value is a bigint, expected a number`
    )
  })

  it('boolValue setter throws for a number instead of coercing it', () => {
    expect(() => {
      // @ts-expect-error
      testObject.boolValue = 1
    }).toThrow(
      `${testObject.name}.boolValue: Value is a number, expected a boolean`
    )
  })

  it('stringValue setter throws for a number', () => {
    expect(() => {
      // @ts-expect-error
      testObject.stringValue = 13
    }).toThrow(
      `${testObject.name}.stringValue: Value is a number, expected a String`
    )
  })

  it('int64Value setter throws for a number', () => {
    expect(() => {
      // @ts-expect-error
      testObject.int64Value = 13
    }).toThrow(
      `${testObject.name}.int64Value: Value is a number, expected a BigInt`
    )
  })

  it('uint64Value setter throws for a number', () => {
    expect(() => {
      // @ts-expect-error
      testObject.uint64Value = 13
    }).toThrow(
      `${testObject.name}.uint64Value: Value is a number, expected a BigInt`
    )
  })
})

describeEachTestObject('Argument count validation', (testObject) => {
  it('addNumbers(...) throws for one argument', () => {
    // @ts-expect-error
    expect(() => testObject.addNumbers(1)).toThrow(
      `\`${testObject.name}.addNumbers(...)\` expected 2 arguments, but received 1!`
    )
  })

  it('addNumbers(...) throws for three arguments', () => {
    // @ts-expect-error
    expect(() => testObject.addNumbers(1, 2, 3)).toThrow(
      `\`${testObject.name}.addNumbers(...)\` expected 2 arguments, but received 3!`
    )
  })

  it('addNumbers() throws for no arguments', () => {
    // @ts-expect-error
    expect(() => testObject.addNumbers()).toThrow(
      `\`${testObject.name}.addNumbers(...)\` expected 2 arguments, but received 0!`
    )
  })

  it('addNumbers(...) checks the argument count before the types', () => {
    // @ts-expect-error
    expect(() => testObject.addNumbers('a')).toThrow(
      `\`${testObject.name}.addNumbers(...)\` expected 2 arguments, but received 1!`
    )
  })

  it('simpleFunc(...) throws for an unexpected argument', () => {
    // @ts-expect-error
    expect(() => testObject.simpleFunc(1)).toThrow(
      `\`${testObject.name}.simpleFunc(...)\` expected 0 arguments, but received 1!`
    )
  })

  it('multipleArguments(...) throws for a missing argument', () => {
    // @ts-expect-error
    expect(() => testObject.multipleArguments(13, 'hello!')).toThrow(
      `\`${testObject.name}.multipleArguments(...)\` expected 3 arguments, but received 2!`
    )
  })
})
