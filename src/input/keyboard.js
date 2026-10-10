export function register({ combat: combatModule, input: inputModule, match: matchModule }) {
  return function initialize() {
    inputModule.keys = {};
    inputModule.justPressed = {};
    addEventListener('keydown', (e) => {
      if (!e.repeat) {
        inputModule.justPressed[e.code] = true;
        if (
          matchModule.game.screen === 'fight' &&
          !matchModule.game.paused &&
          !matchModule.game.over &&
          matchModule.game.ready <= 0 &&
          combatModule.EDGE_KEYS[e.code]
        )
          combatModule.inputEdges.push({
            at: performance.now(),
            type: combatModule.EDGE_KEYS[e.code],
            up: !!inputModule.keys.KeyW,
            down: !!inputModule.keys.KeyS,
          });
      }
      inputModule.keys[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
        e.preventDefault();
    });
    addEventListener('keyup', (e) => {
      inputModule.keys[e.code] = false;
    });
    addEventListener('blur', () => {
      for (const k in inputModule.keys) inputModule.keys[k] = false;
    });
  };
}
