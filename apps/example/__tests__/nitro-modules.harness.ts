import { Platform } from 'react-native'
import { describe, expect, it } from 'react-native-harness'
import {
  getHybridObjectConstructor,
  NitroModules,
} from 'react-native-nitro-modules'
import nitroModulesPackage from 'react-native-nitro-modules/package.json'
import {
  type Base,
  type Child,
  HybridPlatformObject,
  type TestObjectCpp,
  type TestObjectSwiftKotlin,
} from 'react-native-nitro-test'
import {
  getHybridObjectConstructor as getCoreHybridObjectConstructor,
  getInstalledNitro,
  NitroModules as CoreNitroModules,
} from 'nitro-core'
import { HybridSomeExternalObject } from 'react-native-nitro-test-external'
import { itIf } from './utils/helpers'
import { describeEachTestObject } from './utils/testObjects'

const IS_DEBUG = NitroModules.buildType === 'debug'
const UNKNOWN_NAME = 'SomeUnregisteredHybridObject'

// Every autolinked non-view HybridObject. Views are left out because they
// create platform views, which must happen on the UI Thread.
const REGISTERED_NAMES = [
  'TestObjectCpp',
  'TestObjectSwiftKotlin',
  'Base',
  'Child',
  'PlatformObject',
  'SomeExternalObject',
]

const PRIMITIVES: { label: string; value: unknown }[] = [
  { label: 'undefined', value: undefined },
  { label: 'null', value: null },
  { label: '42', value: 42 },
  { label: "'TestObjectCpp'", value: 'TestObjectCpp' },
]

/**
 * The OS version as React Native reports it, which reads the same platform
 * API as `PlatformObject` (`UIDevice.systemVersion` / `Build.VERSION.RELEASE`).
 */
function getReactNativeOSVersion(): string | undefined {
  switch (Platform.OS) {
    case 'ios':
      return Platform.constants.osVersion
    case 'android':
      return Platform.constants.Release
    default:
      return undefined
  }
}

describe('nitro-core integration', () => {
  it('shares the installed native proxy and constructor helper with React Native', () => {
    expect(getInstalledNitro()).toBe(NitroModules)
    expect(CoreNitroModules).toBe(NitroModules)
    expect(getCoreHybridObjectConstructor).toBe(getHybridObjectConstructor)
  })
})

describe('NitroModules', () => {
  it('createNativeArrayBuffer(...) returns a writable ArrayBuffer', () => {
    const buffer = NitroModules.createNativeArrayBuffer(1024)
    expect(buffer).toBeInstanceOf(ArrayBuffer)
    expect(buffer.byteLength).toBe(1024)

    const array = new Uint8Array(buffer)
    array[0] = 13
    expect(array[0]).toBe(13)
  })

  it('buildType is debug or release', () => {
    expect(NitroModules.buildType).toBeOneOf(['debug', 'release'])
  })

  it('version is a semver string', () => {
    expect(NitroModules.version).toBeTypeOf('string')
    expect(NitroModules.version).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('getAllHybridObjectNames() returns every autolinked HybridObject', () => {
    const names = NitroModules.getAllHybridObjectNames()
    expect(names).toBeInstanceOf(Array)
    expect(names).toEqual(
      expect.arrayContaining([
        'TestObjectCpp',
        'TestObjectSwiftKotlin',
        'Base',
        'Child',
        'PlatformObject',
        'TestView',
        'RecyclableTestView',
        'SomeExternalObject',
      ])
    )
  })

  it('version matches the react-native-nitro-modules JS package', () => {
    expect(NitroModules.version).toBe(nitroModulesPackage.version)
  })

  it('name is "NitroModulesProxy"', () => {
    expect(NitroModules.name).toBe('NitroModulesProxy')
  })

  it('toString() is "[HybridObject NitroModulesProxy]"', () => {
    expect(NitroModules.toString()).toBe('[HybridObject NitroModulesProxy]')
  })

  it('isHybridObject(NitroModules) is true', () => {
    expect(NitroModules.isHybridObject(NitroModules)).toBe(true)
  })

  for (const size of [0, 1, 4097, 16 * 1024 * 1024]) {
    it(`createNativeArrayBuffer(${size}) has a byteLength of ${size}`, () => {
      expect(NitroModules.createNativeArrayBuffer(size).byteLength).toBe(size)
    })
  }

  it('createNativeArrayBuffer(...) returns independent memory every call', () => {
    const a = new Uint8Array(NitroModules.createNativeArrayBuffer(8))
    const b = new Uint8Array(NitroModules.createNativeArrayBuffer(8))
    a[0] = 1
    b[0] = 2
    expect([a[0], b[0]]).toEqual([1, 2])
  })
})

describe('NitroModules registry', () => {
  it('hasHybridObject(unknown name) is false', () => {
    expect(NitroModules.hasHybridObject(UNKNOWN_NAME)).toBe(false)
  })

  it('hasHybridObject(...) is case-sensitive', () => {
    expect(NitroModules.hasHybridObject('testobjectcpp')).toBe(false)
  })

  it('getAllHybridObjectNames() has no duplicates', () => {
    const names = NitroModules.getAllHybridObjectNames()
    expect(names).toEqual([...new Set(names)])
  })

  it('hasHybridObject(...) is true for every getAllHybridObjectNames() entry', () => {
    const missing = NitroModules.getAllHybridObjectNames().filter(
      (name) => !NitroModules.hasHybridObject(name)
    )
    expect(missing).toEqual([])
  })

  it('createHybridObject(unknown name) throws a not-registered error', () => {
    const create = () => NitroModules.createHybridObject(UNKNOWN_NAME)
    expect(create).toThrow('NitroModulesProxy.createHybridObject(...)')
    expect(create).toThrow(
      `Cannot create an instance of HybridObject "${UNKNOWN_NAME}" - It has not yet been registered in the Nitro Modules HybridObjectRegistry!`
    )
  })

  it('createHybridObject(unknown name) error lists the registered names', () => {
    expect(() => NitroModules.createHybridObject(UNKNOWN_NAME)).toThrow(
      /All registered HybridObjects: \[[^\]]*\bTestObjectCpp\b[^\]]*\]/
    )
  })

  for (const name of REGISTERED_NAMES) {
    it(`createHybridObject('${name}') returns an object named "${name}"`, () => {
      const object = NitroModules.createHybridObject(name)
      expect(NitroModules.isHybridObject(object)).toBe(true)
      expect(object.name).toBe(name)
    })
  }

  it('createHybridObject(...) returns a new instance every call', () => {
    const a = NitroModules.createHybridObject('Base')
    const b = NitroModules.createHybridObject('Base')
    expect(a).not.toBe(b)
    expect(a.equals(b)).toBe(false)
  })
})

