export function register({ match: matchModule, ui: uiModule }) {
  uiModule.updateHUD = function updateHUD() {
    if (!matchModule.player || !matchModule.enemy) return;
    for (const [f, prefix] of [
      [matchModule.player, 'p1'],
      [matchModule.enemy, 'p2'],
    ]) {
      const barHp = f.maxHp / 2;
      uiModule.el[prefix + 'hp'].style.width =
        Math.min(1, Math.max(0, (f.hp - barHp) / barHp)) * 100 + '%';
      document.getElementById(prefix + 'reserve').style.width =
        Math.min(1, Math.max(0, f.hp / barHp)) * 100 + '%';
    }
    uiModule.el.p1ki.style.width = (matchModule.player.ki / matchModule.player.maxKi) * 100 + '%';
    uiModule.el.p2ki.style.width = (matchModule.enemy.ki / matchModule.enemy.maxKi) * 100 + '%';
    uiModule.el.p1kibar.classList.toggle('full', matchModule.player.ki >= matchModule.player.maxKi);
    uiModule.el.p2kibar.classList.toggle('full', matchModule.enemy.ki >= matchModule.enemy.maxKi);
    uiModule.el.p1ult.classList.toggle('on', matchModule.player.ki >= matchModule.player.maxKi);
    uiModule.el.p2ult.classList.toggle('on', matchModule.enemy.ki >= matchModule.enemy.maxKi);
    const t = Math.ceil(matchModule.game.timeLeft);
    uiModule.el.timer.textContent = String(t).padStart(2, '0');
    uiModule.el.timer.classList.toggle('low', t <= 10);
  };
  uiModule.hideCombo = function hideCombo() {
    uiModule.el.combo.classList.remove('show');
  };
  return function initialize() {
    uiModule.el = {
      p1name: document.getElementById('p1name'),
      p2name: document.getElementById('p2name'),
      p1ultname: document.getElementById('p1ultname'),
      p2ultname: document.getElementById('p2ultname'),
      p1hp: document.getElementById('p1hp'),
      p2hp: document.getElementById('p2hp'),
      p1ki: document.getElementById('p1ki'),
      p2ki: document.getElementById('p2ki'),
      p1kibar: document.getElementById('p1kibar'),
      p2kibar: document.getElementById('p2kibar'),
      p1ult: document.getElementById('p1ult'),
      p2ult: document.getElementById('p2ult'),
      timer: document.getElementById('timer'),
      hud: document.getElementById('hud'),
      combo: document.getElementById('combo'),
    };
  };
}
