import { expect, it } from 'react-native-harness'
import { NitroModules } from 'react-native-nitro-modules'
import { HybridChild } from 'react-native-nitro-test'
import { itIf } from './utils/helpers'
import { describeEachTestObject } from './utils/testObjects'

const CHILD_TO_STRING = 'HybridChild custom toString() :)'
const IS_DEBUG = NitroModules.buildType === 'debug'

/**
 * Returns the debug `__type` of every Nitro prototype in the prototype chain of
 * {@linkcode object}, most derived first. Only reads own data properties, so
 * it never invokes a native getter.
 */
function getPrototypeTypes(object: object): unknown[] {
  const types: unknown[] = []
  let prototype: object | null = Object.getPrototypeOf(object)
  while (prototype != null && Object.hasOwn(prototype, '__type')) {
    types.push(Object.getOwnPropertyDescriptor(prototype, '__type')?.value)
    prototype = Object.getPrototypeOf(prototype)
  }
  return types
}

/**
 * Compares prototypes as a boolean so a failure never prints a prototype.
 */
function isSamePrototype(a: object | null, b: object | null): boolean {
  return a === b
}

describeEachTestObject('Inheritance', (testObject) => {
  it('createBase() returns a Base', () => {
    const base = testObject.createBase()
    expect(NitroModules.isHybridObject(base)).toBe(true)
    expect(base).toHaveProperty('baseValue', 10)
    expect(base).not.toHaveProperty('childValue')
  })

  it('createChild() returns a Child with Base members', () => {
    const child = testObject.createChild()
    expect(NitroModules.isHybridObject(child)).toBe(true)
    expect(child).toHaveProperty('childValue', 30)
    expect(child).toHaveProperty('baseValue', 20)
  })

  it('createBase() has name "Base"', () => {
    expect(testObject.createBase().name).toBe('Base')
  })

  it('createChild() has name "Child"', () => {
    expect(testObject.createChild().name).toBe('Child')
  })

  it('createChild() has overridden toString()', () => {
    expect(testObject.createChild().toString()).toBe(CHILD_TO_STRING)
  })

  it('createBaseActualChild() has overridden toString()', () => {
    expect(testObject.createBaseActualChild().toString()).toBe(CHILD_TO_STRING)
  })

  it('createBaseActualChild() has name "Child"', () => {
    expect(testObject.createBaseActualChild().name).toBe('Child')
  })

  it('createBaseActualChild() returns a Base', () => {
    const base = testObject.createBaseActualChild()
    expect(NitroModules.isHybridObject(base)).toBe(true)
    expect(base).toHaveProperty('baseValue', 20)
  })

  it('createBaseActualChild() is actually a Child', () => {
    const base = testObject.createBaseActualChild()
    expect(base).toHaveProperty('childValue', 30)
    expect(base).toHaveProperty('baseValue', 20)
  })
})

