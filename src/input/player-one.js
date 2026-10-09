export function register({ combat: combatModule, input: inputModule, training: trainingModule }) {
  inputModule.readPlayerInput = function readPlayerInput() {
    const actions = combatModule.inputEdges.splice(0);
    return {
      actions,
      moveYaw: trainingModule.movementYaw(0),
      up: !!inputModule.keys.KeyW,
      down: !!inputModule.keys.KeyS,
      left: !!inputModule.keys.KeyA,
      right: !!inputModule.keys.KeyD,
      flight: !!inputModule.keys.Space,
      block: !!inputModule.keys.KeyL,
      crouch: !!inputModule.keys.KeyC,
      charge: !!inputModule.keys.KeyI,
      blastHeld: !!inputModule.keys.KeyF,
    };
  };
  inputModule.clearPresses = function clearPresses() {
    for (const k in inputModule.justPressed) delete inputModule.justPressed[k];
    combatModule.inputEdges.length = 0;
    inputModule.inputEdges2.length = 0;
  };
  return function initialize() {};
}
