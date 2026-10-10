export function register({
  app: appModule,
  ai: aiModule,
  audio: audioModule,
  combat: combatModule,
  input: inputModule,
  match: matchModule,
  render: renderModule,
  training: trainingModule,
  ui: uiModule,
  world: worldModule,
}) {
  function tickCombat(inputProvider, enemyProvider) {
    matchModule.pendingHits = [];
    const accept =
      matchModule.game.screen === 'fight' && !matchModule.game.over && matchModule.game.ready <= 0;
    if (matchModule.game.ready > 0) {
      matchModule.game.ready = Math.max(0, matchModule.game.ready - matchModule.STEP);
      if (matchModule.game.ready <= 0) matchModule.notify('开始！', 0.55);
    }
    matchModule.player?.update(
      matchModule.STEP,
      matchModule.enemy,
      accept ? inputProvider() : combatModule.NEUTRAL_INPUT,
    );
    matchModule.enemy?.update(
      matchModule.STEP,
      matchModule.player,
      accept ? enemyProvider() : combatModule.NEUTRAL_INPUT,
    );
    combatModule.resolveOverlap();
    if (accept) {
      if (
        matchModule.combatDiagnostics.enabled &&
        (!matchModule.game.manualTest || matchModule.game.collectTestStats)
      )
        for (const [i, f] of [matchModule.player, matchModule.enemy].entries()) {
          if (f.attack) matchModule.game.roundMetrics.attack[i] += matchModule.STEP;
          if (['block', 'blockstun'].includes(f.state))
            matchModule.game.roundMetrics.defend[i] += matchModule.STEP;
        }
      combatModule.collectCombatHits();
      for (const h of matchModule.pendingHits) h.foe.takeHit(h.attacker, h.attack);
      combatModule.updateKiBlasts(matchModule.STEP);
      combatModule.updateYouthEntities(matchModule.STEP);
      combatModule.updateV2Abilities(matchModule.STEP);
      combatModule.updateKiDiscs(matchModule.STEP);
      worldModule.updateSenzu(matchModule.STEP);
      matchModule.game.simTime += matchModule.STEP;
      trainingModule.updateDrill();
      if (matchModule.game.difficulty === 'training' && matchModule.game.infiniteKi)
        matchModule.player.ki = matchModule.enemy.ki = 100;
      if (matchModule.game.difficulty !== 'training') {
        matchModule.game.timeLeft = Math.max(0, matchModule.game.timeLeft - matchModule.STEP);
        if (matchModule.game.timeLeft <= 0) matchModule.endGame();
        trainingModule.updateRoundRules(matchModule.STEP);
        if (!matchModule.game.over && (matchModule.player.hp <= 0 || matchModule.enemy.hp <= 0))
          matchModule.endGame();
      }
    }
    if (matchModule.game.comboTimer > 0) {
      matchModule.game.comboTimer -= matchModule.STEP;
      if (matchModule.game.comboTimer <= 0) {
        matchModule.game.comboCount = 0;
        uiModule.hideCombo();
      }
    }
    inputModule.clearPresses();
  }
  combatModule.advanceCombat = function advanceCombat(
    raw,
    inputProvider = inputModule.readPlayerInput,
    enemyProvider = () =>
      matchModule.game.difficulty === 'local'
        ? inputModule.readPlayer2Input()
        : aiModule.aiThink(matchModule.enemy, matchModule.player, matchModule.STEP),
  ) {
    if (matchModule.game.paused || matchModule.game.over) return;
    // Consume every fraction of frame time exactly. Hitstop and fractional ticks
    // share this budget, so 30/60/144 Hz renderers reach identical combat ticks.
    let budget = raw,
      iterations = 0;
    while (budget > 1e-10 && iterations++ < 64) {
      if (matchModule.game.hitStop > 1e-10) {
        if (
          matchModule.game.screen === 'fight' &&
          !matchModule.game.over &&
          matchModule.game.ready <= 0
        ) {
          matchModule.player.captureInput(inputProvider());
          if (matchModule.game.difficulty === 'local')
            matchModule.enemy.captureInput(enemyProvider());
        }
        const frozen = Math.min(matchModule.game.hitStop, budget);
        matchModule.game.hitStop = Math.max(0, matchModule.game.hitStop - frozen);
        budget -= frozen;
        continue;
      }
      const used = Math.min(matchModule.STEP - matchModule.stepAccumulator, budget);
      matchModule.stepAccumulator += used;
      budget -= used;
      if (matchModule.stepAccumulator >= matchModule.STEP - 1e-10) {
        matchModule.stepAccumulator = 0;
        tickCombat(inputProvider, enemyProvider);
      }
    }
  };
  combatModule.loop = function loop() {
    if (matchModule.game.closed) return;
    requestAnimationFrame(combatModule.loop);
    const raw = Math.min(renderModule.clock.getDelta(), 0.1),
      paused = matchModule.game.paused || matchModule.game.manualTest;
    appModule.online?.frame();
    if (matchModule.game.screen === 'menu') {
      renderModule.updateMenuCamera(raw);
      worldModule.currentMap?.update?.(raw);
      inputModule.clearPresses();
    } else if (!paused) {
      if (!matchModule.game.over) combatModule.advanceCombat(raw);
      renderModule.updateEffects(raw);
      worldModule.currentMap?.update?.(raw);
      renderModule.updateFightCamera(raw);
    }
    if (matchModule.player && matchModule.enemy) {
      const alpha =
          appModule.online?.active && !appModule.online.host
            ? appModule.online.renderAlpha()
            : matchModule.game.hitStop > 0 || paused
              ? 1
              : Math.min(1, matchModule.stepAccumulator / matchModule.STEP),
        visualDt = matchModule.game.hitStop > 0 || paused ? 0 : raw;
      matchModule.player.render(visualDt, alpha);
      matchModule.enemy.render(visualDt, alpha);
      uiModule.updateHUD();
    }
    if (!appModule.online?.spectating)
      renderModule.updateUltimateVisuals(paused || matchModule.game.hitStop > 0 ? 0 : raw);
    uiModule.updateExtraHUD();
    trainingModule.updateTrainingHUD();
    trainingModule.updateV1HUD();
    trainingModule.drawCombatBoxes();
    worldModule.updateSenzuHUD();
    matchModule.updateVictory?.(paused ? 0 : raw);
    audioModule.updateBGM?.();
    renderModule.renderGameViews();
  };
  return function initialize() {};
}
