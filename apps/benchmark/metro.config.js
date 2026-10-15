const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const path = require('node:path')

const root = path.resolve(__dirname, '../..')
const corePath = path.join(root, 'core').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [root],
  resolver: {
    // Metro reads the staged package, so exclude the second source tree.
    blockList: [new RegExp(`^${corePath}[/\\\\].*`)],
  },
}

module.exports = mergeConfig(getDefaultConfig(__dirname), config)
