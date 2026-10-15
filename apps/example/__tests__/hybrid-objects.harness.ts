import { expect, it } from 'react-native-harness'
import { NitroModules } from 'react-native-nitro-modules'
import { itIf } from './utils/helpers'
import { describeEachTestObject } from './utils/testObjects'

const IS_DEBUG = NitroModules.buildType === 'debug'

/**
 * Returns the enumerable keys of `object` and its whole prototype chain.
 *
 * The chain is walked on purpose: TestObjectCpp has an extra prototype level
 * (it only owns `rawJsiFunc`), so its spec methods live one level higher than
 * TestObjectSwiftKotlin's. `for...in` collects keys without reading values -
 * reading a native getter with `this = prototype` throws (no NativeState).
 */
function getEnumerableKeys(object: object): string[] {
  const keys: string[] = []
  for (const key in object) {
    keys.push(key)
  }
  return keys
}

/**
 * Walks up the prototype chain of `object` to the HybridObject root prototype
 * (the one that owns `toString`, `equals` and `dispose`). Only checks own keys,
 * so it never reads a native getter.
 */
function findRootPrototype(object: object): object | undefined {
  let prototype: object | null = object
  while (
    prototype != null &&
    !(
      Object.hasOwn(prototype, 'toString') &&
      Object.hasOwn(prototype, 'equals') &&
      Object.hasOwn(prototype, 'dispose')
    )
  ) {
    prototype = Object.getPrototypeOf(prototype)
  }
  return prototype ?? undefined
}

/**
 * Returns the property descriptor of {@linkcode key} from {@linkcode object}
 * or the first prototype that owns it, without invoking a getter.
 */
function findPropertyDescriptor(
  object: object,
  key: string
): PropertyDescriptor | undefined {
  let current: object | null = object
  while (current != null) {
    const descriptor = Object.getOwnPropertyDescriptor(current, key)
    if (descriptor != null) return descriptor
    current = Object.getPrototypeOf(current)
  }
  return undefined
}

const TEST_OBJECT_PROPERTIES = [
  'int64Value',
  'uint64Value',
  'boolValue',
  'stringValue',
] as const

describeEachTestObject('HybridObject prototype', (testObject) => {
  it('prototype has simpleFunc', () => {
    const prototype = Object.getPrototypeOf(testObject)
    expect(getEnumerableKeys(prototype)).toContain('simpleFunc')
  })

  it('prototype of the prototype has toString and equals', () => {
    const prototype = Object.getPrototypeOf(Object.getPrototypeOf(testObject))
    // Object.prototype.toString is not enumerable, so this only finds Nitro's.
    expect(getEnumerableKeys(prototype)).toEqual(
      expect.arrayContaining(['toString', 'equals'])
    )
  })

  it('prototype has no NativeState, only the instance has one', () => {
    expect(NitroModules.hasNativeState(testObject)).toBe(true)
    expect(NitroModules.hasNativeState(Object.getPrototypeOf(testObject))).toBe(
      false
    )
  })

  it('prototype inherits the shared HybridObject root toString', () => {
    const root = findRootPrototype(NitroModules) as
      | { toString: unknown }
      | undefined
    expect(root, 'HybridObject root prototype').toBeDefined()
    // Compared as a boolean so a failure never prints a prototype.
    expect(
      Object.getPrototypeOf(testObject).toString === root?.toString,
      'prototype.toString === HybridObject root toString'
    ).toBe(true)
  })
})

describeEachTestObject('HybridObject identity', (testObject) => {
  it('thisObject returns the same JS object every time', () => {
    expect(testObject.thisObject).toBe(testObject.thisObject)
  })

  it('thisObject returns the instance itself', () => {
    expect(testObject.thisObject).toBe(testObject)
  })

  it('thisObject.equals(thisObject) is true', () => {
    expect(testObject.thisObject.equals(testObject.thisObject)).toBe(true)
  })

  it('newTestObject() returns a different JS object every time', () => {
    expect(testObject.newTestObject()).not.toBe(testObject.newTestObject())
  })

  it('newTestObject().equals(newTestObject()) is false', () => {
    expect(testObject.newTestObject().equals(testObject.newTestObject())).toBe(
      false
    )
  })

  it('different instances share the same prototype', () => {
    const objA = testObject.newTestObject()
    const objB = testObject.newTestObject()
    // Compared as a boolean so a failure never prints the prototypes.
    expect(
      Object.getPrototypeOf(objA) === Object.getPrototypeOf(objB),
      'Object.getPrototypeOf(objA) === Object.getPrototypeOf(objB)'
    ).toBe(true)
  })
})