describe('NitroModules type checks', () => {
  it('isHybridObject(...) is false for primitives', () => {
    const results = Object.fromEntries(
      PRIMITIVES.map(({ label, value }) => [
        label,
        NitroModules.isHybridObject(value as object),
      ])
    )
    expect(results).toEqual({
      'undefined': false,
      'null': false,
      '42': false,
      "'TestObjectCpp'": false,
    })
  })

  it('hasNativeState(...) is false for primitives', () => {
    const results = Object.fromEntries(
      PRIMITIVES.map(({ label, value }) => [
        label,
        NitroModules.hasNativeState(value),
      ])
    )
    expect(results).toEqual({
      'undefined': false,
      'null': false,
      '42': false,
      "'TestObjectCpp'": false,
    })
  })

  it('isHybridObject({}) is false', () => {
    expect(NitroModules.isHybridObject({})).toBe(false)
  })

  it('hasNativeState({}) is false', () => {
    expect(NitroModules.hasNativeState({})).toBe(false)
  })

  it('isHybridObject(a HybridObject prototype) is false', () => {
    expect(
      NitroModules.isHybridObject(
        Object.getPrototypeOf(HybridSomeExternalObject)
      )
    ).toBe(false)
  })

  it('hasNativeState(a JS ArrayBuffer) is false', () => {
    expect(NitroModules.hasNativeState(new ArrayBuffer(8))).toBe(false)
  })

  it('hasNativeState(a native ArrayBuffer) is true', () => {
    expect(
      NitroModules.hasNativeState(NitroModules.createNativeArrayBuffer(8))
    ).toBe(true)
  })

  it('isHybridObject(a native ArrayBuffer) is false', () => {
    // It has a NativeState, but not a HybridObject one.
    expect(
      NitroModules.isHybridObject(NitroModules.createNativeArrayBuffer(8))
    ).toBe(false)
  })
})

