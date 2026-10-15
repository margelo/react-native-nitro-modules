declare var gc: () => void

declare var performance: {
  now(): number
}

// Metro's `require.context(...)` (enabled in metro.config.js)
interface MetroRequireContext {
  (id: string): unknown
  keys(): string[]
}
interface NodeRequire {
  context(
    directory: string,
    recursive?: boolean,
    filter?: RegExp,
    mode?: 'sync' | 'eager' | 'lazy' | 'lazy-once'
  ): MetroRequireContext
}
