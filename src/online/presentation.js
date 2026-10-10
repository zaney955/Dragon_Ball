import { reverseDirectionalInput } from '../combat/attack-rules.js';

const movable = new Set(['idle', 'walk', 'crouch', 'block', 'charge', 'blastCharge']);

/** Predict display positions only. Authoritative fighter state is never changed. */
export class GuestPresentation {
  constructor({ fighters, mobility, bounds }) {
    Object.assign(this, { fighters, mobility, bounds });
    this.history = [{ at: -Infinity, input: {} }];
    this.delay = 0.03;
    this.anchorAt = performance.now();
    this.display = fighters.map((fighter) => fighter.pos.clone());
  }
  record(input, now) {
    this.history.push({ at: now, input });
    const action = input.actions?.find((action) => ['light', 'heavy'].includes(action.type));
    if (action) this.action = { ...action, at: now };
    while (this.history.length > 2 && this.history[1].at < now - 1000) this.history.shift();
  }
  snapshot(now, ack, age = 0) {
    if (ack && Number.isFinite(ack.at) && Number.isFinite(ack.processing)) {
      const rtt = now - ack.at - ack.processing;
      if (rtt >= 0 && rtt < 2000) this.delay = Math.min(0.2, rtt / 2000);
      this.confirmedAt = ack.at;
    }
    this.anchorAt = now - (this.delay + Math.min(0.1, Math.max(0, age))) * 1000;
  }
  update(now, dt, enabled) {
    const elapsed = enabled ? Math.min(0.25, Math.max(0, (now - this.anchorAt) / 1000)) : 0;
    const bounds = this.bounds();
    this.fighters.forEach((fighter, index) => {
      const position = fighter.pos.clone(),
        velocity = fighter.vel.clone();
      let walking = false;
      if (index === 1 && movable.has(fighter.state) && !fighter.attack && position.y < 0.1) {
        let historyIndex = 0;
        for (let time = 0; time < elapsed; time += 1 / 120) {
          const step = Math.min(1 / 120, elapsed - time),
            at = now - elapsed * 1000 + time * 1000;
          while (this.history[historyIndex + 1]?.at <= at) historyIndex++;
          const rawInput = this.history[historyIndex].input;
          const input =
            fighter.youth?.reversedTime > 0 ? reverseDirectionalInput(rawInput) : rawInput;
          let side = +!!input.right - +!!input.left,
            forward = +!!input.up - +!!input.down;
          const length = Math.hypot(side, forward),
            yaw = input.moveYaw ?? fighter.facingAngle;
          if (length) {
            side /= length;
            forward /= length;
          }
          const blocked = input.block || input.charge || input.blastHeld,
            speed = (input.crouch ? 2.7 : 6.8) * this.mobility(fighter),
            vx = blocked ? 0 : (-Math.cos(yaw) * side + Math.sin(yaw) * forward) * speed,
            vz = blocked ? 0 : (Math.sin(yaw) * side + Math.cos(yaw) * forward) * speed,
            response = 1 - Math.exp(-(length ? 40 : 46) * step);
          velocity.x += (vx - velocity.x) * response;
          velocity.z += (vz - velocity.z) * response;
          position.addScaledVector(velocity, step);
          walking = !!length && !blocked;
        }
      } else if (enabled && !['dead', 'knockdown'].includes(fighter.state)) {
        position.addScaledVector(velocity, Math.min(elapsed, 0.1));
      }
      position.x = Math.max(-bounds.x, Math.min(bounds.x, position.x));
      position.z = Math.max(-bounds.z, Math.min(bounds.z, position.z));
      position.y = Math.max(0, position.y);
      const display = this.display[index];
      if (!enabled || display.distanceTo(position) > 2) display.copy(position);
      else display.lerp(position, 1 - Math.exp(-60 * dt));
      fighter.onlineVisualPosition = display;
      fighter.onlineVisualWalk = walking;
      fighter.onlineVisualAction =
        enabled &&
        index === 1 &&
        !fighter.attack &&
        movable.has(fighter.state) &&
        !fighter.youth?.form &&
        this.action?.at > (this.confirmedAt ?? -Infinity) &&
        now - this.action.at < 200
          ? fighter.youth?.reversedTime > 0
            ? reverseDirectionalInput(this.action)
            : this.action
          : null;
    });
  }
  clear() {
    for (const fighter of this.fighters) {
      delete fighter.onlineVisualPosition;
      delete fighter.onlineVisualWalk;
      delete fighter.onlineVisualAction;
    }
  }
}