describeEachTestObject('NitroModules with a HybridObject', (testObject) => {
  it('box(testObject) returns a boxed object', () => {
    const boxed = NitroModules.box(testObject)
    expect(boxed).toBeTypeOf('object')
    expect(boxed.unbox).toBeTypeOf('function')
  })

  it('box(testObject).unbox() returns the same object', () => {
    const boxed = NitroModules.box(testObject)
    expect(boxed.unbox()).toBe(testObject)
  })

  it('hasHybridObject(testObject.name) is true', () => {
    expect(NitroModules.hasHybridObject(testObject.name)).toBe(true)
  })

  it('isHybridObject(testObject) is true', () => {
    expect(NitroModules.isHybridObject(testObject)).toBe(true)
  })

  it('hasNativeState(testObject) is true', () => {
    expect(NitroModules.hasNativeState(testObject)).toBe(true)
  })

  it('box(testObject) only exposes unbox', () => {
    expect(Object.keys(NitroModules.box(testObject))).toEqual(['unbox'])
  })

  it('box(testObject) is not a HybridObject itself', () => {
    expect(NitroModules.isHybridObject(NitroModules.box(testObject))).toBe(
      false
    )
  })

  it('box(newTestObject()).unbox() returns that new object', () => {
    const other = testObject.newTestObject()
    expect(NitroModules.box(other).unbox()).toBe(other)
  })

  itIf(IS_DEBUG)('box({}) throws because it has no NativeState', () => {
    // @ts-expect-error - a plain object is not a HybridObject
    const boxPlainObject = () => NitroModules.box({})
    expect(boxPlainObject).toThrow('NitroModulesProxy.box(...)')
    expect(boxPlainObject).toThrow('It does not have a NativeState!')
  })

  it('updateMemorySize(testObject) returns the same object', () => {
    expect(NitroModules.updateMemorySize(testObject)).toBe(testObject)
  })
})

describeEachTestObject(
  'getHybridObjectConstructor instanceof',
  (testObject) => {
    const HybridBase = getHybridObjectConstructor<Base>('Base')
    const HybridChild = getHybridObjectConstructor<Child>('Child')

    it('createBase() is an instance of Base', () => {
      expect(testObject.createBase()).toBeInstanceOf(HybridBase)
    })

    it('createBase() is not an instance of Child', () => {
      expect(testObject.createBase()).not.toBeInstanceOf(HybridChild)
    })

    it('createChild() is an instance of Child', () => {
      expect(testObject.createChild()).toBeInstanceOf(HybridChild)
    })

    it('createChild() is an instance of Base', () => {
      expect(testObject.createChild()).toBeInstanceOf(HybridBase)
    })

    it('createBaseActualChild() is an instance of Child', () => {
      expect(testObject.createBaseActualChild()).toBeInstanceOf(HybridChild)
    })

    it('testObject is not an instance of Base', () => {
      expect(testObject).not.toBeInstanceOf(HybridBase)
    })
  }
)

describe('getHybridObjectConstructor', () => {
  const HybridTestObjectCpp =
    getHybridObjectConstructor<TestObjectCpp>('TestObjectCpp')

  it('new T() creates a HybridObject', () => {
    const instance = new HybridTestObjectCpp()
    expect(NitroModules.isHybridObject(instance)).toBe(true)
    expect(instance.name).toBe('TestObjectCpp')
    expect(instance).toHaveProperty('boolValue')
  })

  it('new T() is an instance of T', () => {
    expect(new HybridTestObjectCpp()).toBeInstanceOf(HybridTestObjectCpp)
  })

  it('{} is not an instance of T', () => {
    expect({}).not.toBeInstanceOf(HybridTestObjectCpp)
  })

  it('new T() creates a new instance every time', () => {
    const a = new HybridTestObjectCpp()
    const b = new HybridTestObjectCpp()
    expect(a).not.toBe(b)
  })

  it('new T().equals(itself) is true', () => {
    const a = new HybridTestObjectCpp()
    expect(a.equals(a)).toBe(true)
  })

  it('returns the same constructor for the same name', () => {
    expect(getHybridObjectConstructor<TestObjectCpp>('TestObjectCpp')).toBe(
      HybridTestObjectCpp
    )
  })

  it('a different HybridObject type is not an instance of T', () => {
    const HybridTestObjectSwiftKotlin =
      getHybridObjectConstructor<TestObjectSwiftKotlin>('TestObjectSwiftKotlin')
    expect(new HybridTestObjectSwiftKotlin()).not.toBeInstanceOf(
      HybridTestObjectCpp
    )
  })

  it('an existing instance is an instance of T', () => {
    expect(HybridSomeExternalObject).toBeInstanceOf(
      getHybridObjectConstructor('SomeExternalObject')
    )
  })

  it('new T() throws for an unregistered name', () => {
    const HybridUnknown = getHybridObjectConstructor(UNKNOWN_NAME)
    expect(() => new HybridUnknown()).toThrow(
      `Cannot create an instance of HybridObject "${UNKNOWN_NAME}"`
    )
  })
})

describe('PlatformObject', () => {
  it('getOSVersion() returns the OS version string', () => {
    const version = HybridPlatformObject.getOSVersion()
    expect(version).toBeTypeOf('string')
    expect(version).toBe(getReactNativeOSVersion())
  })
})