describeEachTestObject('Inheritance casts', (testObject) => {
  it('bounceChild(Child) returns the same Child', () => {
    const child = testObject.createChild()
    expect(testObject.bounceChild(child)).toBe(child)
  })

  it('bounceBase(Base) returns the same Base', () => {
    const base = testObject.createBase()
    expect(testObject.bounceBase(base)).toBe(base)
  })

  it('bounceBase(Child) returns the same Child', () => {
    const child = testObject.createChild()
    expect(testObject.bounceBase(child)).toBe(child)
  })

  // In release, the downcast check is optimized away and this would crash.
  itIf(NitroModules.buildType === 'debug')('bounceChild(Base) throws', () => {
    const base = testObject.createBase()
    // @ts-expect-error - a Base is not a Child
    const bounceBaseAsChild = () => testObject.bounceChild(base)
    expect(bounceBaseAsChild).toThrow(`${testObject.name}.bounceChild(...)`)
    expect(bounceBaseAsChild).toThrow(
      'Downcasting failed - It has a different NativeState<T>!'
    )
  })

  it('bounceChildBase(Child) returns the same Child', () => {
    const child = testObject.createChild()
    expect(testObject.bounceChildBase(child)).toBe(child)
  })

  it('castBase(Child) returns the same Child', () => {
    const child = testObject.createChild()
    expect(testObject.castBase(child)).toBe(child)
  })

  it('castBase(createBaseActualChild()) returns the same object', () => {
    const base = testObject.createBaseActualChild()
    expect(testObject.castBase(base)).toBe(base)
  })

  it('castBase(registered Child) returns the same object', () => {
    expect(testObject.castBase(HybridChild)).toBe(HybridChild)
  })

  it('bounceBase(createBaseActualChild()) returns the same object', () => {
    const base = testObject.createBaseActualChild()
    expect(testObject.bounceBase(base)).toBe(base)
  })

  it('bounceChild(createBaseActualChild()) accepts the actual Child', () => {
    const base = testObject.createBaseActualChild()
    // @ts-expect-error - typed as a Base, but it is actually a Child
    expect(testObject.bounceChild(base)).toBe(base)
  })

  itIf(IS_DEBUG)('bounceChildBase(Base) throws', () => {
    const base = testObject.createBase()
    // @ts-expect-error - a Base is not a Child
    const bounceBaseAsChild = () => testObject.bounceChildBase(base)
    expect(bounceBaseAsChild).toThrow(`${testObject.name}.bounceChildBase(...)`)
    expect(bounceBaseAsChild).toThrow(
      'Downcasting failed - It has a different NativeState<T>!'
    )
  })

  itIf(IS_DEBUG)('bounceBase(another HybridObject type) throws', () => {
    // @ts-expect-error - a TestObject is not a Base
    expect(() => testObject.bounceBase(testObject)).toThrow(
      'Downcasting failed - It has a different NativeState<T>!'
    )
  })

  itIf(IS_DEBUG)('bounceBase({}) throws because it has no NativeState', () => {
    // @ts-expect-error - a plain object is not a Base
    expect(() => testObject.bounceBase({})).toThrow(
      'It does not have a NativeState!'
    )
  })
})

describeEachTestObject('Inheritance members', (testObject) => {
  it('createBase() has the default toString()', () => {
    expect(testObject.createBase().toString()).toBe('[HybridObject Base]')
  })

  it('createBase() does not have Child methods', () => {
    expect(testObject.createBase()).not.toHaveProperty('bounceVariant')
  })

  it('createChild() is not equal to another Child', () => {
    expect(testObject.createChild().equals(testObject.createChild())).toBe(
      false
    )
  })
})

describeEachTestObject('Inheritance prototypes', (testObject) => {
  it('createChild() prototype extends the createBase() prototype', () => {
    const childPrototype = Object.getPrototypeOf(testObject.createChild())
    const basePrototype = Object.getPrototypeOf(testObject.createBase())
    expect(
      isSamePrototype(Object.getPrototypeOf(childPrototype), basePrototype),
      'Object.getPrototypeOf(childPrototype) === basePrototype'
    ).toBe(true)
  })

  it('createBaseActualChild() has the Child prototype', () => {
    expect(
      isSamePrototype(
        Object.getPrototypeOf(testObject.createBaseActualChild()),
        Object.getPrototypeOf(testObject.createChild())
      ),
      'Object.getPrototypeOf(actualChild) === Object.getPrototypeOf(child)'
    ).toBe(true)
  })

  it('createChild() shares the prototype of the registered Child', () => {
    expect(
      isSamePrototype(
        Object.getPrototypeOf(testObject.createChild()),
        Object.getPrototypeOf(HybridChild)
      ),
      'Object.getPrototypeOf(child) === Object.getPrototypeOf(HybridChild)'
    ).toBe(true)
  })

  itIf(IS_DEBUG)(
    'createChild() prototype chain is Child, Base, HybridObject',
    () => {
      expect(getPrototypeTypes(testObject.createChild())).toEqual([
        'Prototype<HybridChildSpec>',
        'Prototype<HybridBaseSpec>',
        'Prototype<HybridObject>',
      ])
    }
  )

  itIf(IS_DEBUG)('createBase() prototype chain is Base, HybridObject', () => {
    expect(getPrototypeTypes(testObject.createBase())).toEqual([
      'Prototype<HybridBaseSpec>',
      'Prototype<HybridObject>',
    ])
  })
})
