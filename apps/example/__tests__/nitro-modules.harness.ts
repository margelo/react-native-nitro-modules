import { Platform } from 'react-native'
import { describe, expect, it } from 'react-native-harness'
import {
  getHybridObjectConstructor,
  NitroModules,
} from 'react-native-nitro-modules'
import {
  HybridPlatformObject,
  type TestObjectCpp,
} from 'react-native-nitro-test'
import {
  getHybridObjectConstructor as getCoreHybridObjectConstructor,
  getInstalledNitro,
  NitroModules as CoreNitroModules,
} from 'nitro-core'
import { describeEachTestObject } from './utils/testObjects'

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
})

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
})

describe('PlatformObject', () => {
  it('getOSVersion() returns the OS version string', () => {
    const version = HybridPlatformObject.getOSVersion()
    expect(version).toBeTypeOf('string')
    expect(version).toBe(getReactNativeOSVersion())
  })
})
