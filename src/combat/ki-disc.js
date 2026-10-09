// Childhood-era compatibility state: no disc attack or disc presenter is registered.
export function register({ combat }) {
  combat.clearKiDiscs = function () {
    combat.kiDiscs.length = 0;
  };
  combat.updateKiDiscs = function () {};
  return function initialize() {
    combat.kiDiscs = [];
  };
}
