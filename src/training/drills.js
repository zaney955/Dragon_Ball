import { CHARACTER_HELP, INPUT_LABELS, inputCopy } from '../ui/character-help.js';
export function register({
  ai: aiModule,
  animation: animationModule,
  audio: audioModule,
  combat: combatModule,
  match: matchModule,
  render: renderModule,
  training: trainingModule,
}) {
  let DRILLS, ruleLabel, ruleSelect, drillTools;
  function finishDrill(success, message) {
    const d = trainingModule.drillSystem.current;
    if (!d || d.finished) return;
    d.finished = true;
    d.success = success;
    d.message = message;
    const s = (trainingModule.drillSystem.stats[d.key] ??= {
      attempts: 0,
      successes: 0,
    });
    s.attempts++;
    if (success) s.successes++;
    matchModule.notify((success ? '训练成功 · ' : '训练未完成 · ') + message, 0.7);
  }
  trainingModule.startDrill = function startDrill(kind) {
    if (matchModule.game.difficulty !== 'training' || !DRILLS[kind]) return;
    if (trainingModule.drillSystem.current && !trainingModule.drillSystem.current.finished)
      finishDrill(false, '重试前未完成');
    trainingModule.drillSystem.current = null;
    matchModule.game.keepPair = true;
    matchModule.startFight();
    matchModule.game.ready = 0;
    const distance = kind === 'whiff' ? 1.45 : 0.82;
    matchModule.player.pos.set(-distance / 2, 0, 0);
    matchModule.enemy.pos.set(distance / 2, 0, 0);
    matchModule.player.previousPos.copy(matchModule.player.pos);
    matchModule.enemy.previousPos.copy(matchModule.enemy.pos);
    matchModule.player.ki = 70;
    matchModule.enemy.ki = 70;
    renderModule.resetShoulderCameras();
    trainingModule.drillSystem.current = {
      kind,
      key: matchModule.player.def.id + ':' + kind,
      start: matchModule.game.simTime,
      phase: 'waiting',
      defend: kind === 'confirm' && aiModule.combatRandom() < 0.5,
      finished: false,
      message: DRILLS[kind].help,
    };
    if (trainingModule.drillSystem.current.defend) {
      matchModule.enemy.guardHeld = 0.4;
      matchModule.enemy.wasBlocking = true;
      matchModule.enemy.state = 'block';
    }
  };
  trainingModule.drillInput = function drillInput(ai, foe) {
    const d = trainingModule.drillSystem.current;
    if (!d || d.finished || ai !== matchModule.enemy) return null;
    if (d.kind === 'confirm')
      return {
        block: d.defend,
      };
    if (d.phase === 'waiting' && matchModule.game.simTime - d.start >= 0.8) {
      d.phase = 'attacking';
      return {
        heavy: true,
      };
    }
    return {};
  };
  trainingModule.processDrillEvent = function processDrillEvent(e) {
    const d = trainingModule.drillSystem.current;
    if (!d || d.finished || matchModule.game.difficulty !== 'training') return;
    if (d.kind === 'confirm') {
      if (e.type === 'attack' && e.side === 0 && d.phase === 'blocked' && e.serial !== d.serial)
        finishDrill(false, '被挡后继续了攻击');
      if (e.type === 'contact' && e.side === 0 && e.target === 1) {
        if (d.phase === 'waiting') {
          if (e.chainType !== 'light') {
            finishDrill(false, '先用轻击试探');
            return;
          }
          d.serial = e.serial;
          d.phase = e.blocked ? 'blocked' : 'hit';
          d.deadline = matchModule.game.simTime + (e.blocked ? 0.8 : 0.65);
          d.message = e.blocked ? '已格挡：停止不安全衔接' : '已命中：接下一段轻击';
        } else if (d.phase === 'hit' && e.serial !== d.serial) {
          finishDrill(
            !e.blocked && !e.recovered,
            e.blocked || e.recovered ? '衔接过迟，被防住或恢复' : '真实连续命中确认',
          );
        }
      }
    } else {
      if (
        d.kind === 'guard' &&
        (e.type === 'parry' || (e.type === 'contact' && e.blocked)) &&
        e.side === 1 &&
        e.target === 0
      ) {
        d.phase = 'window';
        d.parried = e.type === 'parry';
        d.deadline = matchModule.game.simTime + e.recoveryRemaining;
        d.message = '防御成功：在 ' + Math.floor(e.recoveryRemaining * 60) + 'F 收招窗口内反击';
      }
      if (d.kind === 'whiff' && e.type === 'whiff' && e.side === 1) {
        d.phase = 'window';
        d.deadline = matchModule.game.simTime + e.recoveryRemaining;
        d.message = '对手空挥：回到有效距离并反击';
      }
      if (e.type === 'contact' && e.side === 0 && e.target === 1 && !e.blocked) {
        const valid =
          d.phase === 'window' &&
          matchModule.game.simTime <= d.deadline + matchModule.STEP &&
          (e.punish || d.parried);
        finishDrill(valid, valid ? '真实收招惩罚命中' : '未在可惩罚窗口命中');
      }
      if (e.type === 'contact' && e.side === 1 && e.target === 0 && !e.blocked)
        finishDrill(false, '未规避或防住对手重击');
    }
  };
  trainingModule.updateDrill = function updateDrill() {
    const d = trainingModule.drillSystem.current;
    if (!d || d.finished || matchModule.game.paused) return;
    if (d.kind === 'confirm' && d.phase === 'blocked' && matchModule.game.simTime >= d.deadline)
      finishDrill(true, '格挡确认后停止衔接');
    else if (d.deadline && matchModule.game.simTime > d.deadline + matchModule.STEP)
      finishDrill(false, '反击或确认窗口已结束');
    else if (matchModule.game.simTime - d.start > 8) finishDrill(false, '未完成操作，可重试');
  };
  function drillReadout() {
    const d = trainingModule.drillSystem.current,
      kind = d?.kind ?? document.getElementById('drillKind').value,
      key = matchModule.player?.def.id + ':' + kind,
      s = trainingModule.drillSystem.stats[key] ?? {
        attempts: 0,
        successes: 0,
      };
    return (
      (d ? d.message : DRILLS[kind].help) +
      '\n成功 ' +
      s.successes +
      ' / ' +
      s.attempts +
      ' · ' +
      (s.attempts ? Math.round((s.successes / s.attempts) * 100) : 0) +
      '%'
    );
  }
  trainingModule.updateV1HUD = function updateV1HUD() {
    if (matchModule.game.difficulty !== 'training') return;
    document.getElementById('drillReadout').textContent = matchModule.player ? drillReadout() : '';
    document.getElementById('tacticsReadout').textContent = matchModule.player
      ? CHARACTER_HELP[matchModule.player.def.id].summary +
        '\n' +
        inputCopy(
          CHARACTER_HELP[matchModule.player.def.id].tip,
          matchMedia('(pointer: coarse), (max-width: 600px)').matches
            ? INPUT_LABELS.touch
            : INPUT_LABELS.one,
        ) +
        (matchModule.player.attack?.armor
          ? '\n霸体 ' +
            (aiModule.armorWindow(matchModule.player)
              ? '窗口内 · 可承受一次'
              : matchModule.player.armorSpent
                ? '已承伤 · 不再保护'
                : '窗口结束')
          : '')
      : '';
  };
  return function initialize() {
    trainingModule.drillSystem = {
      current: null,
      stats: {},
    };
    DRILLS = {
      confirm: {
        name: '命中确认',
        help: '轻击试探：命中再接轻击，被挡则停止衔接。',
      },
      guard: {
        name: '格挡确反',
        help: '先按住格挡防住重击，硬直结束立即轻击反击。',
      },
      whiff: {
        name: '空挥惩罚',
        help: '后撤或侧闪诱导重击落空，及时回到射程内轻击反击。',
      },
    };
    ruleLabel = document.createElement('label');
    ruleLabel.className = 'v1Rule';
    ruleLabel.textContent = '对局规则 ';
    ruleSelect = document.createElement('select');
    ruleSelect.id = 'matchRule';
    ruleSelect.setAttribute('aria-label', '选择对局规则');
    ruleSelect.innerHTML =
      '<option value="senzu">仙豆争夺</option><option value="competitive">标准竞技 · 无仙豆</option>';
    ruleLabel.appendChild(ruleSelect);
    document.querySelector('.settingsContent').prepend(ruleLabel);
    matchModule.game.matchRule = 'senzu';
    ruleSelect.onchange = (e) => (matchModule.game.matchRule = e.target.value);
    drillTools = document.createElement('div');
    drillTools.id = 'drillTools';
    drillTools.innerHTML =
      '<label>专项 <select id="drillKind" aria-label="选择专项训练"><option value="confirm">命中确认</option><option value="guard">格挡确反</option><option value="whiff">空挥惩罚</option></select></label><div class="trainingActions"><button id="drillStart" class="smallBtn">开始</button><button id="drillRetry" class="smallBtn">重试</button><button id="drillStop" class="smallBtn">结束</button></div><div id="drillReadout"></div><details class="tacticsDetails"><summary>角色打法</summary><div id="tacticsReadout"></div></details>';
    trainingModule.trainingPanel.appendChild(drillTools);
    document.getElementById('drillStart').onclick = document.getElementById('drillRetry').onclick =
      () => trainingModule.startDrill(document.getElementById('drillKind').value);
    document.getElementById('drillStop').onclick = () => {
      if (trainingModule.drillSystem.current && !trainingModule.drillSystem.current.finished)
        finishDrill(false, '返回自由练习');
      trainingModule.drillSystem.current = null;
    };
    queueMicrotask(() => {
      if (location.search.includes('test=1'))
        Object.assign(window.__db, {
          combatEvents: combatModule.combatEvents,
          FEEDBACK_PROFILES: combatModule.FEEDBACK_PROFILES,
          impactKind: combatModule.impactKind,
          emitCombatEvent: combatModule.emitCombatEvent,
          beginMoveEvent: combatModule.beginMoveEvent,
          armorWindow: aiModule.armorWindow,
          cpuDistance: aiModule.cpuDistance,
          TACTICS: aiModule.TACTICS,
          drillSystem: trainingModule.drillSystem,
          DRILLS,
          startDrill: trainingModule.startDrill,
          finishDrill,
          drillInput: trainingModule.drillInput,
          processDrillEvent: trainingModule.processDrillEvent,
          updateDrill: trainingModule.updateDrill,
          polishCombatPose: animationModule.polishCombatPose,
          cloneCombatPose: animationModule.cloneCombatPose,
          mixCombatPose: animationModule.mixCombatPose,
          getAudioState: () => ({
            state: audioModule.actx?.state,
            voices: combatModule.combatEvents.audioVoices,
            peak: combatModule.combatEvents.audioPeak,
            limiter: !!audioModule.combatAudioMaster,
          }),
        });
    });
  };
}
