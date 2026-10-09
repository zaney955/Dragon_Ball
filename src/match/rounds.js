export function register({
  combat: combatModule,
  input: inputModule,
  match: matchModule,
  world: worldModule,
}) {
  function recordRoundDiagnostics(reason, winner) {
    if (
      !matchModule.combatDiagnostics.enabled ||
      (matchModule.game.manualTest && !matchModule.game.collectTestStats)
    )
      return;
    const pickups = worldModule.currentMap?.senzuPickups ?? [],
      m = matchModule.game.roundMetrics ?? {
        attack: [0, 0],
        defend: [0, 0],
        damage: [0, 0],
      };
    matchModule.combatDiagnostics.rounds.push({
      characters: [matchModule.player.def.id, matchModule.enemy.def.id],
      rule: matchModule.game.matchRule,
      comeback: pickups.some(
        (p) =>
          p.behindBefore && p.player === (winner === 'player' ? 1 : winner === 'enemy' ? 2 : 0),
      ),
      reason,
      winner,
      duration: matchModule.game.simTime,
      pickups: pickups.length,
      healed: pickups.reduce((n, x) => n + x.heal, 0),
      healedByPlayer: [1, 2].map((i) =>
        pickups.filter((x) => x.player === i).reduce((n, x) => n + x.heal, 0),
      ),
      attackSeconds: m.attack.slice(),
      defendSeconds: m.defend.slice(),
      damage: m.damage.slice(),
    });
    if (matchModule.combatDiagnostics.rounds.length > 200)
      matchModule.combatDiagnostics.rounds.shift();
  }
  matchModule.debugStats = function debugStats() {
    const rounds = matchModule.combatDiagnostics.rounds,
      n = rounds.length;
    return {
      rounds: rounds.map((x) => ({
        ...x,
      })),
      summary: {
        rounds: n,
        averageDuration: n ? rounds.reduce((v, x) => v + x.duration, 0) / n : 0,
        averagePickups: n ? rounds.reduce((v, x) => v + x.pickups, 0) / n : 0,
        comebacks: rounds.filter((x) => x.comeback).length,
        comebackRatio: n ? rounds.filter((x) => x.comeback).length / n : 0,
        pickups: rounds.reduce((v, x) => v + x.pickups, 0),
        healed: rounds.reduce((v, x) => v + x.healed, 0),
        timeoutRatio: n ? rounds.filter((x) => x.reason === 'TIME UP').length / n : 0,
      },
    };
  };
  matchModule.endGame = function endGame(reason = null) {
    if (matchModule.game.over || matchModule.game.difficulty === 'training') return;
    matchModule.game.endReason =
      reason ?? (matchModule.player.hp <= 0 || matchModule.enemy.hp <= 0 ? 'K.O.' : 'TIME UP');
    const winner =
      matchModule.game.endReason === 'RING OUT'
        ? matchModule.game.ringWinner
        : matchModule.roundWinner(matchModule.player, matchModule.enemy);
    recordRoundDiagnostics(matchModule.game.endReason, winner);
    matchModule.game.over = true;
    combatModule.cancelKiHolds();
    combatModule.clearKiBlasts();
    matchModule.game.screen = 'over';
    matchModule.game.paused = false;
    matchModule.game.hitStop = 0;
    matchModule.player.clearQueue();
    matchModule.enemy.clearQueue();
    inputModule.clearPresses();
    for (const k in inputModule.keys) inputModule.keys[k] = false;
    if (winner !== 'draw') matchModule.game.wins[winner === 'player' ? 0 : 1]++;
    matchModule.game.matchFinished = matchModule.game.wins.some((x) => x >= 2);
    matchModule.game.lastWinner = winner;
    const round = matchModule.game.round;
    setTimeout(() => {
      if (round === matchModule.game.round && matchModule.game.screen === 'over')
        matchModule.showResult(winner);
    }, 750);
  };
  matchModule.roundWinner = function roundWinner(p, e) {
    if (p.hp <= 0 || e.hp <= 0) return p.hp <= 0 ? (e.hp <= 0 ? 'draw' : 'enemy') : 'player';
    const d = p.hp / p.maxHp - e.hp / e.maxHp;
    return Math.abs(d) < 1e-6 ? 'draw' : d > 0 ? 'player' : 'enemy';
  };
  return function initialize() {
    matchModule.combatDiagnostics = {
      enabled:
        new URLSearchParams(location.search).has('test') ||
        new URLSearchParams(location.search).has('debug'),
      rounds: [],
    };
  };
}
