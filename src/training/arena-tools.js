import * as THREE from 'three';
export function register({
  ai: aiModule,
  animation: animationModule,
  characters: charactersModule,
  combat: combatModule,
  match: matchModule,
  render: renderModule,
  training: trainingModule,
  ui: uiModule,
  world: worldModule,
}) {
  let trainingToggle, ringLabel, capture;
  trainingModule.clearDebugBoxes = function clearDebugBoxes() {
    const group = new THREE.Group();
    for (const g of trainingModule.debugBoxes) group.add(g);
    worldModule.disposeGroup(group);
    trainingModule.debugBoxes.length = 0;
  };
  trainingModule.drawCombatBoxes = function drawCombatBoxes() {
    if (!matchModule.game.showBoxes || !matchModule.player || !matchModule.enemy) {
      for (const m of trainingModule.debugBoxes) m.visible = false;
      return;
    }
    if (!trainingModule.debugBoxes.length) {
      const sphere = new THREE.SphereGeometry(1, 10, 6),
        cylinder = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
      for (let i = 0; i < 18; i++) {
        const g = new THREE.Group(),
          mat = new THREE.MeshBasicMaterial({
            color: i % 9 < 6 ? 0x6ef8ff : i % 9 < 8 ? 0xff6257 : 0xffdc65,
            wireframe: true,
            depthTest: false,
            transparent: true,
            opacity: 0.6,
          });
        for (const geo of [sphere, sphere, cylinder]) {
          const m = new THREE.Mesh(geo, mat);
          m.renderOrder = 90;
          g.add(m);
        }
        trainingModule.debugBoxes.push(g);
        renderModule.scene.add(g);
      }
    }
    let i = 0;
    for (const f of [matchModule.player, matchModule.enemy]) {
      const r = combatModule.sampleCombatRig(f);
      for (const c of [...r.hurt, ...r.hit, r.push]) {
        const g = trainingModule.debugBoxes[i++],
          active =
            f.attack &&
            f.stateTimer >= f.attack.hitT &&
            f.stateTimer < f.attack.hitT + f.attack.active;
        g.visible = c.enabled && ((i % 9 !== 7 && i % 9 !== 8) || active);
        const [one, two, tube] = g.children;
        one.position.copy(c.a);
        two.position.copy(c.b);
        one.scale.setScalar(c.r);
        two.scale.setScalar(c.r);
        tube.position.copy(c.a).add(c.b).multiplyScalar(0.5);
        combatModule.moveFront.subVectors(c.b, c.a);
        const len = combatModule.moveFront.length();
        tube.visible = len > 1e-6;
        tube.scale.set(c.r, len, c.r);
        tube.quaternion.setFromUnitVectors(
          combatModule.moveRight.set(0, 1, 0),
          len > 1e-6
            ? combatModule.moveFront.divideScalar(len)
            : combatModule.moveFront.set(0, 1, 0),
        );
      }
    }
  };
  trainingModule.discIntersects = function discIntersects(d, foe) {
    const body = combatModule.sampleCombatRig(foe),
      sideX = -d.direction.z,
      sideZ = d.direction.x;
    // Five thin swept strips approximate the visible horizontal disc, rather
    // than a large sphere which could hit a fighter above or below the blade.
    for (let lane = -2; lane <= 2; lane++) {
      const offset = lane * 0.25;
      combatModule.sweptCapsule.a.copy(d.previous).add(foe.pos).sub(foe.previousPos);
      combatModule.sweptCapsule.b.copy(d.pos);
      combatModule.sweptCapsule.a.x += sideX * offset;
      combatModule.sweptCapsule.a.z += sideZ * offset;
      combatModule.sweptCapsule.b.x += sideX * offset;
      combatModule.sweptCapsule.b.z += sideZ * offset;
      combatModule.sweptCapsule.r = 0.065;
      for (const h of body.hurt)
        if (
          h.enabled &&
          combatModule.capsuleDistanceSq(combatModule.sweptCapsule, h) <=
            (combatModule.sweptCapsule.r + h.r) ** 2
        )
          return true;
    }
    return false;
  };
  trainingModule.preciseFrames = function preciseFrames(a) {
    return (
      '精确换算（60FPS）：' +
      [a.startup, a.active, a.recovery].map((t) => Number((t * 60).toFixed(2))).join(' / ') +
      ' 帧'
    );
  };
  trainingModule.refreshMoveTable = function refreshMoveTable() {
    const c =
        uiModule.guideCharacter ??
        matchModule.player?.def ??
        charactersModule.CHARACTERS[matchModule.game.selectedChar],
      special = combatModule.SPECIAL_MOVES[c.id],
      m = c.youth
        ? charactersModule.characterMoveData(c)
        : [
            ...c.combos.light,
            ...c.combos.heavy,
            combatModule.finalizeMove({
              id: special.name,
              level: 'mid',
              ...special,
              anim: animationModule.ANIM[special.motion],
            }),
          ];
    let html =
      '<h3>' +
      c.name +
      ' · ' +
      c.role +
      '</h3><p class="frameLegend">单位：帧（60 帧/秒） · 前 / 有 / 后 = 起手 / 判定 / 收招</p><div class="tableScroll"><table class="frameTable"><tr><th>招式</th><th>前 / 有 / 后</th><th>伤害</th><th>段位</th><th>命中 / 格挡优势</th><th>耗防御</th><th>被防后衔接</th></tr>';
    for (const a of m) {
      const rec = Math.round(a.recovery * 60);
      html +=
        '<tr title="' +
        trainingModule.preciseFrames(a) +
        '"><td>' +
        (a.name ??
          (/^l[1-4]$/.test(a.id)
            ? '轻击 ' + a.id.slice(1)
            : /^h[1-4]$/.test(a.id)
              ? '重击 ' + a.id.slice(1)
              : a.id)) +
        '</td><td>' +
        Math.round(a.startup * 60) +
        ' / ' +
        Math.round(a.active * 60) +
        ' / ' +
        rec +
        '</td><td>' +
        (a.damageLabel ?? a.dmg) +
        '</td><td>' +
        {
          high: '高',
          mid: '中',
          low: '下',
          overhead: '上',
        }[a.level] +
        '</td><td>' +
        Math.round((a.stun - a.active - a.recovery) * 60) +
        ' / ' +
        Math.round((a.blockstun - a.active - a.recovery) * 60) +
        '</td><td>' +
        (a.guardDamage ?? '—') +
        '</td><td>' +
        ((a.cancelRules?.block ?? [])
          .map(
            (type) =>
              ({ light: '轻击', heavy: '重击', special: '技能', ult: '必杀' })[type] ?? type,
          )
          .join(' / ') || '等收招') +
        '</td></tr>';
    }
    html +=
      '</table></div><details><summary>帧数与招式规则</summary><p>帧数为整数近似，悬停查看精确值。优势按首个有效帧计算，晚命中会改变优势；特殊技有效时间含段间间隔。</p><p>普通攻击命中后最早6帧衔接，按角色与招式区分被防后选择；被防衔接有可防守空隙，空挥需完整收招。按住格挡会清除积压的普通攻击。</p></details>';
    trainingModule.table.innerHTML = html;
  };
  trainingModule.updateTrainingHUD = function updateTrainingHUD() {
    const active =
      matchModule.game.screen === 'fight' && matchModule.game.difficulty === 'training';
    trainingModule.trainingPanel.hidden = !active || !matchModule.game.trainingUiOpen;
    document.getElementById('trainingToggle').hidden = !active;
    document.body.classList.toggle('training', active);
    if (!active || !matchModule.player || !matchModule.enemy) return;
    const a = matchModule.player.attack;
    document.getElementById('frameReadout').title = a ? trainingModule.preciseFrames(a) : '';
    document.getElementById('frameReadout').textContent =
      '当前招式：' +
      (a
        ? (a.name ??
            (/^l[1-4]$/.test(a.id)
              ? '轻击 ' + a.id.slice(1)
              : /^h[1-4]$/.test(a.id)
                ? '重击 ' + a.id.slice(1)
                : a.id)) +
          ' ' +
          Math.round(a.startup * 60) +
          ' / ' +
          Math.round(a.active * 60) +
          ' / ' +
          Math.round(a.recovery * 60) +
          ' F'
        : '空闲') +
      '\n上次接触：' +
      matchModule.enemy.lastHitText +
      ' · 优势 ' +
      (matchModule.enemy.lastAdvantage ?? 0) +
      ' F\n' +
      matchModule.enemy.receivedCombo +
      ' 连击 / ' +
      matchModule.enemy.damageTotal.toFixed(1) +
      ' 伤害 / 递减 ' +
      Math.round((matchModule.enemy.lastScaling ?? 1) * 100) +
      '%';
    document.getElementById('inputHistory').textContent = (matchModule.game.inputHistory ?? [])
      .map((x) => x.frame + 'F ' + x.action)
      .join('  ');
  };
  trainingModule.updateRoundRules = function updateRoundRules(dt) {
    if (
      matchModule.game.difficulty === 'training' ||
      matchModule.game.over ||
      !matchModule.game.ringOut ||
      matchModule.game.selectedMap !== 0
    )
      return;
    for (const f of [matchModule.player, matchModule.enemy]) {
      const outside = Math.abs(f.pos.x) > 14 || Math.abs(f.pos.z) > 7;
      f.outsideTime = outside ? (f.outsideTime ?? 0) + dt : 0;
    }
    const out = (f) => f.outsideTime > (f.pos.y > 0.15 ? 1.1 : 0.15);
    if (out(matchModule.player) || out(matchModule.enemy)) {
      matchModule.game.ringWinner = out(matchModule.player)
        ? out(matchModule.enemy)
          ? 'draw'
          : 'enemy'
        : 'player';
      matchModule.endGame('RING OUT');
    }
  };
  trainingModule.senzuHint = function senzuHint(f, s) {
    if (matchModule.game.matchRule === 'competitive') return '关闭';
    let best = null,
      distance = Infinity;
    for (const b of worldModule.currentMap?.senzus ?? []) {
      if (!b.active) continue;
      const d = Math.hypot(b.x - f.pos.x, b.z - f.pos.z);
      if (d < distance) {
        distance = d;
        best = b;
      }
    }
    if (!best)
      return worldModule.currentMap?.senzuSpawnCount >= worldModule.SENZU_RULES.maxSpawns
        ? '本回合结束'
        : '待刷新';
    const dx = best.x - f.pos.x,
      dz = best.z - f.pos.z,
      yaw = trainingModule.movementYaw(f === matchModule.enemy ? 1 : 0),
      front = dx * Math.sin(yaw) + dz * Math.cos(yaw),
      side = -dx * Math.cos(yaw) + dz * Math.sin(yaw),
      index = (Math.round(Math.atan2(side, front) / (Math.PI / 4)) + 8) % 8;
    return ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'][index] + ' ' + distance.toFixed(1) + 'm';
  };
  trainingModule.movementYaw = function movementYaw(index = 0) {
    const s = renderModule.shoulderStates[index],
      f = index ? matchModule.enemy : matchModule.player;
    if (s?.initialized) {
      const dx = s.target.x - s.position.x,
        dz = s.target.z - s.position.z;
      if (dx * dx + dz * dz > 0.0001) return Math.atan2(dx, dz);
    }
    return f?.facingAngle ?? 0;
  };
  return function initialize() {
    trainingModule.debugBoxes = [];
    Object.assign(matchModule.game, {
      wins: [0, 0],
      matchRound: 1,
      keepPair: false,
      matchFinished: false,
      ringOut: false,
      showBoxes: false,
      infiniteKi: false,
      simTime: 0,
    });
    trainingModule.trainingPanel = document.createElement('div');
    trainingModule.trainingPanel.id = 'trainingPanel';
    trainingModule.trainingPanel.hidden = true;
    trainingModule.trainingPanel.innerHTML = `<h3>练习工具</h3><label>陪练 <select id="dummyLive"><option value="idle">站立</option><option value="guard">站立格挡</option><option value="lowguard">下段格挡</option><option value="after">受击后自动格挡</option><option value="random">随机上下段格挡</option><option value="tech">自动拆投</option><option value="throws">投技拆解练习</option></select></label><label><input type="checkbox" id="kiToggle"> 无限能量</label><div class="trainingActions"><button id="liveReset" class="smallBtn">重置位置与资源 · T</button><button id="liveGuide" class="smallBtn">招式数据</button></div><details id="trainingAdvanced"><summary>高级数据与判定</summary><label><input type="checkbox" id="boxesToggle"> 显示判定 · B</label><p class="boxLegend">红：攻击 · 蓝：受击 · 黄：占位</p><div id="frameReadout"></div><div id="inputHistory"></div></details>`;
    document.body.appendChild(trainingModule.trainingPanel);
    matchModule.game.trainingUiOpen = !matchMedia('(pointer:coarse)').matches;
    trainingToggle = document.createElement('button');
    trainingToggle.id = 'trainingToggle';
    trainingToggle.className = 'smallBtn';
    trainingToggle.textContent = '练习工具';
    trainingToggle.hidden = true;
    trainingToggle.onclick = () =>
      (matchModule.game.trainingUiOpen = !matchModule.game.trainingUiOpen);
    document.getElementById('fightbar').appendChild(trainingToggle);
    for (const id of ['roundScore', 'specialState']) {
      const node = document.createElement('div');
      node.id = id;
      (id === 'specialState'
        ? document.querySelector('.actionReadout')
        : document.getElementById('hud')
      ).appendChild(node);
    }
    ringLabel = document.createElement('label');
    ringLabel.innerHTML =
      '<input type="checkbox" id="ringOption"> 出界判负 <span class="settingHint">仅武道会擂台</span>';
    document.querySelector('.settingsContent').appendChild(ringLabel);
    document.getElementById('ringOption').onchange = (e) =>
      (matchModule.game.ringOut = e.target.checked);
    for (const select of [document.getElementById('trainingDummy')])
      for (const [v, t] of [
        ['after', '受击后自动防御'],
        ['random', '随机上下段'],
        ['tech', '自动拆投'],
        ['throws', '投技练习'],
      ]) {
        const op = document.createElement('option');
        op.value = v;
        op.textContent = t;
        select.appendChild(op);
      }
    document.getElementById('dummyLive').onchange = (e) => {
      matchModule.game.trainingDummy = e.target.value;
      document.getElementById('trainingDummy').value = e.target.value;
    };
    document.getElementById('boxesToggle').onchange = (e) =>
      (matchModule.game.showBoxes = e.target.checked);
    document.getElementById('kiToggle').onchange = (e) =>
      (matchModule.game.infiniteKi = e.target.checked);
    document.getElementById('liveReset').onclick = () => {
      matchModule.game.keepPair = true;
      matchModule.startFight();
      matchModule.game.ready = 0;
    };
    document.getElementById('liveGuide').onclick = () => {
      trainingModule.refreshMoveTable();
      document.getElementById('moveGuide').classList.add('show');
    };
    trainingModule.table = document.createElement('section');
    trainingModule.table.id = 'characterMoves';
    trainingModule.table.hidden = true;
    trainingModule.table.setAttribute('role', 'tabpanel');
    trainingModule.table.setAttribute('aria-labelledby', 'framesTab');
    document.querySelector('.guideContent').appendChild(trainingModule.table);
    addEventListener('keydown', (e) => {
      if (e.code === 'KeyB' && !e.repeat && matchModule.game.screen === 'fight') {
        matchModule.game.showBoxes = !matchModule.game.showBoxes;
        document.getElementById('boxesToggle').checked = matchModule.game.showBoxes;
      }
      if (
        ['KeyR', 'NumpadAdd'].includes(e.code) &&
        !e.repeat &&
        matchModule.game.screen === 'fight' &&
        !matchModule.game.paused
      ) {
        matchModule.game.inputHistory ??= [];
      }
    });
    capture = combatModule.Fighter.prototype.captureInput;
    combatModule.Fighter.prototype.captureInput = function (input) {
      capture.call(this, input);
      if (this === matchModule.player && input.actions?.length) {
        matchModule.game.inputHistory ??= [];
        for (const a of input.actions)
          matchModule.game.inputHistory.push({
            frame: Math.round(matchModule.game.simTime * 60),
            action: typeof a === 'string' ? a : a.type,
          });
        if (matchModule.game.inputHistory.length > 12)
          matchModule.game.inputHistory.splice(0, matchModule.game.inputHistory.length - 12);
      }
    };
    queueMicrotask(() => {
      trainingModule.refreshMoveTable();
      if (location.search.includes('test=1'))
        Object.assign(window.__db, {
          startFight: matchModule.startFight,
          aiThink: aiModule.aiThink,
          setCombatSeed: aiModule.setCombatSeed,
          collectCombatHits: combatModule.collectCombatHits,
          combatIntersects: combatModule.combatIntersects,
          sampleCombatRig: combatModule.sampleCombatRig,
          roundWinner: matchModule.roundWinner,
          endGame: matchModule.endGame,
          updateRoundRules: trainingModule.updateRoundRules,
          validSenzuPosition: worldModule.validSenzuPosition,
          SENZU_RULES: worldModule.SENZU_RULES,
          placeSenzu: worldModule.placeSenzu,
          finalizeMove: combatModule.finalizeMove,
          legalCancel: combatModule.legalCancel,
          updateTrainingHUD: trainingModule.updateTrainingHUD,
          refreshMoveTable: trainingModule.refreshMoveTable,
        });
    });
  };
}
