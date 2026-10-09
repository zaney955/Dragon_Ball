export function register({
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
  uiModule.popDamage = function popDamage(worldPos, dmg, color, healing = false) {
    if (matchModule.game.manualTest) return;
    const list =
      matchModule.game.difficulty === 'local'
        ? [
            [renderModule.camera, 0, innerHeight / 2],
            [renderModule.camera2, innerHeight / 2, innerHeight / 2],
          ]
        : [[renderModule.camera, 0, innerHeight]];
    for (const [cam, offset, height] of list) {
      const v = worldPos.clone().project(cam);
      if (v.z < -1 || v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue;
      const e = document.createElement('div');
      e.className = 'dmgNum';
      e.style.left = (v.x * 0.5 + 0.5) * innerWidth + 'px';
      e.style.top = (-0.5 * v.y + 0.5) * height + offset + 'px';
      e.style.color = color;
      e.textContent = (healing ? '+' : '') + Math.round(dmg);
      document.body.appendChild(e);
      setTimeout(() => e.remove(), 800);
    }
  };
  function showHome() {
    if (matchModule.game.screen !== 'menu') matchModule.backToMenu();
    matchModule.game.menuPage = 'home';
    document.body.classList.remove('inFight');
    document.getElementById('home').hidden = false;
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('menu').inert = true;
    document.getElementById('home').inert = false;
    document.getElementById('homeStart').focus();
  }
  uiModule.showSelection = function showSelection() {
    matchModule.game.menuPage = 'select';
    document.getElementById('home').hidden = true;
    document.getElementById('home').inert = true;
    document.getElementById('menu').classList.remove('hidden');
    document.getElementById('menu').inert = false;
    document.body.classList.remove('inFight');
    uiModule.updateSelection();
  };
  uiModule.updateSelection = function updateSelection() {
    for (const [id, value] of [
      ['difficulty', matchModule.game.difficulty],
      ['opponent', matchModule.game.opponent],
      ['lighting', matchModule.game.lightPreset],
      ['trainingDummy', matchModule.game.trainingDummy],
    ])
      document.getElementById(id).value = String(value);
    const local = matchModule.game.difficulty === 'local';
    if (!local) matchModule.game.selectionPlayer = 1;
    document.getElementById('pickP2').disabled = !local;
    document
      .getElementById('pickP1')
      .classList.toggle('active', matchModule.game.selectionPlayer === 1);
    document
      .getElementById('pickP2')
      .classList.toggle('active', matchModule.game.selectionPlayer === 2);
    const index =
        matchModule.game.selectionPlayer === 2
          ? Math.max(0, matchModule.game.opponent)
          : matchModule.game.selectedChar,
      c = charactersModule.CHARACTERS[index];
    const cards = [...document.querySelectorAll('.char-card')];
    cards.forEach((node, i) => {
      node.classList.toggle('sel', i === index);
      node.setAttribute('aria-pressed', i === index);
    });
    document.getElementById('heroImage').src = cards[index].querySelector('img').src;
    document.getElementById('heroImage').alt = c.name + '角色模型';
    document.getElementById('heroName').textContent = c.name;
    document.getElementById('heroTitle').textContent = c.title;
    document.getElementById('heroUlt').textContent = c.ultName;
    document.getElementById('heroHP').textContent = c.hp;
    document.getElementById('heroSpeed').textContent = Math.round(c.speed * 100) + '%';
    document.getElementById('heroOwner').textContent =
      (matchModule.game.selectionPlayer === 1 ? '1P' : '2P') + ' 武道家';
    document.getElementById('matchRule').value = matchModule.game.matchRule;
    const enemyName =
      matchModule.game.opponent < 0
        ? '随机对手'
        : charactersModule.CHARACTERS[matchModule.game.opponent].name;
    document.getElementById('selectionSummary').innerHTML =
      '<b>' +
      charactersModule.CHARACTERS[matchModule.game.selectedChar].name +
      '</b><span>VS</span><b>' +
      enemyName +
      '</b><small>' +
      worldModule.MAPS[matchModule.game.selectedMap].name +
      '</small>';
    const tab = document.getElementById('rosterTitle');
    tab.innerHTML =
      '<span class="step">01</span>' +
      (local ? '选择 ' + matchModule.game.selectionPlayer + 'P 角色' : '选择角色');
    document.getElementById('playerTabs').hidden = !local;
    document.getElementById('trainingOption').hidden = matchModule.game.difficulty !== 'training';
    document.getElementById('opponentLabel').textContent = local ? '2P 角色' : '对手';
    document.getElementById('modeNote').textContent =
      matchModule.game.difficulty === 'training'
        ? '不限时 · 训练工具可用'
        : local
          ? '上下分屏 · 99 秒 · 三局两胜'
          : '99 秒 · 三局两胜';
    document.getElementById('startBtn').textContent =
      matchModule.game.difficulty === 'training' ? '开始练习 ›' : '开始对战 ›';
  };
  async function quitGame() {
    if (matchModule.game.closed) return;
    combatModule.clearKiBlasts();
    combatModule.cancelKiHolds();
    trainingModule.clearDebugBoxes();
    matchModule.game.closed = true;
    matchModule.game.paused = true;
    inputModule.clearPresses();
    renderModule.clearUltimateVisuals();
    combatModule.clearKiDiscs();
    if (matchModule.player) {
      matchModule.player.dispose();
      matchModule.player = null;
    }
    if (matchModule.enemy) {
      matchModule.enemy.dispose();
      matchModule.enemy = null;
    }
    worldModule.clearMap();
    renderModule.renderer.dispose();
    if (audioModule.actx)
      try {
        await audioModule.actx.close();
      } catch {}
    document.getElementById('quitOverlay').hidden = false;
    document.getElementById('home').hidden = true;
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('hud').classList.remove('show');
    document.getElementById('splitOverlay').hidden = true;
    document.getElementById('singleTarget').hidden = true;
    document.getElementById('senzuStatus').hidden = true;
    document.getElementById('fightNotice').classList.remove('visible');
    document.getElementById('result').classList.remove('show');
    document.getElementById('pause').classList.remove('show');
    const token = new URLSearchParams(location.search).get('native');
    if (token && location.hostname === '127.0.0.1') {
      try {
        await fetch('/quit?token=' + encodeURIComponent(token), {
          method: 'POST',
        });
      } catch {}
      return;
    }
    if (!location.search.includes('test=1')) window.close();
  }
  return function initialize() {
    if (location.search.includes('test=1'))
      Object.assign(window.__db, {
        camera2: renderModule.camera2,
        shoulderStates: renderModule.shoulderStates,
        resetShoulderCameras: renderModule.resetShoulderCameras,
        updateFightCamera: renderModule.updateFightCamera,
        renderGameViews: renderModule.renderGameViews,
        updateSenzu: worldModule.updateSenzu,
        resetSenzu: worldModule.resetSenzu,
        kiDiscs: combatModule.kiDiscs,
        updateKiDiscs: combatModule.updateKiDiscs,
      });
    Object.assign(matchModule.game, {
      menuPage: 'home',
      selectionPlayer: 1,
      closed: false,
    });
    queueMicrotask(() => {
      document.getElementById('homeStart').onclick = () => {
        audioModule.initAudio();
        uiModule.showSelection();
      };
      document.getElementById('homeExit').onclick = quitGame;
      document.getElementById('backHome').onclick = showHome;
      document.getElementById('restartClosed').onclick = () => location.reload();
      document.getElementById('pickP1').onclick = () => {
        matchModule.game.selectionPlayer = 1;
        uiModule.updateSelection();
      };
      document.getElementById('pickP2').onclick = () => {
        matchModule.game.selectionPlayer = 2;
        if (matchModule.game.opponent < 0) {
          matchModule.game.opponent =
            (matchModule.game.selectedChar + 1) % charactersModule.CHARACTERS.length;
          document.getElementById('opponent').value = matchModule.game.opponent;
        }
        uiModule.updateSelection();
      };
      document.querySelectorAll('.char-card').forEach((card, i) => {
        card.onclick = () => {
          if (matchModule.game.selectionPlayer === 2) {
            matchModule.game.opponent = i;
            document.getElementById('opponent').value = i;
          } else matchModule.game.selectedChar = i;
          uiModule.updateSelection();
          audioModule.initAudio();
        };
      });
      for (const id of ['difficulty', 'opponent'])
        document.getElementById(id).addEventListener('change', uiModule.updateSelection);
      const back = matchModule.backToMenu;
      matchModule.backToMenu = function () {
        back();
        trainingModule.clearDebugBoxes();
        uiModule.hideCombo();
        matchModule.game.comboCount = 0;
        matchModule.game.comboTimer = 0;
        matchModule.game.comboDamage = 0;
        matchModule.game.inputHistory = [];
        matchModule.messageUntil = 0;
        document.getElementById('fightNotice').textContent = '';
        matchModule.game.keepPair = false;
        matchModule.game.wins = [0, 0];
        matchModule.game.matchRound = 1;
        matchModule.game.hitStop = 0;
        matchModule.game.shake = 0;
        matchModule.game.ready = 0;
        matchModule.stepAccumulator = 0;
        for (const k in inputModule.keys) inputModule.keys[k] = false;
        inputModule.clearPresses();
        document.querySelectorAll('.dmgNum').forEach((x) => x.remove());
        document.body.classList.remove('inFight', 'splitMode');
        uiModule.showSelection();
        document.getElementById('splitOverlay').hidden = true;
        document.getElementById('singleTarget').hidden = true;
      };
      // Original button handlers captured the old function before the menu was rebuilt.
      document.getElementById('startBtn').onclick = () => {
        matchModule.game.keepPair = false;
        matchModule.game.wins = [0, 0];
        matchModule.game.matchRound = 1;
        matchModule.startFight();
      };
      document.getElementById('againBtn').onclick = () => {
        matchModule.game.keepPair = true;
        if (matchModule.game.matchFinished) {
          matchModule.game.wins = [0, 0];
          matchModule.game.matchRound = 1;
        } else matchModule.game.matchRound++;
        matchModule.startFight();
      };
      document.getElementById('menuBtn').onclick = () => matchModule.backToMenu();
      addEventListener('keydown', (e) => {
        if (
          e.code === 'Escape' &&
          !e.dbReturnedFromFight &&
          matchModule.game.screen === 'menu' &&
          matchModule.game.menuPage === 'select'
        ) {
          showHome();
          e.preventDefault();
        }
      });
      showHome();
      if (location.search.includes('test=1'))
        Object.assign(window.__db, {
          showHome,
          showSelection: uiModule.showSelection,
          quitGame,
          updateSelection: uiModule.updateSelection,
          startFight: matchModule.startFight,
          backToMenu: matchModule.backToMenu,
        });
    });

    /* Combat geometry is sampled from an unrendered bone rig at simulation time.
    No WebGL matrices, interpolation or render-frame clocks enter hit detection. */
  };
}
