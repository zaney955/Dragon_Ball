// Round counters use the complete event stream; the 512-event debug ring is not a ledger.
export function createCombatReview() {
  return {
    sides: [0, 1].map(() => ({
      moves: {},
      armoredContacts: 0,
      punishTaken: 0,
      damage: 0,
      ultimateDamage: 0,
      confirmedOpeners: 0,
      convertedOpeners: 0,
      lostControlSeconds: 0,
      longestLostControl: 0,
      currentLostControl: 0,
      guardBreaks: 0,
      actionKiSpent: 0,
      contactKiGained: 0,
      bestComboDamage: 0,
      currentComboDamage: 0,
      whiffs: 0,
      missedPunishOpportunities: 0,
      punishedOpportunities: 0,
      generatedKi: 0,
      consumedKi: 0,
    })),
    openers: [null, null],
    punishWindows: [null, null],
  };
}
export function observeCombatEvent(review, event) {
  const own = review.sides[event.side],
    target = review.sides[event.target];
  if (!own) return;
  if (event.type === 'attack') {
    const key = event.move ?? 'unknown';
    own.moves[key] = (own.moves[key] ?? 0) + 1;
  }
  if (['kiSpent', 'dash', 'pursuit', 'backflip', 'evasion', 'breaker'].includes(event.type))
    own.actionKiSpent += event.cost ?? 0;
  if (event.type === 'whiff') {
    own.whiffs++;
    if (target && event.punishOpportunity)
      review.punishWindows[event.target] = {
        target: event.side,
        deadline: event.time + event.recoveryRemaining,
      };
  }
  if (event.type !== 'contact') return;
  const opportunity = review.punishWindows[event.side];
  if (
    opportunity &&
    opportunity.target === event.target &&
    event.time <= opportunity.deadline &&
    event.punish &&
    !event.blocked &&
    !event.armored
  ) {
    own.punishedOpportunities++;
    review.punishWindows[event.side] = null;
  }
  own.damage += event.damage ?? 0;
  own.contactKiGained += event.attackerKiGain ?? 0;
  if (target) target.contactKiGained += event.defenderKiGain ?? 0;
  if (!event.blocked) {
    if (event.recovered) own.currentComboDamage = 0;
    own.currentComboDamage += event.damage ?? 0;
    own.bestComboDamage = Math.max(own.bestComboDamage, own.currentComboDamage);
  }
  if (event.feedback === 'ultimate') own.ultimateDamage += event.damage ?? 0;
  if (event.armored) own.armoredContacts++;
  if (target && event.punish && !event.blocked && !event.armored) target.punishTaken++;
  if (target && event.feedback === 'guardbreak') target.guardBreaks++;
  if (event.blocked || event.armored || !event.chainType) return;
  const pending = review.openers[event.side];
  if (
    pending &&
    event.serial !== pending.serial &&
    event.time <= pending.deadline &&
    !event.recovered
  ) {
    own.convertedOpeners++;
    review.openers[event.side] = null;
  }
  if (event.chainIndex === 0 && event.recovered) {
    own.confirmedOpeners++;
    review.openers[event.side] = { serial: event.serial, deadline: event.time + 0.8 };
  }
}
export function sampleControlTime(review, fighters, dt, time = 0, kiBefore = []) {
  fighters.forEach((fighter, side) => {
    const row = review.sides[side];
    const opportunity = review.punishWindows[side];
    if (opportunity && time > opportunity.deadline) {
      row.missedPunishOpportunities++;
      review.punishWindows[side] = null;
    }
    const delta = fighter.ki - (kiBefore[side] ?? fighter.ki);
    if (delta > 0) row.generatedKi += delta;
    else row.consumedKi -= delta;
    if (['hit', 'knockdown', 'grabbed', 'guardbreak', 'blockstun'].includes(fighter.state)) {
      row.lostControlSeconds += dt;
      row.currentLostControl += dt;
      row.longestLostControl = Math.max(row.longestLostControl, row.currentLostControl);
    } else row.currentLostControl = 0;
  });
}
export function reviewAdvice(row) {
  if (!row) return null;
  if (row.armoredContacts >= 3)
    return {
      drill: 'whiff',
      text: `本局有${row.armoredContacts}次攻击撞上霸体。先练躲开重击，再打收招。`,
    };
  if (row.punishTaken >= 2)
    return {
      drill: 'whiff',
      text: `本局有${row.punishTaken}次在收招中被反击。练习空挥惩罚，也观察自己的出招距离。`,
    };
  if (row.missedPunishOpportunities >= 3)
    return {
      drill: 'whiff',
      text: `本局${row.missedPunishOpportunities}次对手重击打空时，你在反击距离内但未反击。可练习识别空挥收招。`,
    };
  const missed = row.confirmedOpeners - row.convertedOpeners;
  if (missed >= 3)
    return {
      drill: 'confirm',
      text: `本局${missed}次首段命中后未接成连续命中。可练习看见命中后再衔接。`,
    };
  return null;
}
