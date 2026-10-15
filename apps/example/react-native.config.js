const path = require('path')
// const pak = require('../package.json');

module.exports = {
  dependencies: {
    'nitro-core': {
      // RNCLI probes native folders before applying platform exclusions.
      root: path.dirname(require.resolve('nitro-core')),
      platforms: {
        ios: null,
        android: null,
      },
    },
    // [pak.name]: {
    //   root: path.join(__dirname, '..'),
    // },
  },
}