describeEachTestObject('HybridObject-returning members', (testObject) => {
  it('thisObject returns a HybridObject of the same type', () => {
    const self = testObject.thisObject
    expect(NitroModules.isHybridObject(self)).toBe(true)
    expect(self.name).toBe(testObject.name)
    for (const property of TEST_OBJECT_PROPERTIES) {
      expect(self).toHaveProperty(property, expect.anything())
    }
  })

  it('newTestObject() returns a HybridObject of the same type', () => {
    const newObject = testObject.newTestObject()
    expect(NitroModules.isHybridObject(newObject)).toBe(true)
    expect(newObject.name).toBe(testObject.name)
    for (const property of TEST_OBJECT_PROPERTIES) {
      expect(newObject).toHaveProperty(property, expect.anything())
    }
  })
})

describeEachTestObject('HybridObject base members', (testObject) => {
  it('toString() returns "[HybridObject <name>]"', () => {
    expect(testObject.toString()).toBe(`[HybridObject ${testObject.name}]`)
  })

  it('name is a registered HybridObject name', () => {
    expect(NitroModules.getAllHybridObjectNames()).toContain(testObject.name)
  })

  it('equals(itself) is true', () => {
    expect(testObject.equals(testObject)).toBe(true)
  })

  it('equals(thisObject) is true', () => {
    expect(testObject.equals(testObject.thisObject)).toBe(true)
  })

  it('equals(newTestObject()) is false', () => {
    expect(testObject.equals(testObject.newTestObject())).toBe(false)
  })

  it('Object.keys(...) only lists the debug __type key', () => {
    // All members live on the prototype - in debug, Nitro adds `__type`.
    expect(Object.keys(testObject)).toEqual(
      NitroModules.buildType === 'debug' ? ['__type'] : []
    )
  })
})

describeEachTestObject('HybridObject members', (testObject) => {
  it('addNumbers.length is its parameter count', () => {
    expect(testObject.addNumbers.length).toBe(2)
  })

  it('addNumbers.name is the method name', () => {
    expect(testObject.addNumbers.name).toBe('addNumbers')
  })

  it('methods are enumerable, read-only and not configurable', () => {
    expect(findPropertyDescriptor(testObject, 'addNumbers')).toMatchObject({
      value: expect.any(Function),
      enumerable: true,
      writable: false,
      configurable: false,
    })
  })

  it('readonly properties only have a getter', () => {
    expect(findPropertyDescriptor(testObject, 'thisObject')).toMatchObject({
      get: expect.any(Function),
      set: undefined,
      enumerable: true,
      configurable: false,
    })
  })

  it('writable properties have a getter and a setter', () => {
    expect(findPropertyDescriptor(testObject, 'numberValue')).toMatchObject({
      get: expect.any(Function),
      set: expect.any(Function),
      enumerable: true,
      configurable: false,
    })
  })

  it('property getters read the instance bound to `this`', () => {
    const other = testObject.newTestObject()
    other.numberValue = 42
    testObject.numberValue = 13
    const getter = findPropertyDescriptor(testObject, 'numberValue')?.get
    expect(getter?.call(other)).toBe(42)
  })

  itIf(IS_DEBUG)('__type is "HybridObject<name>" in debug', () => {
    expect(testObject.__type).toBe(`HybridObject<${testObject.name}>`)
  })

  itIf(IS_DEBUG)('prototype is frozen in debug', () => {
    expect(Object.isFrozen(Object.getPrototypeOf(testObject))).toBe(true)
  })
})

describeEachTestObject('HybridObject `this` binding', (testObject) => {
  itIf(IS_DEBUG)(
    'a destructured method throws because `this` is unbound',
    () => {
      const { addNumbers } = testObject
      expect(() => addNumbers(2, 3)).toThrow('`this` is not bound!')
    }
  )

  itIf(IS_DEBUG)('a method called on the prototype throws', () => {
    const prototype = Object.getPrototypeOf(testObject) as {
      addNumbers: (a: number, b: number) => number
    }
    expect(() => prototype.addNumbers(2, 3)).toThrow(
      '`this` does not have a NativeState!'
    )
  })

  itIf(IS_DEBUG)('a method called on another HybridObject type throws', () => {
    const base = testObject.createBase()
    expect(() => testObject.addNumbers.call(base, 2, 3)).toThrow(
      "`this` has a NativeState, but it's the wrong type!"
    )
  })
})

