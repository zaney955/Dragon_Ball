// Shared by the authoritative simulation and the guest's presentation layer.
export function reverseDirectionalInput(input) {
  if (input.directionsMapped) return input;
  return {
    ...input,
    directionsMapped: true,
    up: !!input.down,
    down: !!input.up,
    left: !!input.right,
    right: !!input.left,
    actions: input.actions?.map((action) =>
      typeof action === 'string' ? action : { ...action, up: !!action.down, down: !!action.up },
    ),
  };
}

export function staffReach(attack, time) {
  const full = attack.range ?? 2;
  if (!attack.extendingStaff) return full;
  const resting = Math.min(1.4, full);
  const grow = Math.min(1, Math.max(0, time / Math.max(0.001, attack.hitT * 0.75)));
  const retract = Math.min(
    1,
    Math.max(0, (time - attack.hitT - attack.active) / Math.max(0.001, attack.recovery * 0.8)),
  );
  const smooth = (t) => t * t * (3 - 2 * t);
  return resting + (full - resting) * smooth(grow) * (1 - smooth(retract));
}
