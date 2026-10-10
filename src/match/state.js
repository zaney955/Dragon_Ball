export function register({ match: matchModule }) {
  return function initialize() {
    matchModule.game = {
      screen: 'menu',
      selectedChar: 0,
      selectedMap: 0,
      timeLeft: 180,
      hitStop: 0,
      shake: 0,
      over: false,
      comboCount: 0,
      comboTimer: 0,
    };
    matchModule.player = null;
    matchModule.enemy = null;
  };
}