describeEachTestObject('HybridObject equals()', (testObject) => {
  it('equals(a HybridObject of another type) is false', () => {
    expect(testObject.equals(testObject.createBase())).toBe(false)
  })

  itIf(IS_DEBUG)('equals({}) throws because it has no NativeState', () => {
    // @ts-expect-error - a plain object is not a HybridObject
    const equalsPlainObject = () => testObject.equals({})
    expect(equalsPlainObject).toThrow(`${testObject.name}.equals(...)`)
    expect(equalsPlainObject).toThrow('It does not have a NativeState!')
  })

  itIf(IS_DEBUG)('equals(undefined) throws', () => {
    // @ts-expect-error - undefined is not a HybridObject
    expect(() => testObject.equals(undefined)).toThrow('It is undefined!')
  })
})

describeEachTestObject('HybridObject dispose()', (testObject) => {
  it('dispose() returns undefined', () => {
    expect(testObject.newTestObject().dispose()).toBeUndefined()
  })

  it('dispose() makes isHybridObject(...) false', () => {
    const object = testObject.newTestObject()
    object.dispose()
    expect(NitroModules.isHybridObject(object)).toBe(false)
  })

  it('dispose() leaves other instances usable', () => {
    const object = testObject.newTestObject()
    const other = testObject.newTestObject()
    object.dispose()
    expect(other.addNumbers(2, 3)).toBe(5)
  })

  itIf(IS_DEBUG)('a method call after dispose() throws', () => {
    const object = testObject.newTestObject()
    object.dispose()
    const addNumbers = () => object.addNumbers(2, 3)
    expect(addNumbers).toThrow(
      /Cannot call hybrid function `\w+\.addNumbers\(\.\.\.\)`/
    )
    expect(addNumbers).toThrow('dispose()')
  })

  itIf(IS_DEBUG)('a property read after dispose() throws', () => {
    const object = testObject.newTestObject()
    object.dispose()
    const getNumberValue = () => object.numberValue
    expect(getNumberValue).toThrow(
      /Cannot get hybrid property `\w+\.numberValue`/
    )
    expect(getNumberValue).toThrow('dispose()')
  })

  itIf(IS_DEBUG)('a property write after dispose() throws', () => {
    const object = testObject.newTestObject()
    object.dispose()
    const setNumberValue = () => {
      object.numberValue = 5
    }
    expect(setNumberValue).toThrow(
      /Cannot set hybrid property `\w+\.numberValue`/
    )
    expect(setNumberValue).toThrow('dispose()')
  })

  itIf(IS_DEBUG)('name after dispose() throws', () => {
    const object = testObject.newTestObject()
    object.dispose()
    expect(() => object.name).toThrow(
      'Cannot get hybrid property `HybridObject.name`'
    )
  })

  itIf(IS_DEBUG)('toString() after dispose() throws', () => {
    const object = testObject.newTestObject()
    object.dispose()
    expect(() => object.toString()).toThrow(
      'Cannot call hybrid function `HybridObject.toString(...)`'
    )
  })

  itIf(IS_DEBUG)('dispose() twice throws', () => {
    const object = testObject.newTestObject()
    object.dispose()
    expect(() => object.dispose()).toThrow(
      'Cannot call hybrid function `HybridObject.dispose(...)`'
    )
  })

  it('a native reference re-wraps a disposed object in a new JS object', () => {
    const holder = testObject.newTestObject()
    const object = testObject.newTestObject()
    object.numberValue = 42
    holder.optionalHybrid = object
    object.dispose()
    // The native instance is still alive (held by `holder`), but the disposed
    // JS object dropped its NativeState, so native creates a new JS object.
    const rewrapped = holder.optionalHybrid
    expect(rewrapped).not.toBe(object)
    expect(rewrapped?.numberValue).toBe(42)
  })
})

describeEachTestObject('HybridObject identity in containers', (testObject) => {
  it('bounceHybridObjects(...) keeps the JS identity of every element', () => {
    const childA = testObject.createChild()
    const childB = testObject.createChild()
    const result = testObject.bounceHybridObjects([childA, childB, childA])
    expect(result).toHaveLength(3)
    expect(result[0]).toBe(childA)
    expect(result[1]).toBe(childB)
    expect(result[2]).toBe(childA)
  })
})
