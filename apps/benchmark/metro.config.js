const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const path = require('node:path')

const root = path.resolve(__dirname, '../..')
const corePath = path
  .join(root, 'packages/react-native-nitro-modules/nitro')
  .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [root],
  resolver: {
    // Native sources are staged in the RN package. Only nitro-core is a JS workspace.
    blockList: [
      new RegExp(
        `^${corePath}[/\\\\](?!packages(?:[/\\\\]nitro-core(?:[/\\\\]|$)|$)).*`
      ),
    ],
  },
}

module.exports = mergeConfig(getDefaultConfig(__dirname), config)
