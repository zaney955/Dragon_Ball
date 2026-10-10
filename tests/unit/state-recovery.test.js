import test from 'node:test';
import assert from 'node:assert/strict';
import { StateRecovery } from '../../src/online/state-recovery.js';
import { stateCodec } from '../../src/combat/state-codec.js';
import { battleStateDigest } from '../../src/combat/battle-state.js';
import { command, roomList } from '../../workers/lobby.js';

test('state graph preserves aliases, cycles, sets and registered identities over JSON', () => {
  const actor = {},
    codec = stateCodec(new Map([['actor', actor]]));
  const attack = { targets: new Set([actor]), cooldown: Infinity, unset: undefined };
  const value = { actor, attack, projectile: { source: attack }, seeds: new Map([[actor, 17]]) };
  value.self = value;
  const decoded = codec.decode(JSON.parse(JSON.stringify(codec.encode(value))));
  assert.equal(decoded.self, decoded);
  assert.equal(decoded.projectile.source, decoded.attack);
  assert.equal(decoded.actor, actor);
  assert.equal(decoded.attack.targets.has(actor), true);
  assert.equal(decoded.seeds.get(actor), 17);
  assert.equal(decoded.attack.cooldown, Infinity);
  assert.throws(() =>
    codec.decode({ root: { node: 0 }, nodes: [{ type: 'Object', data: [['__proto__', null]] }] }),
  );
  assert.throws(() => codec.decode({ root: { external: 'unknown' }, nodes: [] }));
});

test('full-state transfer resumes only after chunk order, load and digest confirmation', () => {
  const queue = [],
    failures = [],
    snapshot = { actors: [], state: { text: 'x'.repeat(37000) } };
  let restored,
    guestSequence = 0;
  const create = (host) =>
    new StateRecovery({
      host: () => host,
      send: (p) => {
        queue.push([!host, p]);
        return true;
      },
      capture: () => snapshot,
      digest: battleStateDigest,
      restore: (s) => {
        restored = s;
        return battleStateDigest(s);
      },
      sequence: () => (host ? 17 : guestSequence),
      setSequence: (n) => {
        guestSequence = n;
      },
      clearInput: () => {},
      trace: () => {},
      notify: () => {},
      fail: (m) => failures.push(m),
    });
  const host = create(true),
    guest = create(false);
  guest.request('checkpoint mismatch', 100);
  const drain = (now) => {
    while (queue.length) {
      const [toHost, p] = queue.shift();
      (toHost ? host : guest).receive(p, now);
    }
  };
  drain(110);
  assert.equal(host.paused && guest.paused, true);
  for (let n = 0; n < 6; n++) {
    host.pump(120 + n * 30);
    drain(120 + n * 30);
  }
  assert.equal(host.paused || guest.paused, false);
  assert.deepEqual(restored, snapshot);
  assert.equal(guestSequence, 17);
  assert.deepEqual(failures, []);
  guest.request('again', 500);
  guest.receive(
    { kind: 'state-chunk', id: 2, total: 2, index: 1, sequence: 18, hash: '12345678', text: '{}' },
    510,
  );
  assert.equal(failures.length, 1);
});

test('series scores are idempotent, require two rematch votes and survive character changes', () => {
  const players = ['a', 'b'].map((id) => ({
    id,
    room: 0,
    seat: 0,
    character: 0,
    map: 0,
    light: 'day',
    match: null,
  }));
  let id = 0;
  const run = (seat, message) =>
    command(players, players[seat], message, () => ({ id: String(++id), seed: 17 }));
  run(0, { type: 'create', room: 1 });
  run(1, { type: 'join', room: 1 });
  for (const seat of [0, 1])
    run(seat, { type: 'ready', ready: true, revision: players[seat].revision });
  for (let n = 0; n < 2; n++) run(0, { type: 'ended', match: '1', winner: 0 });
  assert.deepEqual(roomList(players)[0].series.scores, [1, 0]);
  assert.ok(run(0, { type: 'playing', match: '1' }).error);
  run(0, { type: 'rematch', match: '1', ready: true });
  assert.equal(id, 1);
  run(0, { type: 'rematch', match: '1', ready: false });
  run(1, { type: 'rematch', match: '1', ready: true });
  assert.equal(id, 1);
  run(0, { type: 'rematch', match: '1', ready: true });
  assert.equal(id, 2);
  assert.ok(run(1, { type: 'rematch', match: '1', ready: true }).error);
  run(0, { type: 'finish', match: '2' });
  run(1, { type: 'select', character: 8 });
  assert.deepEqual(roomList(players)[0].series.scores, [1, 0]);
  run(0, { type: 'leave' });
  assert.deepEqual(roomList(players)[0].series.scores, [0, 0]);
});
