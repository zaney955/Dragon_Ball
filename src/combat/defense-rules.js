export const DEFENSE_RULES = Object.freeze({
  max: 100,
  warning: 25,
  fatigueStart: 0.6,
  fatigueRate: 6,
  fatigueFloor: 20,
  releaseDelay: 0.6,
  hitDelay: 1.2,
  recoveryRate: 24,
  breakStun: 0.9,
  breakDelay: 1.5,
  unlockAt: 30,
  parryReward: 8,
});

export const canBlock = (f) => !f.guardBroken && f.guard > 0;
const resting = (f) => !f.attack && ['idle', 'walk', 'crouch', 'dash'].includes(f.state);

export function updateDefense(f, dt, holding) {
  if (f.hp <= 0) return;
  if (holding && canBlock(f) && ['block', 'blockstun'].includes(f.state)) {
    f.guardDelay = Math.max(f.guardDelay, DEFENSE_RULES.releaseDelay);
    if (f.guardHeld > DEFENSE_RULES.fatigueStart && f.guard > DEFENSE_RULES.fatigueFloor)
      f.guard = Math.max(DEFENSE_RULES.fatigueFloor, f.guard - DEFENSE_RULES.fatigueRate * dt);
  } else if ((!holding || f.guardBroken) && f.guardDelay <= 0 && resting(f)) {
    f.guard = Math.min(DEFENSE_RULES.max, f.guard + DEFENSE_RULES.recoveryRate * dt);
    if (f.guardBroken && f.guard >= DEFENSE_RULES.unlockAt) f.guardBroken = false;
  }
}

export function guardCost(a) {
  if (a.isUlt) return 45;
  if (a.isKiBlast) return a.kiCost > 5 ? 18 : 6;
  if (a.projectile) return Math.min(30, Math.max(8, a.guardDamage ?? 18));
  if (a.chainType) return a.guardDamage ?? (a.chainType === 'light' ? 12 : 22);
  return Math.min(40, Math.max(12, a.guardDamage ?? 24));
}

export function blockDamageScale(a) {
  return a.isUlt ? 0.2 : a.projectile || a.isKiBlast ? 0.1 : 0;
}

export function defenseStatus(f) {
  if (f.state === 'guardbreak')
    return { state: 'broken', label: '破防', hint: '破防硬直，暂时无法格挡' };
  if (f.guardBroken) return { state: 'locked', label: '恢复', hint: '防御恢复到30%后可重新格挡' };
  if (f.guard <= DEFENSE_RULES.warning)
    return { state: 'low', label: '危险', hint: '防御不足，松开格挡并拉开距离恢复' };
  if (['block', 'blockstun'].includes(f.state))
    return { state: 'blocking', label: '格挡', hint: '持续举防会疲劳，近战格挡不扣生命' };
  if (f.guard < DEFENSE_RULES.max)
    return f.guardDelay <= 0 && resting(f)
      ? { state: 'recovering', label: '恢复', hint: '防御恢复中，每秒24点' }
      : { state: 'waiting', label: '待恢复', hint: '松开格挡，停止攻击并脱离受击后恢复' };
  return { state: 'ready', label: '就绪', hint: '按住格挡防御；下段攻击需要下蹲格挡' };
}
