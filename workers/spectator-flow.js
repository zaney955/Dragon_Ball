// Each modern viewer has one frame in flight. Unsent world changes are merged
// by object index, while obsolete poses/effects are discarded, not queued.
export class SpectatorFlow {
  constructor() {
    this.match = null;
    this.waiting = 0;
    this.world = new Map();
  }
  acknowledge(match, seq) {
    if (match === this.match && seq === this.waiting) this.waiting = 0;
  }
  offer(match, frame, send) {
    if (match !== this.match) {
      this.match = match;
      this.waiting = 0;
      this.world.clear();
    }
    for (const entry of frame.world.broken) this.world.set(entry[0], ['broken', entry]);
    for (const entry of frame.world.damaged ?? []) this.world.set(entry[0], ['damaged', entry]);
    if (this.waiting) return false;
    const next = {
      ...frame,
      flow: true,
      objects: [],
      world: { ...frame.world, broken: [], damaged: [] },
    };
    let size = JSON.stringify(next).length;
    if (size > 32000) return false;
    for (const object of frame.objects) {
      const cost = JSON.stringify(object).length + 1;
      if (size + cost > 24000) break;
      next.objects.push(object);
      size += cost;
    }
    const sent = [];
    for (const [index, [kind, entry]] of this.world) {
      const cost = JSON.stringify(entry).length + 1;
      if (size + cost > 32000) break;
      next.world[kind].push(entry);
      sent.push(index);
      size += cost;
    }
    if (!send(next)) return false;
    for (const index of sent) this.world.delete(index);
    this.waiting = frame.seq;
    return true;
  }
}
