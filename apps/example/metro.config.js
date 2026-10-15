const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const path = require('path')
const pak = require('../../package.json')

const root = path.resolve(__dirname, '../..')
const modules = Object.keys({ ...pak.peerDependencies })
const corePath = path
  .join(root, 'packages/react-native-nitro-modules/nitro')
  .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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
      new RegExp(
        `^${corePath}[/\\\\](?!packages(?:[/\\\\]nitro-core(?:[/\\\\]|$)|$)).*`
      ),
    ],
    extraNodeModules: modules.reduce((acc, name) => {
      acc[name] = path.join(__dirname, 'node_modules', name)
      return acc
    }, {}),
  },

  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
}

module.exports = mergeConfig(getDefaultConfig(__dirname), config)
