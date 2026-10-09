export function register({
  app: appModule,
  audio: audioModule,
  combat: combatModule,
  match: matchModule,
  render: renderModule,
  ui: uiModule,
}) {
  appModule.boot = function boot() {
    document.getElementById('hud').inert = true;
    document.getElementById('result').inert = true;
    document.getElementById('pause').inert = true;
    uiModule.buildMenu();
    matchModule.previewMap(matchModule.game.selectedMap);
    renderModule.menuAngle = 0;
    document.getElementById('startBtn').onclick = matchModule.startFight;
    document.getElementById('againBtn').onclick = matchModule.startFight;
    document.getElementById('menuBtn').onclick = matchModule.backToMenu;
    addEventListener('keydown', (e) => {
      if (
        e.code === 'Enter' &&
        matchModule.game.screen === 'menu' &&
        matchModule.game.menuPage !== 'online' &&
        !e.repeat &&
        !['SELECT', 'BUTTON'].includes(e.target.tagName)
      ) {
        e.preventDefault();
        if (matchModule.game.menuPage === 'home') uiModule.showSelection();
        else {
          matchModule.game.keepPair = false;
          matchModule.game.wins = [0, 0];
          matchModule.game.matchRound = 1;
          matchModule.startFight();
        }
      }
      if (e.code === 'Escape' && matchModule.game.screen !== 'menu') {
        e.dbReturnedFromFight = true;
        matchModule.backToMenu();
      }
    });
    document.addEventListener('click', audioModule.initAudio, {
      once: true,
    });
    renderModule.clock.start();
    document.getElementById('loading').classList.add('hidden');
    requestAnimationFrame(combatModule.loop);
  };
  return function initialize() {};
}
