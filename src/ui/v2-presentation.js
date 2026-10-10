import * as THREE from 'three';
import {
  CHARACTER_HELP,
  INPUT_LABELS,
  actionAvailability,
  inputCopy,
  jumpAction,
  remoteAction,
  skillCost,
  skillReason,
} from './character-help.js';
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
  let v1Portrait, v1Selection, v1ExtraHUD, v1ViewHUD, v1ProcessDrill, v2RemoveBase;
  const el = (id) => document.getElementById(id);
  const setText = (node, value) => {
    if (node.textContent !== value) node.textContent = value;
  };
  function abilityStatus(f) {
    const y = f.youth;
    if (!y) return '';
    const forms = {
      ape: '大猩猩',
      muscle: '肌肉强化',
      fourArms: '四妖拳',
      ogre: '巨鬼',
      bat: '蝙蝠',
      armor: '装甲',
      combined: '三机合体',
    };
    return [
      y.form
        ? `${forms[y.form]} ${y.formTime.toFixed(1)}秒${f.def.id === 'oolong' ? ' · 再按对应技能恢复' : ''}`
        : '',
      f.def.id === 'korin' ? `仙豆 ${y.heals}/1` : '',
      f.def.id === 'pilaf'
        ? `武装：${remoteAction(f.def.id, y.weapon).name}${y.form === 'armor' ? (y.armorSpent ? ' · 保护已用' : ' · 保护剩余1次') : ''}`
        : '',
      f.v2?.bladeOut ? '飞刃回收中' : '',
      y.reversedTime > 0 ? `方向反向 ${y.reversedTime.toFixed(1)}秒` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }
  function actionRows(f, keys = INPUT_LABELS.one) {
    const g = matchModule.game,
      r = remoteAction(f.def.id, f.youth?.weapon);
    return [
      {
        key: keys.remote,
        name: r.name,
        cost: r.cost,
        reason: actionAvailability(f, r.cost, g, r.range ? '' : '没有远程攻击'),
      },
      ...f.def.skills.map((s, i) => {
        const info = combatModule.skillAvailability(f, i);
        return {
          key: i ? keys.secondary : keys.primary,
          name: info.reverting
            ? '恢复本体'
            : f.def.id === 'yamcha' && i === 0 && f.youth.wolfUntil > g.simTime
              ? '追加终掌'
              : s.name,
          cost:
            info.reverting || (f.def.id === 'yamcha' && i === 0 && f.youth.wolfUntil > g.simTime)
              ? 0
              : info.cost,
          reason: g.over
            ? '回合结束'
            : g.paused
              ? '已暂停'
              : g.ready > 0
                ? '开场准备'
                : f.def.id === 'yamcha' && i === 0 && f.youth.wolfUntil > g.simTime
                  ? f.attack?.ability === 'wolf'
                    ? '就绪'
                    : actionAvailability(f, 0, g)
                  : skillReason(info, f),
        };
      }),
      { key: keys.ultimate, name: f.def.ultName, cost: 100, reason: actionAvailability(f, 100, g) },
    ];
  }
  function completeStep() {
    const goal = uiModule.v2Goal;
    if (!goal || goal.success) return;
    goal.step++;
    goal.success = goal.step >= CHARACTER_HELP[goal.character].drill.length;
    if (goal.success) matchModule.notify('角色练习完成 · 可以重试或自由练习', 1.2);
  }
  function updateMechanicPractice() {
    const goal = uiModule.v2Goal,
      f = matchModule.player;
    if (!goal || !f || f.def.id !== goal.character || matchModule.game.difficulty !== 'training') {
      el('v2Goal').textContent = '按步骤练习当前角色；完成实际操作后才进入下一步。';
      return;
    }
    const steps = CHARACTER_HELP[goal.character].drill;
    if (!goal.success && !matchModule.game.paused && !matchModule.game.over) {
      const condition = steps[goal.step][1];
      if (condition === 'bladeReturn' && f.v2.bladeOut) goal.bladeStarted = true;
      if (
        (condition === 'bladeReturn' && goal.bladeStarted && !f.v2.bladeOut) ||
        condition === f.youth.form ||
        (condition === 'normal' && !f.youth.form) ||
        (condition === 'flameMode' && f.youth.weapon === 'flame') ||
        (condition === 'floatRetreat' && f.youth.floatTime > 0) ||
        (['cover', 'smoke', 'demon'].includes(condition) &&
          combatModule.youthEntities.some(
            (e) => e.owner === f && e.kind === condition && e.life > 0,
          ))
      )
        completeStep();
    }
    const touch = matchMedia('(pointer: coarse), (max-width: 600px)').matches;
    const describe = (value) =>
      touch
        ? value
            .replaceAll('S + R', f.def.skills[1].name)
            .replace(/\bR\b/g, f.def.skills[0].name)
            .replace(/\bF\b/g, remoteAction(f.def.id, f.youth.weapon).name)
            .replace(/\bI\b/g, '聚气')
            .replace(/\bJ\b/g, '轻击')
            .replace(/\bK\b/g, '重击')
        : value;
    const defenseStep = steps[goal.step]?.[1];
    const warning = ['counter', 'dodgeCounter'].includes(defenseStep)
      ? `\n对手将在${Math.ceil(Math.max(0, 1.5 - goal.time))}秒后轻击；提前少许发动反击技能。`
      : '';
    const text = goal.success
      ? `已完成 ${steps.length}/${steps.length} 步 · 可以重试或继续自由练习。`
      : `第 ${goal.step + 1}/${steps.length} 步：${describe(steps[goal.step][0])}${warning}\n能量不足时按住${touch ? '聚气' : 'I'}；可查看操作指南。`;
    setText(el('v2Goal'), text);
    setText(el('v2GoalStart'), goal.success ? '重试角色练习' : '重新开始角色练习');
  }
  uiModule.startMechanicPractice = function startMechanicPractice() {
    if (matchModule.game.difficulty !== 'training' || matchModule.game.online) return;
    uiModule.v2Goal = null;
    trainingModule.drillSystem.current = null;
    matchModule.game.keepPair = false;
    matchModule.game.opponent = charactersModule.CHARACTERS.findIndex((c) => c.id === 'krillin');
    matchModule.startFight();
    matchModule.game.ready = 0;
    const f = matchModule.player,
      foe = matchModule.enemy;
    f.ki = 100;
    foe.ki = 100;
    f.hp = f.maxHp * (f.def.id === 'goku' ? 0.25 : 0.6);
    if (f.def.id === 'goku') {
      matchModule.game.lightPreset = 'moon';
      worldModule.daylight();
    }
    f.pos.set(-0.5, 0, 0);
    foe.pos.set(f.def.id === 'pilaf' || f.def.id === 'chichi' ? 1.5 : 0.5, 0, 0);
    f.previousPos.copy(f.pos);
    foe.previousPos.copy(foe.pos);
    f.facingAngle = Math.PI / 2;
    foe.facingAngle = -Math.PI / 2;
    renderModule.resetShoulderCameras();
    matchModule.game.trainingUiOpen = true;
    uiModule.v2Goal = {
      character: f.def.id,
      time: 0,
      step: 0,
      success: false,
      round: matchModule.game.round,
    };
    updateMechanicPractice();
  };
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
    uiModule.specialAvailability = (f) =>
      actionRows(f)
        .slice(1, 3)
        .map((a) => `${a.key} ${a.name} · ${a.cost} 能量 · ${a.reason}`)
        .join(' / ');
    v1Selection = uiModule.updateSelection;
    uiModule.updateSelection = function () {
      v1Selection();
      const index =
        matchModule.game.selectionPlayer === 2
          ? Math.max(0, matchModule.game.opponent)
          : matchModule.game.selectedChar;
      const c = charactersModule.CHARACTERS[index],
        h = CHARACTER_HELP[c.id];
      if (!c.skills) return;
      const k =
        matchModule.game.selectionPlayer === 2 && !matchModule.game.online
          ? INPUT_LABELS.two
          : matchMedia('(pointer: coarse), (max-width: 600px)').matches
            ? INPUT_LABELS.touch
            : INPUT_LABELS.one;
      el('heroTitle').textContent = c.role;
      el('heroSummary').textContent = inputCopy(h.tip, k);
      el('heroUlt').innerHTML =
        c.skills
          .map(
            (s, i) =>
              `<div><kbd>${i ? k.secondary : k.primary}</kbd><span>${s.name}<small>${skillCost(s)}</small></span></div>`,
          )
          .join('') +
        `<div><kbd>${k.ultimate}</kbd><span>${c.ultName}<small>100 能量</small></span></div>`;
      el('heroHP').textContent = c.hp * 2;
      el('lightingHint').textContent =
        c.id === 'goku'
          ? `悟空大猩猩需要满月夜；当前${{ moon: '满月夜', day: '晴日', sunset: '暖夕' }[matchModule.game.lightPreset]}。`
          : '满月夜会影响悟空的变身条件。';
      el('heroPractice').hidden =
        !!matchModule.game.online || matchModule.game.menuPage === 'online';
      el('heroGuide').textContent = '角色玩法';
      el('selectionControls').textContent =
        k === INPUT_LABELS.touch
          ? '触屏按钮控制；进入对战后显示对应招式'
          : `${k.move} 移动 · ${k.light} / ${k.heavy} 轻重击 · 按住 ${k.block} 格挡`;
      el('pauseHint').textContent = matchMedia('(pointer: coarse), (max-width: 600px)').matches
        ? '点按继续对战；切换窗口会自动暂停本地对局'
        : 'P 继续 · 切换窗口自动暂停本地对局';
    };
    v1ExtraHUD = uiModule.updateExtraHUD;
    v1ViewHUD = renderModule.updateViewHUD;
    el('skillDock').innerHTML = Array.from(
      { length: 4 },
      () =>
        '<div class="skillSlot"><kbd></kbd><span class="skillName"></span><small class="skillStatus"></small></div>',
    ).join('');
    uiModule.updateExtraHUD = function () {
      v1ExtraHUD();
      if (!matchModule.player || !matchModule.enemy) return;
      const f = uiModule.controlledFighter(),
        rows = actionRows(f);
      const isSpectating = matchModule.game.spectating;
      if (!matchModule.game.online)
        setText(
          el('pauseBtn'),
          matchMedia('(pointer: coarse), (max-width: 600px)').matches ? '暂停' : '暂停 P',
        );
      el('skillDock').hidden = !!isSpectating;
      rows.forEach((a, i) => {
        const slot = el('skillDock').children[i];
        setText(slot.querySelector('kbd'), a.key);
        setText(slot.querySelector('.skillName'), a.name);
        setText(slot.querySelector('small'), `${a.cost ? a.cost + ' 能量 · ' : ''}${a.reason}`);
        slot.dataset.available = String(['就绪', '恢复本体'].includes(a.reason));
      });
      for (const [i, id] of [
        [1, 'primarySkill'],
        [2, 'secondarySkill'],
      ]) {
        const node = el(id),
          a = rows[i];
        setText(node, a.name.replace('机甲武装切换', '切换武装').replace('卡林残像步', '残像步'));
        node.setAttribute('aria-label', `${a.name} · ${a.cost} 能量 · ${a.reason}`);
        node.title = a.reason;
        node.classList.toggle('unavailable', !['就绪', '恢复本体'].includes(a.reason));
      }
      const remote = document.querySelector('[data-key="KeyF"]');
      setText(remote, rows[0].name);
      remote.setAttribute(
        'aria-label',
        `${rows[0].name} · ${rows[0].cost} 能量 · ${rows[0].reason}`,
      );
      remote.disabled = rows[0].name === '无远程';
      remote.classList.toggle('unavailable', rows[0].reason !== '就绪');
      const ultimate = document.querySelector('[data-key="KeyU"]');
      ultimate.setAttribute('aria-label', `${rows[3].name} · 100 能量 · ${rows[3].reason}`);
      ultimate.classList.toggle('unavailable', rows[3].reason !== '就绪');
      const jump = document.querySelector('[data-key="Space"]');
      setText(jump, jumpAction(f.def.id));
      jump.setAttribute(
        'aria-label',
        jumpAction(f.def.id) +
          (jumpAction(f.def.id) === '跳跃' ? ' · 点按跳跃' : ' · 点按起跳，按住升高'),
      );
      setText(el('basicFightHint'), `J 轻击 · K 重击 · 按住 L 格挡 · 按住 I 聚气`);
      setText(
        el('actionState'),
        uiModule.fighterStatus(
          f,
          matchMedia('(pointer: coarse), (max-width: 600px)').matches
            ? INPUT_LABELS.touch
            : INPUT_LABELS.one,
        ),
      );
      const unavailable = rows.find((a) => a.reason.startsWith('能量不足'));
      setText(
        el('specialState'),
        unavailable
          ? `按住 ${matchMedia('(pointer: coarse), (max-width: 600px)').matches ? '聚气' : 'I 聚气'}，补充能量`
          : f.def.id === 'yamcha' && f.youth.wolfUntil > matchModule.game.simTime
            ? `命中窗口 · 再按${matchMedia('(pointer: coarse), (max-width: 600px)').matches ? '主技能' : ' R'}追加终掌`
            : '',
      );
      const touchStatus = el('touchStatus');
      setText(
        touchStatus,
        `${rows[0].name}：${rows[0].reason} · ${rows[1].name}：${rows[1].reason} · ${rows[2].name}：${rows[2].reason} · 必杀：${rows[3].reason}`,
      );
      for (const [fighter, id] of [
        [matchModule.player, 'p1'],
        [matchModule.enemy, 'p2'],
      ]) {
        let node = el(id + 'Ability');
        if (!node) {
          node = document.createElement('div');
          node.id = id + 'Ability';
          node.className = 'v2Ability';
          el(id + 'value').parentElement.parentElement.append(node);
        }
        setText(node, abilityStatus(fighter));
        setText(
          el(id + 'value'),
          `${Math.ceil(fighter.hp)} / ${fighter.maxHp} · 能量 ${Math.floor(fighter.ki)} / 100`,
        );
      }
      if (el('moveGuide').classList.contains('show')) uiModule.updateGuideConditions();
      const goal = uiModule.v2Goal;
      if (goal && (goal.round !== matchModule.game.round || goal.character !== f.def.id))
        uiModule.v2Goal = null;
      if (matchModule.game.difficulty === 'training') updateMechanicPractice();
    };
    renderModule.updateViewHUD = function (split) {
      v1ViewHUD(split);
      if (!split || !matchModule.player || !matchModule.enemy) return;
      for (const [f, id, keys, control] of [
        [matchModule.player, 'view1Stats', INPUT_LABELS.one, '.viewHUD.one .viewControls'],
        [matchModule.enemy, 'view2Stats', INPUT_LABELS.two, '.viewHUD.two .viewControls'],
      ]) {
        el(id).textContent += '\n' + abilityStatus(f);
        setText(
          document.querySelector(control),
          `${keys.move} 移动 · ${keys.light} / ${keys.heavy} 轻重击 · 按住 ${keys.charge} 聚气\n` +
            actionRows(f, keys)
              .map((a) => `${a.key} ${a.name}（${a.reason}）`)
              .join(' · '),
        );
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
    const goalBox = document.createElement('section');
    goalBox.className = 'mechanicPractice';
    goalBox.innerHTML =
      '<h4>角色练习</h4><p id="v2Goal" role="status" aria-live="polite"></p><button id="v2GoalStart" class="smallBtn">开始角色练习</button><button id="v2GoalStop" class="smallBtn">结束角色练习</button>';
    trainingModule.trainingPanel.insertBefore(goalBox, el('drillTools'));
    el('v2GoalStart').onclick = uiModule.startMechanicPractice;
    el('v2GoalStop').onclick = () => {
      uiModule.v2Goal = null;
      el('v2GoalStart').textContent = '开始角色练习';
      updateMechanicPractice();
    };
    v1ProcessDrill = trainingModule.processDrillEvent;
    trainingModule.processDrillEvent = function (e) {
      v1ProcessDrill(e);
      const goal = uiModule.v2Goal,
        f = matchModule.player;
      if (
        !goal ||
        goal.success ||
        e.side !== 0 ||
        e.character !== goal.character ||
        matchModule.game.difficulty !== 'training' ||
        goal.round !== matchModule.game.round
      )
        return;
      const condition = CHARACTER_HELP[goal.character].drill[goal.step][1];
      const hit = e.type === 'contact' && !e.blocked;
      const matches =
        (condition === 'contactPrimary' && hit && e.move === f.def.skills[0].name) ||
        (condition === 'contactSecondary' && hit && e.move === f.def.skills[1].name) ||
        (condition === 'heavy' && hit && e.chainType === 'heavy') ||
        (condition === 'remote' && hit && e.move === remoteAction(f.def.id, f.youth.weapon).name) ||
        (condition === 'missile' && hit && e.move === '导弹') ||
        (condition === 'flame' && hit && e.move === '喷火') ||
        (condition === 'wolfFinish' && hit && e.move === '狼牙终掌') ||
        (condition === 'catCounter' && e.type === 'attack' && e.move === '短杖反敲') ||
        (condition === 'counter' && ['counter', 'reflection'].includes(e.type)) ||
        (['reverseDirections', 'control', 'selfHeal', 'bladeReturn', 'dodgeCounter'].includes(
          condition,
        ) &&
          e.type === condition);
      if (matches) completeStep();
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
          playerHelpActions: actionRows,
          startMechanicPractice: uiModule.startMechanicPractice,
          getMechanicPractice: () => uiModule.v2Goal,
          updateMechanicPractice,
          startCharacterPractice: uiModule.startCharacterPractice,
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
