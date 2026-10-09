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
      const held = inputModule.keys[e.code];
      inputModule.keys[e.code] = false;
      if (
        held &&
        matchModule.game.screen === 'fight' &&
        !matchModule.game.paused &&
        !matchModule.game.over &&
        matchModule.game.ready <= 0
      ) {
        const second = e.code === 'NumpadSubtract' && matchModule.game.difficulty === 'local',
          f = second ? matchModule.enemy : matchModule.player;
        if ((e.code === 'KeyF' || second) && f?.state !== 'blastCharge' && !f?.blastRejected)
          (second ? inputModule.inputEdges2 : combatModule.inputEdges).push({
            type: 'blast',
          });
      }
    });
    addEventListener('blur', () => {
      for (const k in inputModule.keys) inputModule.keys[k] = false;
    });
  };
}
