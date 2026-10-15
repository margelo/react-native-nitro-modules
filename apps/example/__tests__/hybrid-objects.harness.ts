import { expect, it } from 'react-native-harness'
import { NitroModules } from 'react-native-nitro-modules'
import { describeEachTestObject } from './utils/testObjects'

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
