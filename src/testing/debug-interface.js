export function register({
  combat: combatModule,
  match: matchModule,
  render: renderModule,
  testing: testingModule,
  training: trainingModule,
  ui: uiModule,
  world: worldModule,
}) {
  return function initialize() {
    queueMicrotask(() => {
      if (location.search.includes('test=1'))
        Object.assign(window.__db, {
          fighterStatus: uiModule.fighterStatus,
          specialAvailability: uiModule.specialAvailability,
          combatDiagnostics: matchModule.combatDiagnostics,
          getStats: matchModule.debugStats,
          endGame: matchModule.endGame,
          sampleCombatRig: combatModule.sampleCombatRig,
          resetStats() {
            matchModule.combatDiagnostics.rounds.length = 0;
          },
          updateExtraHUD: uiModule.updateExtraHUD,
          updateHUD: uiModule.updateHUD,
          renderGameViews: renderModule.renderGameViews,
          updateFightCamera: renderModule.updateFightCamera,
          resetShoulderCameras: renderModule.resetShoulderCameras,
          shoulderStates: renderModule.shoulderStates,
          cameraRay: renderModule.cameraRay,
          launchKnockback: combatModule.launchKnockback,
          damageStage: worldModule.damageStage,
          neutralCombatPose: combatModule.neutralCombatPose,
          combatPose: combatModule.combatPose,
          capsuleDistanceSq: combatModule.capsuleDistanceSq,
          discIntersects: trainingModule.discIntersects,
          updateEffects: renderModule.updateEffects,
          updateUltimateVisuals: renderModule.updateUltimateVisuals,
          runTests: testingModule.runCombatTests,
          runCollisionMatrix: testingModule.runCollisionMatrix,
          advanceCombat: combatModule.advanceCombat,
          movementYaw: trainingModule.movementYaw,
          STEP: matchModule.STEP,
          tick(input = {}, enemyInput = {}) {
            matchModule.pendingHits = [];
            matchModule.player.update(matchModule.STEP, matchModule.enemy, input);
            matchModule.enemy.update(matchModule.STEP, matchModule.player, enemyInput);
            combatModule.resolveOverlap();
            combatModule.collectCombatHits();
            for (const h of matchModule.pendingHits) h.foe.takeHit(h.attacker, h.attack);
            combatModule.updateKiBlasts(matchModule.STEP);
            combatModule.updateYouthEntities(matchModule.STEP);
            combatModule.updateV2Abilities(matchModule.STEP);
            combatModule.updateKiDiscs(matchModule.STEP);
            worldModule.updateSenzu(matchModule.STEP);
            matchModule.game.simTime += matchModule.STEP;
            trainingModule.updateDrill();
            trainingModule.updateRoundRules(matchModule.STEP);
          },
        });
    });
  };
}
