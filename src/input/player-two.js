export function register({ input: inputModule, match: matchModule, training: trainingModule }) {
  let EDGE_KEYS2;
  inputModule.readPlayer2Input = function readPlayer2Input() {
    return {
      actions: inputModule.inputEdges2.splice(0),
      moveYaw: trainingModule.movementYaw(1),
      up: !!inputModule.keys.ArrowUp,
      down: !!inputModule.keys.ArrowDown,
      left: !!inputModule.keys.ArrowLeft,
      right: !!inputModule.keys.ArrowRight,
      block: !!inputModule.keys.Numpad4,
      crouch: !!inputModule.keys.NumpadDecimal,
      charge: !!inputModule.keys.Numpad5,
      blastHeld: !!inputModule.keys.NumpadSubtract,
      flight: !!inputModule.keys.Numpad0,
    };
  };
  return function initialize() {
    inputModule.inputEdges2 = [];
    EDGE_KEYS2 = {
      NumpadAdd: 'special',
      Numpad1: 'light',
      Numpad2: 'heavy',
      Numpad3: 'ult',
      Numpad6: 'dash',
      Numpad7: 'throw',
      Numpad8: 'evasion',
      Numpad9: 'pursuit',
      Numpad0: 'jump',
    };
    addEventListener('keydown', (e) => {
      if (e.code.startsWith('Numpad')) e.preventDefault();
      if (
        !e.repeat &&
        matchModule.game.screen === 'fight' &&
        !matchModule.game.paused &&
        !matchModule.game.over &&
        matchModule.game.ready <= 0 &&
        matchModule.game.difficulty === 'local' &&
        EDGE_KEYS2[e.code]
      )
        inputModule.inputEdges2.push({
          type: EDGE_KEYS2[e.code],
          up: !!inputModule.keys.ArrowUp,
          down: !!inputModule.keys.ArrowDown,
        });
    });
  };
}
