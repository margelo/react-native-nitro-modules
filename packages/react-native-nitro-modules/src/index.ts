import { installWorkletsSupport } from './worklets/installWorkletsSupport'

export * from 'nitro-core'
export { NitroModules, isRuntimeAlive } from './NitroModules'

export * from './views/HybridView'
export * from './views/getHostComponent'
export * from './views/callback'

installWorkletsSupport()
