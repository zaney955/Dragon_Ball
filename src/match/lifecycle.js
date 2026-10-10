export function register({
  ai: aiModule,
  audio: audioModule,
  characters: charactersModule,
  combat: combatModule,
  input: inputModule,
  match: matchModule,
  render: renderModule,
  training: trainingModule,
  ui: uiModule,
  world: worldModule,
}) {
  matchModule.hex = function hex(n) {
    return '#' + n.toString(16).padStart(6, '0');
  };
  matchModule.previewMap = function previewMap(i) {
    worldModule.clearMap();
    worldModule.currentMap = worldModule.MAPS[i].build();
    renderModule.scene.add(worldModule.currentMap.group);
  };
  matchModule.startFight = function startFight() {
    combatModule.clearKiBlasts();
    trainingModule.clearDebugBoxes();
    audioModule.initAudio();
    renderModule.clearUltimateVisuals();
    combatModule.clearKiDiscs();
    combatModule.inputEdges.length = 0;
    inputModule.inputEdges2.length = 0;
    if (matchModule.player) {
      matchModule.player.dispose();
      matchModule.player = null;
    }
    if (matchModule.enemy) {
      matchModule.enemy.dispose();
      matchModule.enemy = null;
    }
    renderModule.effects.forEach((e) => {
      renderModule.scene.remove(e.mesh);
      if (
        e.mesh.geometry &&
        e.mesh.geometry !== renderModule.sparkGeo &&
        e.mesh.geometry !== renderModule.ringGeo
      )
        e.mesh.geometry.dispose();
      if (e.mesh.material) e.mesh.material.dispose();
    });
    renderModule.effects = [];
    worldModule.clearMap();
    worldModule.currentMap = worldModule.MAPS[matchModule.game.selectedMap].build();
    renderModule.scene.add(worldModule.currentMap.group);
    const pDef =
      charactersModule.CHARACTERS[
        matchModule.game.keepPair && matchModule.game.lastPair
          ? matchModule.game.lastPair[0]
          : matchModule.game.selectedChar
      ];
    let eIdx = Math.floor(aiModule.combatRandom() * charactersModule.CHARACTERS.length);
    if (eIdx === matchModule.game.selectedChar)
      eIdx = (eIdx + 1) % charactersModule.CHARACTERS.length;
    const eDef =
      charactersModule.CHARACTERS[
        matchModule.game.keepPair && matchModule.game.lastPair
          ? matchModule.game.lastPair[1]
          : matchModule.game.opponent >= 0
            ? matchModule.game.opponent
            : eIdx
      ];
    matchModule.game.lastPair = [
      matchModule.game.selectedChar,
      charactersModule.CHARACTERS.indexOf(eDef),
    ];
    matchModule.player = new combatModule.Fighter(pDef, false, -4.2, 1);
    matchModule.enemy = new combatModule.Fighter(
      eDef,
      matchModule.game.difficulty !== 'local',
      4.2,
      -1,
    );
    uiModule.el.p1name.textContent = pDef.name;
    uiModule.el.p2name.textContent =
      (matchModule.game.difficulty === 'local' ? '2P · ' : 'CPU · ') + eDef.name;
    uiModule.el.p1ultname.textContent = pDef.ultName;
    uiModule.el.p2ultname.textContent = eDef.ultName;
    matchModule.game.timeLeft = 180;
    matchModule.game.hitStop = 0;
    matchModule.game.roundMetrics = {
      attack: [0, 0],
      defend: [0, 0],
      damage: [0, 0],
    };
    matchModule.game.shake = 0;
    matchModule.game.comboDamage = 0;
    matchModule.game.cameraImpulse = 0;
    matchModule.game.simTime = 0;
    matchModule.game.over = false;
    matchModule.game.comboCount = 0;
    matchModule.game.comboTimer = 0;
    matchModule.game.screen = 'fight';
    matchModule.game.round++;
    matchModule.game.paused = false;
    matchModule.game.ready = 1.15;
    matchModule.stepAccumulator = 0;
    document.getElementById('pause').classList.remove('show');
    document.getElementById('arenaName').innerHTML =
      '<span>' +
      worldModule.MAPS[matchModule.game.selectedMap].name +
      '</span><span>' +
      (matchModule.game.difficulty === 'training'
        ? '自由练习'
        : matchModule.game.difficulty === 'local'
          ? '本地双人'
          : matchModule.game.difficulty === 'hard'
            ? '电脑对战 · 困难'
            : '电脑对战 · 普通') +
      '</span>';
    matchModule.notify('准备', 1.15);
    renderModule.camera.position.set(-1, 4.6, 14);
    renderModule.camera.lookAt(0, 1.8, 0);
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('result').classList.remove('show');
    uiModule.el.hud.classList.add('show');
    document.getElementById('menu').inert = true;
    uiModule.el.hud.inert = false;
    document.getElementById('result').inert = true;
    document.getElementById('pause').inert = true;
    uiModule.hideCombo();
    uiModule.updateHUD();
    for (const k in inputModule.keys) inputModule.keys[k] = false;
    for (const k in inputModule.justPressed) delete inputModule.justPressed[k];
    matchModule.game.endReason = '';
    matchModule.game.matchFinished = false;
    matchModule.player.outsideTime = matchModule.enemy.outsideTime = 0;
    matchModule.game.inputHistory = [];
    document.querySelectorAll('.dmgNum').forEach((x) => x.remove());
    trainingModule.refreshMoveTable();
    document.getElementById('dummyLive').value = matchModule.game.trainingDummy;
    document.getElementById('home').hidden = true;
    document.getElementById('home').inert = true;
    document.body.classList.add('inFight');
    worldModule.resetSenzu();
    renderModule.resetShoulderCameras();
    combatModule.combatEvents.history.length = 0;
    trainingModule.drillSystem.current = null;
    combatModule.emitCombatEvent('roundStart', matchModule.player, matchModule.enemy, null, {
      rule: matchModule.game.matchRule,
    });
  };
  matchModule.backToMenu = function backToMenu() {
    combatModule.clearKiBlasts();
    trainingModule.drillSystem.current = null;
    renderModule.clearUltimateVisuals();
    combatModule.clearKiDiscs();
    combatModule.inputEdges.length = 0;
    inputModule.inputEdges2.length = 0;
    matchModule.game.screen = 'menu';
    matchModule.game.round++;
    matchModule.game.paused = false;
    document.getElementById('pause').classList.remove('show');
    matchModule.game.over = false;
    if (matchModule.player) {
      matchModule.player.dispose();
      matchModule.player = null;
    }
    if (matchModule.enemy) {
      matchModule.enemy.dispose();
      matchModule.enemy = null;
    }
    renderModule.effects.forEach((e) => {
      renderModule.scene.remove(e.mesh);
      if (
        e.mesh.geometry &&
        e.mesh.geometry !== renderModule.sparkGeo &&
        e.mesh.geometry !== renderModule.ringGeo
      )
        e.mesh.geometry.dispose();
      if (e.mesh.material) e.mesh.material.dispose();
    });
    renderModule.effects = [];
    uiModule.el.hud.classList.remove('show');
    document.getElementById('result').classList.remove('show');
    document.getElementById('menu').classList.remove('hidden');
    matchModule.previewMap(matchModule.game.selectedMap);
    renderModule.menuAngle = 0;
    document.getElementById('menu').inert = false;
    uiModule.el.hud.inert = true;
    document.getElementById('result').inert = true;
    document.getElementById('pause').inert = true;
  };
  matchModule.showResult = function showResult(winner) {
    const rt = document.getElementById('resultTitle');
    const rs = document.getElementById('resultSub');
    const r = document.getElementById('result');
    if (winner === 'player') {
      rt.textContent =
        matchModule.game.difficulty === 'local'
          ? matchModule.game.matchFinished
            ? '1P 赢得比赛'
            : '1P 回合获胜'
          : matchModule.game.matchFinished
            ? '赢得比赛'
            : '回合胜利';
      rt.className = 'win';
      rs.textContent =
        matchModule.game.wins.join(' : ') +
        ' · ' +
        ({
          'K.O.': '击倒',
          'TIME UP': '时间结束',
          'RING OUT': '出界',
        }[matchModule.game.endReason] ?? matchModule.game.endReason);
    } else if (winner === 'enemy') {
      rt.textContent =
        matchModule.game.difficulty === 'local'
          ? matchModule.game.matchFinished
            ? '2P 赢得比赛'
            : '2P 回合获胜'
          : matchModule.game.matchFinished
            ? '比赛结束'
            : '回合落败';
      rt.className = 'lose';
      rs.textContent =
        matchModule.game.wins.join(' : ') +
        ' · ' +
        ({
          'K.O.': '击倒',
          'TIME UP': '时间结束',
          'RING OUT': '出界',
        }[matchModule.game.endReason] ?? matchModule.game.endReason);
    } else {
      rt.textContent = '平局';
      rt.className = 'lose';
      rs.textContent = '本回合重赛';
    }
    document.getElementById('againBtn').textContent =
      winner === 'draw' ? '重赛' : matchModule.game.matchFinished ? '再战一场' : '下一回合';
    r.classList.add('show');
    r.inert = false;
    uiModule.el.hud.inert = true;
  };
  return function initialize() {};
}
