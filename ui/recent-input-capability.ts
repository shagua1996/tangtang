// Preload runs once per window; Vite can replace the renderer without replacing it.
export function supportsRecentOrderInputs(bridge: unknown): boolean {
  if (!bridge || typeof bridge !== 'object') return false
  return ['getRecentOrderInputs', 'rememberOrderInput', 'deleteRecentOrderInput']
    .every(name => typeof (bridge as Record<string, unknown>)[name] === 'function')
}
