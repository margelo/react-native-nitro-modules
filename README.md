<a href="https://nitro.margelo.com">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/static/img/banner-nitro-modules-dark.png" />
    <source media="(prefers-color-scheme: light)" srcset="./docs/static/img/banner-nitro-modules-light.png" />
    <img alt="Nitro Modules" src="./docs/static/img/banner-nitro-modules-light.png" />
  </picture>
</a>

<br />

**Nitro Modules** are fast, type-safe native modules for React Native with statically compiled bindings to JSI.
They consist of two parts:

- [**react-native-nitro-modules**](packages/react-native-nitro-modules): The React Native package and native build integration for Nitro Modules
- [**nitrogen**](https://github.com/margelo/nitro/tree/core-split/packages/nitrogen): An optional code-generator for nitro module library authors

## Example

Declaration (TypeScript):
```ts
export interface Math extends HybridObject<{ ios: 'c++' }> {
  add(a: number, b: number): number
}
```

Implementation (C++, Swift or Kotlin):
```cpp
class HybridMath: public HybridMathSpec {
public:
  HybridMath(): HybridObject(TAG) {}
  double add(double a, double b) override {
    return a + b;
  }
}
```

Usage (TypeScript):
```ts
import { NitroModules } from 'react-native-nitro-modules'

const math = NitroModules.createHybridObject<Math>('Math')
const result = math.add(5, 3)
```

## Installation

Install [react-native-nitro-modules](https://npmjs.org/react-native-nitro-modules) from npm:
```sh
npm i react-native-nitro-modules
cd ios && pod install
```

## Documentation

- [**Nitro** docs 📚](https://nitro.margelo.com)
- [**Community Discord** 💬](https://margelo.com/discord)
- [**Nitro Module Builder** AI GPT 🤖](https://chatgpt.com/g/g-6870125d0fcc8191925bd20a02c78bcf-nitro-module-builder)
- [**How to build a Nitro Module** YouTube Tutorial ▶️](https://youtu.be/528SxTGnIlc?si=IxH7n09ZVe4iwRPv)
- [**nitrogen**/README.md](https://github.com/margelo/nitro/blob/core-split/packages/nitrogen/README.md)
- [**react-native-nitro-modules**/README.md](./packages/react-native-nitro-modules/README.md)
- [**react-native-nitro-test** example module](./packages/react-native-nitro-test/README.md)
- [`TestObject.nitro.ts` example playground](./packages/react-native-nitro-test/src/specs/TestObject.nitro.ts)

## Supported Platforms

### Cross-platform

Cross-platform native modules can be built with C++.
Any custom C++ types can be used and bridged to JS with minimal overhead.

JS <-> C++ type converters are statically generated ahead of time - no more dynamic lookups or runtime parser errors! 🥳

### iOS

iOS native modules and view components can be written either in pure C++, or pure Swift.
Thanks to Swift 5.9, Swift Nitro Modules [bridge directly to C++](https://www.swift.org/documentation/cxx-interop/) instead of going through Objective-C message sends. Woohoo, no more Objective-C, and **zero overhead** C++ -> Swift calls! 🥳

### Android

Android native modules and view components can be written either in pure C++, or pure Kotlin/Java.
Thanks to fbjni, even complex types can be effortlessly bridged to Kotlin/Java with minimal overhead! 🔥

## Margelo

Nitro is built with ❤️ by Margelo.
We build fast and beautiful apps. Contact us at [margelo.com](https://margelo.com) for consultancy services.

## Contributing

This repository owns the React Native package, apps, test modules, docs, and templates. Shared runtime sources and Nitrogen live in [margelo/nitro](https://github.com/margelo/nitro), pinned here by the `packages/react-native-nitro-modules/nitro/` submodule.

For a fresh checkout, run `bun bootstrap` to initialize `packages/react-native-nitro-modules/nitro/`, install dependencies, and build the workspace. Run `bun bootstrap:ios` to also install the example app's iOS dependencies. Implementation changes belong in `packages/react-native-nitro-modules/nitro/`; `bun sync-core` copies them into the React Native package before builds and packing.

Read [CONTRIBUTING.md](./CONTRIBUTING.md) for the contribution flow (PR expectations, the required test-per-fix rule, and the nitrogen workflow). For environment setup and reproduction walkthroughs, see the [contributing guide](https://nitro.margelo.com/docs/resources/contributing) on the docs site.

## License

MIT
