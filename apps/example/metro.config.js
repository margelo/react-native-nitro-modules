const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const path = require('path')
const pak = require('../../package.json')

const root = path.resolve(__dirname, '../..')
const modules = Object.keys({ ...pak.peerDependencies })
const corePath = path
  .join(root, 'packages/react-native-nitro-modules/nitro')
  .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Metro blocks every `__tests__` directory by default. The in-app test runner
// bundles this app's Harness tests, so only block the other ones.
const appTestsDirectory = path.join(__dirname, '__tests__') + path.sep
const otherTestDirectories = new RegExp(
  `^(?!${escapeRegExp(appTestsDirectory)}).*[/\\\\]__tests__[/\\\\].*`
)

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [root],

  // We need to make sure that only one version is loaded for peerDependencies
  // So we block them at the root, and alias them to the versions in example's node_modules
  resolver: {
    // Native sources are staged in the RN package. Only nitro-core is a JS workspace.
    blockList: [
      otherTestDirectories,
      new RegExp(
        `^${corePath}[/\\\\](?!packages(?:[/\\\\]nitro-core(?:[/\\\\]|$)|$)).*`
      ),
    ],
    extraNodeModules: modules.reduce((acc, name) => {
      acc[name] = path.join(__dirname, 'node_modules', name)
      return acc
    }, {}),
    // Test files can only be evaluated while Harness collects tests, so a
    // Fast Refresh of one must reload the whole app.
    unstable_forceFullRefreshPatterns: [/\.harness\.[jt]sx?$/],
  },

  transformer: {
    // The in-app test runner finds the test files with `require.context`.
    unstable_allowRequireContext: true,
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
}

module.exports = mergeConfig(getDefaultConfig(__dirname), config)
