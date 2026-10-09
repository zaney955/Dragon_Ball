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
  let v1Portrait,
    v1SpecialAvailability,
    v1Selection,
    v1ExtraHUD,
    v1ViewHUD,
    v1Table,
    goalBox,
    v1ProcessDrill,
    v2RemoveBase;
  function abilityStatus(f) {
    const v = f.v2,
      id = f.def.id;
    if (id === 'chichi') return v.bladeOut ? '飞刃：离手 · 等待回收' : '飞刃：可投掷';
    if (id === 'bulma')
      return (
        '装置 ' +
        combatModule.v2Devices
          .filter((d) => d.owner === f)
          .map((d) => d.kind + ' ' + Math.ceil(d.hp) + '耐久/' + d.life.toFixed(1) + 's')
          .join(' · ') +
        '（' +
        combatModule.v2Devices.filter((d) => d.owner === f).length +
        '/2）'
      );
    if (id === 'chiaotzu')
      return (
        '念力冷却 ' +
        v.cooldown.toFixed(1) +
        's · 控制 ' +
        v.controlTime.toFixed(2) +
        's · 保护 ' +
        v.controlGrace.toFixed(1) +
        's'
      );
    if (id === 'oolong')
      return (
        {
          pig: '乌龙',
          bull: '巨牛',
          bat: '蝙蝠',
          robot: '机器人',
        }[v.form] +
        ' ' +
        v.formTime.toFixed(1) +
        's · 恢复 ' +
        v.formCooldown.toFixed(1) +
        's'
      );
    if (id === 'korin')
      return (
        '直觉 ' +
        v.intuition.toFixed(1) +
        's · 仙豆 ' +
        v.heals +
        '/1 · 残像步 ' +
        v.cooldown.toFixed(1) +
        's'
      );
    if (id === 'pilaf')
      return (
        '机甲耐久 ' +
        Math.ceil(f.hp) +
        '/' +
        f.maxHp +
        ' · ' +
        (v.mode === 'flame' ? '喷火' : '导弹') +
        ' ' +
        v.modeTime.toFixed(1) +
        's · 武装CD ' +
        v.cooldown.toFixed(1) +
        's'
      );
    if (id === 'gyumao')
      return '巨斧 · ' + (aiModule.armorWindow(f) ? '一次承伤窗口' : '可用下段/投技反制');
    return f.def.tactics.mechanic;
  }
  return function initialize() {
    v1Portrait = uiModule.portrait;
    uiModule.portrait = function (def) {
      if (!charactersModule.V2_NEW_DEFS.some((c) => c.id === def.id)) return v1Portrait(def);
      const r = uiModule.portraitRenderer,
        sc = new THREE.Scene();
      sc.background = new THREE.Color(0xefe0be);
      sc.add(new THREE.HemisphereLight(0xfff4da, 0x7a7968, 1.4));
      const light = new THREE.DirectionalLight(0xffedcc, 2.2);
      light.position.set(-3, 5, 7);
      sc.add(light);
      const b = def.buildBody();
      b.root.rotation.y = -0.32;
      charactersModule.applyPose(
        b.parts,
        animationModule.pz({
          aR: [-0.3, 0, 0.1],
          aL: [-0.3, 0, -0.1],
        }),
        0,
        true,
      );
      if (b.parts.axe) b.parts.axe.rotation.z = Math.PI;
      b.root.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(b.root),
        size = bounds.getSize(new THREE.Vector3()),
        center = bounds.getCenter(new THREE.Vector3()),
        c = new THREE.PerspectiveCamera(33, 1, 0.05, 40);
      const dist = Math.max(size.y, size.x) * 1.85;
      c.position.set(center.x, center.y, dist);
      c.lookAt(center);
      sc.add(b.root);
      r.render(sc, c);
      const url = r.domElement.toDataURL();
      worldModule.disposeGroup(b.root);
      return url;
    };
    for (const c of charactersModule.CHARACTERS.slice(7)) {
      const op = document.createElement('option');
      op.value = 'character:' + charactersModule.CHARACTERS.indexOf(c);
      op.textContent = c.name;
      uiModule.assetSelect.querySelector('optgroup').appendChild(op);
    }
    v1SpecialAvailability = uiModule.specialAvailability;
    uiModule.specialAvailability = function (f) {
      if (!f.anatomy) return v1SpecialAvailability(f);
      const v = f.v2,
        name = combatModule.SPECIAL_MOVES[f.def.id].name,
        cost = 30;
      const reason =
        v.bladeOut && f.def.id === 'chichi'
          ? '飞刃回收中'
          : v.formCooldown > 0 && f.def.id === 'oolong'
            ? '变身恢复 ' + v.formCooldown.toFixed(1) + 's'
            : v.cooldown > 0
              ? '冷却 ' + v.cooldown.toFixed(1) + 's'
              : f.ki < cost
                ? '资源不足'
                : f.attack ||
                    [
                      'hit',
                      'blockstun',
                      'landing',
                      'block',
                      'knockdown',
                      'grabbed',
                      'dead',
                    ].includes(f.state)
                  ? '等待行动恢复'
                  : '可发动';
      return name + ' · ' + cost + ' ' + f.def.resource + ' · ' + reason;
    };
    v1Selection = uiModule.updateSelection;
    uiModule.updateSelection = function () {
      v1Selection();
      const i =
          matchModule.game.selectionPlayer === 2
            ? Math.max(0, matchModule.game.opponent)
            : matchModule.game.selectedChar,
        c = charactersModule.CHARACTERS[i];
      document.getElementById('heroTitle').textContent = c.role;
      document.getElementById('heroUlt').textContent =
        'R ' + combatModule.SPECIAL_MOVES[c.id].name + ' / U ' + c.ultName;
      let n = document.getElementById('heroTactics');
      if (!n) {
        n = document.createElement('p');
        n.id = 'heroTactics';
        document.querySelector('.heroPanel').appendChild(n);
      }
      n.textContent = c.tactics.mechanic + '\n' + c.tactics.weak;
    };
    v1ExtraHUD = uiModule.updateExtraHUD;
    v1ViewHUD = renderModule.updateViewHUD;
    uiModule.updateExtraHUD = function () {
      v1ExtraHUD();
      if (!matchModule.player || !matchModule.enemy) return;
      for (const [f, id] of [
        [matchModule.player, 'p1'],
        [matchModule.enemy, 'p2'],
      ]) {
        let n = document.getElementById(id + 'Ability');
        if (!n) {
          n = document.createElement('div');
          n.id = id + 'Ability';
          n.className = 'v2Ability';
          document.getElementById(id + 'value').parentElement.parentElement.appendChild(n);
        }
        n.textContent = abilityStatus(f);
        document.getElementById(id + 'value').textContent =
          Math.ceil(f.hp) +
          ' / ' +
          f.maxHp +
          ' · ' +
          f.def.resource +
          ' ' +
          Math.floor(f.ki) +
          ' / 100';
      }
      if (matchModule.game.difficulty === 'training') {
        let n = document.getElementById('v2TrainingState');
        if (!n) {
          n = document.createElement('p');
          n.id = 'v2TrainingState';
          trainingModule.trainingPanel.appendChild(n);
        }
        n.textContent =
          abilityStatus(matchModule.player) + '\n对方 ' + abilityStatus(matchModule.enemy);
      }
    };
    renderModule.updateViewHUD = function (split) {
      v1ViewHUD(split);
      if (split && matchModule.player && matchModule.enemy)
        for (const [f, id] of [
          [matchModule.player, 'view1Stats'],
          [matchModule.enemy, 'view2Stats'],
        ])
          document.getElementById(id).textContent += '\n' + abilityStatus(f);
    };
    v1Table = trainingModule.refreshMoveTable;
    trainingModule.refreshMoveTable = function () {
      v1Table();
      const c =
          matchModule.player?.def ?? charactersModule.CHARACTERS[matchModule.game.selectedChar],
        t = c.tactics;
      if (!t) return;
      const details = document.createElement('div');
      details.className = 'v2MoveNotes';
      details.innerHTML =
        '<h4>专属体系 · ' +
        c.name +
        '</h4><p>' +
        t.mechanic +
        '</p><p>基础：' +
        t.basic +
        '</p><p>资源：' +
        t.resource +
        '</p><p>反制：' +
        t.weak +
        '</p><p>W+K 反空 · S+K 下段 · O 投技/拆投。F 在有科技或念力的角色上使用对应装备；其他新增角色保留此键但没有虚构气功。</p>';
      trainingModule.table.appendChild(details);
      if (c.ult) {
        const a = combatModule.finalizeMove({
            ...c.ult,
            stun: c.ult.stun ?? 0.4,
            blockstun: 0.13,
          }),
          row = document.createElement('tr');
        row.innerHTML =
          '<td>' +
          c.ultName +
          ' · 100 ' +
          c.resource +
          '</td><td>' +
          [a.startup, a.active, a.recovery].map((x) => Math.round(x * 60)).join(' / ') +
          '</td><td>' +
          a.dmg +
          (a.hits ? ' × ' + a.hits.length : '') +
          '</td><td>中</td><td>' +
          Math.round((a.stun - a.active - a.recovery) * 60) +
          ' / ' +
          Math.round((a.blockstun - a.active - a.recovery) * 60) +
          '</td>';
        const body = trainingModule.table.querySelector('tbody');
        body.insertBefore(row, body.lastElementChild);
      }
    };
    addEventListener('keydown', (e) => {
      if (
        matchModule.game.screen !== 'menu' ||
        matchModule.game.menuPage !== 'select' ||
        !e.target.classList.contains('char-card')
      )
        return;
      const cards = [...document.querySelectorAll('.char-card')],
        i = cards.indexOf(e.target),
        cols = innerWidth < 500 ? 3 : innerWidth < 900 ? 4 : 7;
      const delta =
        e.key === 'ArrowRight'
          ? 1
          : e.key === 'ArrowLeft'
            ? -1
            : e.key === 'ArrowDown'
              ? cols
              : e.key === 'ArrowUp'
                ? -cols
                : 0;
      if (delta) {
        e.preventDefault();
        const j = (i + delta + cards.length) % cards.length;
        cards[j].focus();
        cards[j].scrollIntoView({
          block: 'nearest',
        });
      }
    });
    uiModule.v2Goal = null;
    goalBox = document.createElement('div');
    goalBox.innerHTML =
      '<button id="v2GoalStart" class="smallBtn">角色机制练习</button><p id="v2Goal"></p>';
    trainingModule.trainingPanel.appendChild(goalBox);
    document.getElementById('v2GoalStart').onclick = () => {
      if (matchModule.game.difficulty !== 'training') return;
      matchModule.game.keepPair = true;
      matchModule.startFight();
      matchModule.game.ready = 0;
      matchModule.player.ki = 100;
      matchModule.player.hp = matchModule.player.maxHp * 0.6;
      matchModule.player.pos.set(0, 0, 0);
      matchModule.enemy.pos.set(
        ['bulma', 'chiaotzu', 'chichi', 'pilaf'].includes(matchModule.player.def.id) ? 2 : 1,
        0,
        0,
      );
      matchModule.player.previousPos.copy(matchModule.player.pos);
      matchModule.enemy.previousPos.copy(matchModule.enemy.pos);
      uiModule.v2Goal = {
        character: matchModule.player.def.id,
        time: 0,
        success: false,
        event: {
          goku: 'contact',
          roshi: 'parry',
          taopaipai: 'contact',
          piccolo: 'contact',
          tien: 'contact',
          krillin: 'contact',
          yamcha: 'contact',
          gyumao: 'contact',
          chichi: 'bladeReturn',
          bulma: 'deploy',
          chiaotzu: 'control',
          oolong: 'ability',
          korin: 'selfHeal',
          pilaf: 'ability',
        }[matchModule.player.def.id],
      };
      document.getElementById('v2Goal').textContent =
        '目标：' + matchModule.player.def.tactics.resource + '；仅真实战斗事件计分。';
    };
    v1ProcessDrill = trainingModule.processDrillEvent;
    trainingModule.processDrillEvent = function (e) {
      v1ProcessDrill(e);
      if (
        !uiModule.v2Goal ||
        uiModule.v2Goal.success ||
        matchModule.game.difficulty !== 'training' ||
        e.character !== uiModule.v2Goal.character
      )
        return;
      if (
        e.type === uiModule.v2Goal.event &&
        (e.type !== 'contact' ||
          (e.move === combatModule.SPECIAL_MOVES[e.character].name && !e.blocked))
      ) {
        uiModule.v2Goal.success = true;
        document.getElementById('v2Goal').textContent =
          '成功：真实 ' + e.type + ' 事件 · ' + matchModule.game.simTime.toFixed(2) + 's';
      }
    };
    v2RemoveBase = combatModule.removeAbility;
    combatModule.removeAbility = function (list, item) {
      if (item.kind === 'blade' && item.returning && item.life > 0)
        combatModule.emitCombatEvent('bladeReturn', item.owner, null, item.attack);
      v2RemoveBase(list, item);
    };
    queueMicrotask(() => {
      if (window.__db)
        Object.assign(window.__db, {
          V2_TACTICS: aiModule.V2_TACTICS,
          abilityStatus,
          aiThink: aiModule.aiThink,
          specialAvailability: uiModule.specialAvailability,
          updateSelection: uiModule.updateSelection,
          refreshMoveTable: trainingModule.refreshMoveTable,
          combatPose: combatModule.combatPose,
          neutralCombatPose: combatModule.neutralCombatPose,
          sampleCombatRig: combatModule.sampleCombatRig,
          combatIntersects: combatModule.combatIntersects,
          resolveOverlap: combatModule.resolveOverlap,
          endGame: matchModule.endGame,
          flightPhysics: combatModule.flightPhysics,
        });
    });
    // Full model ghosts share no disposable geometry with the live character.
  };
}
