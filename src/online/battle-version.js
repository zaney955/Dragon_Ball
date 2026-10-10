import { NEUTRAL_BALANCE } from '../characters/neutral-balance.js';
import { YOUTH_PROFILES } from '../characters/youth-profiles.js';
import { DEFENSE_RULES } from '../combat/defense-rules.js';

export const BATTLE_PROTOCOL = 3;
// Increment when simulation behavior changes; data edits also change the fingerprint.
const simulationRevision =
  'neutral-confirm-armor-recovery-ogre-spacing-control-stun-floor-fullstate-5';
let fingerprint = 2166136261;
for (const char of JSON.stringify([
  simulationRevision,
  NEUTRAL_BALANCE,
  YOUTH_PROFILES,
  DEFENSE_RULES,
]))
  fingerprint = Math.imul(fingerprint ^ char.charCodeAt(0), 16777619) >>> 0;
export const BATTLE_RULESET = fingerprint.toString(16);
export function compatibleBattle(packet) {
  return packet?.protocol === BATTLE_PROTOCOL && packet?.ruleset === BATTLE_RULESET;
}
