// chai (behind `expect` from react-native-harness) creates an `EventTarget`
// when it is imported, which Hermes doesn't have. The Harness CLI installs the
// same polyfill in its own entry point, which the normal app doesn't run.
// (event-target-shim 6 ships no type declarations.)
const Shim = require('event-target-shim') as {
  Event: unknown
  EventTarget: unknown
}
const globals = globalThis as {
  Event?: unknown
  EventTarget?: unknown
}
if (typeof globals.Event !== 'function') {
  globals.Event = Shim.Event
}
if (typeof globals.EventTarget !== 'function') {
  globals.EventTarget = Shim.EventTarget
}
