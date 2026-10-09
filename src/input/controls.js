export function register({
  audio: audioModule,
  characters: charactersModule,
  combat: combatModule,
  input: inputModule,
  match: matchModule,
  render: renderModule,
  world: worldModule,
}) {
  return function initialize() {
    Object.assign(matchModule.game, {
      difficulty: 'normal',
      opponent: -1,
      paused: false,
      ready: 0,
      round: 0,
      reducedShake: false,
      muted: false,
    });
    document.getElementById('difficulty').onchange = (e) =>
      (matchModule.game.difficulty = e.target.value);
    document.getElementById('opponent').onchange = (e) =>
      (matchModule.game.opponent = Number(e.target.value));
    document.getElementById('pauseBtn').onclick = () => matchModule.setPaused(true);
    document.getElementById('resumeBtn').onclick = () => matchModule.setPaused(false);
    document.getElementById('pauseMenu').onclick = () => {
      matchModule.setPaused(false);
      matchModule.backToMenu();
    };
    document.getElementById('motionBtn').onclick = (e) => {
      matchModule.game.reducedShake = !matchModule.game.reducedShake;
      e.target.textContent = matchModule.game.reducedShake ? '震屏：关' : '震屏：开';
      e.target.setAttribute('aria-pressed', !matchModule.game.reducedShake);
    };
    document.getElementById('soundBtn').onclick = (e) => {
      matchModule.game.muted = !matchModule.game.muted;
      e.target.textContent = matchModule.game.muted ? '声音：关' : '声音：开';
      e.target.setAttribute('aria-pressed', !matchModule.game.muted);
      if (audioModule.actx)
        matchModule.game.muted ? audioModule.actx.suspend() : audioModule.actx.resume();
    };
    addEventListener('keydown', (e) => {
      if (e.code === 'KeyP' && !e.repeat) matchModule.setPaused(!matchModule.game.paused);
    });
    addEventListener('blur', () => {
      inputModule.clearPresses();
      if (!matchModule.game.online) matchModule.setPaused(true);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !matchModule.game.online) matchModule.setPaused(true);
    });
    for (const btn of document.querySelectorAll('[data-key]')) {
      const release = (e) => {
        inputModule.keys[btn.dataset.key] = false;
        btn.classList.remove('held');
      };
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        const c = btn.dataset.key;
        inputModule.keys[c] = true;
        inputModule.justPressed[c] = true;
        if (combatModule.EDGE_KEYS[c])
          combatModule.inputEdges.push({
            type: combatModule.EDGE_KEYS[c],
            up: !!inputModule.keys.KeyW,
            down: btn.dataset.variant === '1' || !!inputModule.keys.KeyS,
          });
        btn.classList.add('held');
        audioModule.initAudio();
      });
      const cancel = (e) => {
        if (
          btn.dataset.key === 'KeyF' &&
          inputModule.keys.KeyF &&
          matchModule.player?.state === 'blastCharge'
        ) {
          matchModule.player.state = 'idle';
          matchModule.player.stateTimer = 0;
          matchModule.player.blastHeldTime = 0;
        }
        release(e);
      };
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', cancel);
      btn.addEventListener('lostpointercapture', cancel);
    }
    if (location.search.includes('test=1'))
      window.__db = {
        get player() {
          return matchModule.player;
        },
        get enemy() {
          return matchModule.enemy;
        },
        game: matchModule.game,
        Fighter: combatModule.Fighter,
        CHARACTERS: charactersModule.CHARACTERS,
        MAPS: worldModule.MAPS,
        scene: renderModule.scene,
        camera: renderModule.camera,
        renderer: renderModule.renderer,
        readPlayerInput: inputModule.readPlayerInput,
        keys: inputModule.keys,
        justPressed: inputModule.justPressed,
        startFight: matchModule.startFight,
        backToMenu: matchModule.backToMenu,
        setPaused: matchModule.setPaused,
        resolveOverlap: combatModule.resolveOverlap,
        step(dt, input = {}) {
          matchModule.pendingHits = [];
          matchModule.player.update(dt, matchModule.enemy, input);
          matchModule.enemy.update(dt, matchModule.player, {});
          combatModule.collectCombatHits();
          for (const h of matchModule.pendingHits) h.foe.takeHit(h.attacker, h.attack);
          combatModule.resolveOverlap();
        },
        get map() {
          return worldModule.currentMap;
        },
        showResult: matchModule.showResult,
      };
  };
}
