export function register({
  audio: audioModule,
  combat: combatModule,
  input: inputModule,
  match: matchModule,
  render: renderModule,
  ui: uiModule,
}) {
  matchModule.notify = function notify(message, seconds = 0.8) {
    document.getElementById('fightNotice').textContent = message;
    matchModule.messageUntil = performance.now() + seconds * 1000;
  };
  matchModule.setPaused = function setPaused(value) {
    if (matchModule.game.screen !== 'fight' || matchModule.game.over) return;
    matchModule.game.paused = value;
    if (value) combatModule.cancelKiHolds();
    if (matchModule.player) matchModule.player.clearQueue();
    if (matchModule.enemy) matchModule.enemy.clearQueue();
    if (audioModule.actx && !matchModule.game.muted) {
      if (value) audioModule.actx.suspend();
      else audioModule.actx.resume();
    }
    document.getElementById('pause').inert = !value;
    uiModule.el.hud.inert = value;
    document.getElementById('pause').classList.toggle('show', value);
    for (const k in inputModule.keys) inputModule.keys[k] = false;
    inputModule.clearPresses();
    matchModule.stepAccumulator = 0;
    renderModule.clock.getDelta();
  };
  return function initialize() {
    matchModule.pendingHits = [];
    matchModule.STEP = 1 / 120;
    matchModule.stepAccumulator = 0;
    matchModule.messageUntil = 0;
  };
}
