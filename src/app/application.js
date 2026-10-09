import { createRuntime } from './runtime.js';

/**
 * Two-stage composition preserves declaration availability and initialization order.
 * register() only binds functions; initialize() creates state, resources and listeners.
 * The public interface starts a single application. Modules never depend on window globals.
 */
export function createApplication({ plan, testModules = {} }) {
  const runtime = createRuntime();
  const entries = plan.filter((entry) => !entry.test || testModules[entry.id]);
  const ids = new Set();
  for (const entry of entries) {
    if (ids.has(entry.id)) throw new Error(`Duplicate module: ${entry.id}`);
    ids.add(entry.id);
    if (typeof (entry.register ?? testModules[entry.id]) !== 'function') {
      throw new Error(`Missing module: ${entry.id}`);
    }
  }
  let started = false;
  return {
    start() {
      if (started) throw new Error('Application has already started');
      started = true;
      const initializers = entries.map((entry) => ({
        id: entry.id,
        initialize: (entry.register ?? testModules[entry.id])(runtime),
      }));
      for (const { id, initialize } of initializers) {
        try {
          initialize();
        } catch (cause) {
          throw new Error(`Failed to initialize ${id}`, {
            cause,
          });
        }
      }
      runtime.app.boot();
    },
  };
}
