export function register({
  characters: charactersModule,
  combat: combatModule,
  match: matchModule,
  training: trainingModule,
  ui: uiModule,
}) {
  uiModule.fighterStatus = function fighterStatus(f) {
    if (!f) return '';
    if (matchModule.game.over) return matchModule.game.endReason || '回合结束';
    if (matchModule.game.paused) return '已暂停';
    if (matchModule.game.ready > 0) return '准备';
    if (f.attack) {
      if (f.attack.isKiBlast)
        return (
          f.attack.name +
          ' · ' +
          f.attack.kiCost +
          ' 气 · ' +
          (f.attack.costCommitted ? '已发射' : '准备发射')
        );
      if (f.attack.id === 'special') return f.attack.name + ' · ' + f.attack.kiCost + ' 气';
      if (f.attack.isUlt) return f.def.ultName + ' · 满气必杀';
      if (f.attack.isThrow) return '投技';
      if (f.attack.id === 'launcher') return '挑空';
      if (f.attack.id === 'sweep') return '下段扫腿';
      return '连招 ' + (f.comboIdx + 1);
    }
    if (f.state === 'charge')
      return f.ki >= 100
        ? '气力充满 · U 必杀'
        : (f.chargeHeld ?? 0) < combatModule.KI_RULES.chargeStartup
          ? '聚气起势'
          : '聚气 · +15 气 / 秒';
    if (f.state === 'blastCharge') {
      const q = combatModule.kiBlastPower(f.blastHeldTime ?? 0, f.ki);
      return q.charged ? '蓄力气弹 · ' + q.cost + ' 气 · 松开发射' : '气弹 · 5 气 · 松开发射';
    }
    return (
      {
        charge: '聚气',
        block: f.crouching ? '下段防御' : '站立防御',
        blockstun: '格挡硬直',
        dash: f.dashKind === 'pursuit' ? '追击' : '闪身',
        hit: '受击 · Q 脱身 / L+Shift 解围',
        guardbreak: '破防',
        knockdown: '倒地',
        landing: '落地恢复',
        grabbed: '被投 · O 拆投',
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
    const reason = f.ki < 30 ? '气力不足' : usable ? '可发动' : '等待行动恢复';
    return name + ' · 30 气 · ' + reason;
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
        Math.ceil(f.hp) + ' / ' + f.maxHp + ' · 气 ' + Math.floor(f.ki) + ' / 100';
      document.getElementById(prefix + 'guard').style.width = f.guard + '%';
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
      n + ' HIT <small>' + Math.round(matchModule.game.comboDamage ?? 0) + ' DAMAGE</small>';
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
