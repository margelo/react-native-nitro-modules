import { expect, it } from 'react-native-harness'
import { NitroModules } from 'react-native-nitro-modules'
import { describeEachTestObject } from './utils/testObjects'

// Kept in its own file: under Thread Sanitizer this can take a long time, and a
// timed-out test skips every remaining test in the same file.
describeEachTestObject('Promises under parallel load', (testObject) => {
  // Resolves a HybridObject off the JS thread; the race is between resolve() and
  // JSIConverter::toJSI reading Promise state on the JS thread. Passes
  // functionally; the verdict is Thread Sanitizer.
  it('newTestObjectAsync() does not data-race (run under Thread Sanitizer)', async () => {
    let objects: object[] = []
    for (let round = 0; round < 20; round++) {
      objects = await Promise.all(
        Array.from({ length: 32 }, () => testObject.newTestObjectAsync())
      )
    }
    // Only check the last round, so the stress loop itself stays cheap.
    expect(objects).toHaveLength(32)
    for (const object of objects) {
      expect(NitroModules.isHybridObject(object)).toBe(true)
    }
  })
})
