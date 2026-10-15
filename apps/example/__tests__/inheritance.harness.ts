import { expect, it } from 'react-native-harness'
import { NitroModules } from 'react-native-nitro-modules'
import { itIf } from './utils/helpers'
import { describeEachTestObject } from './utils/testObjects'

const CHILD_TO_STRING = 'HybridChild custom toString() :)'

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
})
