/** Per-application mutable state. These namespaces are internal module interfaces. */
export function createRuntime() {
  return Object.seal({
    render: {},
    audio: {},
    animation: {},
    characters: {},
    combat: {},
    world: {},
    input: {},
    match: {},
    ui: {},
    ai: {},
    training: {},
    art: {},
    app: {},
    testing: {},
  });
}
