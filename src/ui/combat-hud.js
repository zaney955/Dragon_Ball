import { INPUT_LABELS } from './character-help.js';
import { defenseStatus } from '../combat/defense-rules.js';

export function register({
  characters: charactersModule,
  combat: combatModule,
  match: matchModule,
  training: trainingModule,
  ui: uiModule,
}) {
  uiModule.fighterStatus = function fighterStatus(f, keys = INPUT_LABELS.one) {
    if (!f) return '';
    if (matchModule.game.over) return matchModule.game.endReason || '回合结束';
    if (matchModule.game.paused) return '已暂停';
    if (matchModule.game.ready > 0) return '准备';
    if (f.youth?.reversedTime > 0)
      return '太阳拳 · 方向反向 ' + f.youth.reversedTime.toFixed(1) + '秒';
    if (f.attack?.ability === 'sidestep') return '狼牙侧步 · 等待闪避反击';
    if (f.attack?.youthDodgeCounter) return '狼牙闪身 · 背后击飞';
    if (f.attack?.superArmor) return f.attack.name + ' · 霸体 · 承伤60%';
    if (f.attack) {
      if (f.attack.isKiBlast)
        return (
          f.attack.name +
          ' · ' +
          f.attack.kiCost +
          ' 能量 · ' +
          (f.attack.costCommitted ? '已发射' : '准备发射')
        );
      if (f.attack.id === 'special') return f.attack.name + ' · ' + f.attack.kiCost + ' 能量';
      if (f.attack.isUlt) return f.def.ultName + ' · 满能量必杀';
      if (f.attack.isThrow) return '投技';
      if (f.attack.id === 'launcher') return '挑空';
      if (f.attack.id === 'sweep') return '下段扫腿';
      return '连招 ' + (f.comboIdx + 1);
    }
    if (f.state === 'charge')
      return f.ki >= 100
        ? `能量已满 · ${keys.ultimate} 必杀`
        : (f.chargeHeld ?? 0) < combatModule.KI_RULES.chargeStartup
          ? '聚气起势'
          : '聚气 · +15 能量 / 秒';
    if (f.state === 'blastCharge') {
      const q = combatModule.kiBlastPower(f.blastHeldTime ?? 0, f.ki);
      return q.charged ? '蓄力气弹 · ' + q.cost + ' 能量 · 松开发射' : '气弹 · 5 能量 · 松开发射';
    }
    return (
      {
        charge: '聚气',
        block: f.crouching ? '下段防御' : '站立防御',
        blockstun: '格挡硬直',
        dash: f.dashKind === 'backflip' ? '连续后空翻' : f.dashKind === 'pursuit' ? '追击' : '闪身',
        hit: `受击 · ${keys.evasion} 脱身 / ${keys.burst} 解围`,
        guardbreak: '破防',
        knockdown: '倒地',
        landing: '落地恢复',
        grabbed: `被投 · ${keys.throw} 拆投`,
        dead: '倒下',
        crouch: '下蹲',
      }[f.state] ||
      (f.flightMode
        ? (f.def.id === 'goku' ? '筋斗云' : '舞空') + ' · ' + f.pos.y.toFixed(1) + ' m'
        : f.pos.y > 0.1
          ? '腾空'
          : '待机')
    );
  };
  uiModule.specialAvailability = function specialAvailability(f) {
    const name = combatModule.SPECIAL_MOVES[f.def.id].name;
    const usable =
      !matchModule.game.over &&
      !matchModule.game.paused &&
      matchModule.game.ready <= 0 &&
      f.hp > 0 &&
      f.ki >= 30 &&
      !f.attack &&
      ![
        'block',
        'hit',
        'blockstun',
        'guardbreak',
        'knockdown',
        'grabbed',
        'dead',
        'landing',
        'blastCharge',
      ].includes(f.state);
    const reason = f.ki < 30 ? '能量不足' : usable ? '可发动' : '等待行动恢复';
    return name + ' · 30 能量 · ' + reason;
  };
  uiModule.updateDefenseHUD = function updateDefenseHUD(f, prefix) {
    const guard = Math.min(100, Math.max(0, f.guard));
    const status = defenseStatus(f);
    const resource = document.getElementById(prefix + 'guardResource');
    const fill = document.getElementById(prefix + 'guard');
    const bar = fill.parentElement;
    resource.dataset.state = status.state;
    resource.title = status.hint;
    fill.style.width = guard + '%';
    document.getElementById(prefix + 'guardValue').textContent = Math.floor(guard) + '%';
    document.getElementById(prefix + 'guardState').textContent = status.label;
    bar.setAttribute('aria-valuenow', String(Math.floor(guard)));
    bar.setAttribute(
      'aria-valuetext',
      `防御 ${Math.floor(guard)}%，${status.label}，${status.hint}`,
    );
  };
  uiModule.updateExtraHUD = function updateExtraHUD() {
    const note = document.getElementById('fightNotice');
    note.classList.toggle(
      'visible',
      performance.now() < matchModule.messageUntil && matchModule.game.screen !== 'menu',
    );
    if (!matchModule.player || !matchModule.enemy) return;
    for (const [f, prefix] of [
      [matchModule.player, 'p1'],
      [matchModule.enemy, 'p2'],
    ]) {
      document
        .getElementById(prefix + 'kibar')
        .classList.toggle(
          'charging',
          f.state === 'charge' && !matchModule.game.paused && !matchModule.game.over,
        );
      document
        .getElementById(prefix + 'kibar')
        .classList.toggle('insufficient', (f.kiWarning ?? 0) > 0);
      document.getElementById(prefix + 'value').textContent =
        Math.ceil(f.hp) + ' / ' + f.maxHp + ' · 能量 ' + Math.floor(f.ki) + ' / 100';
      uiModule.updateDefenseHUD(f, prefix);
      document.getElementById(prefix + 'escape').textContent =
        '残像 ' + ('●'.repeat(f.escapeCharges) + '○'.repeat(2 - f.escapeCharges));
    }
    document.getElementById('actionState').textContent = uiModule.fighterStatus(matchModule.player);
    document.getElementById('roundScore').textContent =
      '第 ' +
      matchModule.game.matchRound +
      ' 回合 · ' +
      matchModule.game.wins.map((x) => '●'.repeat(x) + '○'.repeat(2 - x)).join(' : ');
    document.getElementById('specialState').textContent =
      'R ' + uiModule.specialAvailability(matchModule.player);
    document.getElementById('dashReady').style.width =
      (1 - Math.min(1, matchModule.player.dashCooldown / 0.48)) * 100 + '%';
    document.getElementById('combatReadout').textContent =
      matchModule.game.difficulty === 'training'
        ? (matchModule.enemy.lastHitText || '练习') +
          ' · ' +
          matchModule.enemy.receivedCombo +
          ' 连击 · ' +
          matchModule.enemy.damageTotal.toFixed(1) +
          ' 伤害'
        : '';
    if (matchModule.game.difficulty === 'training') uiModule.el.timer.textContent = '∞';
  };
  uiModule.showCombo = function showCombo(n) {
    uiModule.el.combo.innerHTML =
      n + ' 连击 <small>' + Math.round(matchModule.game.comboDamage ?? 0) + ' 伤害</small>';
    uiModule.el.combo.classList.add('show');
  };
  return function initialize() {
    Object.assign(matchModule.game, {
      cameraImpulse: 0,
      comboDamage: 0,
      trainingDummy: 'idle',
    });
    combatModule.prepareCombatData();
    document.getElementById('trainingDummy').onchange = (e) => {
      matchModule.game.trainingDummy = e.target.value;
    };
    document.getElementById('moveGuideBtn').onclick = () => {
      trainingModule.refreshMoveTable();
      const panel = document.getElementById('moveGuide');
      panel.classList.toggle('show');
    };
    document.getElementById('guideClose').onclick = () =>
      document.getElementById('moveGuide').classList.remove('show');
    document.getElementById('resetPractice').onclick = () => {
      if (matchModule.game.difficulty === 'training') {
        matchModule.game.keepPair = true;
        matchModule.startFight();
        matchModule.game.ready = 0;
        matchModule.notify('练习重置', 0.5);
      }
    };
    addEventListener('keydown', (e) => {
      if (
        e.code === 'KeyT' &&
        !e.repeat &&
        matchModule.game.screen === 'fight' &&
        matchModule.game.difficulty === 'training'
      ) {
        matchModule.game.keepPair = true;
        matchModule.startFight();
        matchModule.game.ready = 0;
        matchModule.notify('练习重置', 0.5);
      }
    });
    if (location.search.includes('test=1')) {
      Object.assign(window.__db, {
        getFrameData() {
          return charactersModule.CHARACTERS.map((c) => ({
            name: c.name,
            moves: [...c.combos.light, ...c.combos.heavy].map((a) => ({
              id: a.id,
              startup: a.hitT,
              active: a.active,
              recovery: a.dur - a.hitT - a.active,
              level: a.level,
            })),
          }));
        },
        inputEdges: combatModule.inputEdges,
        step(dt, input = {}, enemyInput = {}) {
          matchModule.pendingHits = [];
          matchModule.player.update(dt, matchModule.enemy, input);
          matchModule.enemy.update(dt, matchModule.player, enemyInput);
          combatModule.resolveOverlap();
          combatModule.collectCombatHits();
          for (const h of matchModule.pendingHits) h.foe.takeHit(h.attacker, h.attack);
          matchModule.player.render(dt, 1);
          matchModule.enemy.render(dt, 1);
        },
        loop: combatModule.loop,
      });
    }
  };
}
