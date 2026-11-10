// Next.js supplies this boundary marker; Node integration tests execute server code directly.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') return { url: 'data:text/javascript,export {}', shortCircuit: true };
  return nextResolve(specifier, context);
}
