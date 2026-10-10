import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSpectator } from '../../src/online/spectator.js';
import { StateRecovery } from '../../src/online/state-recovery.js';
import { OnlineTransport } from '../../src/online/transport.js';
import { OrderedDelivery, validDelivery } from '../../src/online/delivery.js';
import { SpectatorFlow } from '../../workers/spectator-flow.js';
import { validSpectatorFrame } from '../../src/online/spectator-codec.js';
import { spectatorFixture } from '../fixtures/spectator.js';

function publisher({ count = 0, effect } = {}) {
  const published = [];
  const actor = () => {
    const f = spectatorFixture().fighters[0];
    return {
      ...f.props,
      pos: new THREE.Vector3(),
      previousPos: new THREE.Vector3(),
      v2: {},
      vel: new THREE.Vector3(),
      root: new THREE.Group(),
      parts: {},
      youth: { ...f },
      attack: null,
    };
  };
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  mesh.position.set(12.3456, 0.1234, 23.4567);
  const map = {
    group: new THREE.Group(),
    senzuTime: 0,
    senzuNextSpawn: 25,
    senzuSpawnCount: 0,
    senzus: [],
    destructibles: Array.from({ length: count }, (_, i) => ({
      broken: false,
      stage: 1,
      hp: 10.1234,
      mesh,
      rubble: true,
      id: i,
    })),
  };
  const online = {
    active: true,
    host: true,
    room: { id: 1, spectators: 1, match: { id: 'm' } },
    command: (m) => {
      published.push(m);
      return true;
    },
    transport: { canSendSpectator: () => true },
  };
  const match = {
    player: actor(),
    enemy: actor(),
    game: { timeLeft: 90, ready: 0, over: false, simTime: 1 },
  };
  const spectator = createSpectator({
    online,
    animation: {},
    combat: { youthEntities: [], v2Projectiles: [] },
    match,
    render: {
      scene: new THREE.Scene(),
      ultimateVisuals: [],
      effects: effect ? [{ mesh: effect }] : [],
      updateFightCamera() {},
    },
    world: { currentMap: map },
  });
  return { spectator, published, online, map, match };
}

test('damaged stage snapshots never exceed the socket bound or disconnect the host', () => {
  const { spectator, published } = publisher({ count: 900 });
  spectator.publish(1000);
  assert.equal(
    published.length,
    1,
    'viewer must receive a first frame even after extensive damage',
  );
  assert.ok(
    JSON.stringify(published[0]).length < 49152,
    'spectating must not send an oversized message through the host battle socket',
  );
});

test('unsupported decorative geometry cannot freeze the entire spectator stream', () => {
  const effect = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 8), new THREE.MeshBasicMaterial());
  const { spectator, published } = publisher({ effect });
  spectator.publish(1000);
  assert.equal(
    published.length,
    1,
    'combat snapshots remain available while an unsupported visual is active',
  );
});

test('spectator traffic yields to an already queued battle socket', () => {
  let sends = 0;
  const transport = new OnlineTransport({});
  transport.ws = {
    readyState: 1,
    bufferedAmount: 64000,
    send() {
      sends++;
    },
  };
  assert.equal(transport.send({ type: 'spectator-frame', frame: spectatorFixture() }), false);
  assert.equal(sends, 0, 'old spectator pictures must not extend battle input backlog');
});

test('healthy high latency does not repeatedly resend the same reliable stream before acknowledgements', () => {
  const queued = [],
    received = [],
    errors = [];
  let now = 0,
    transmissions = 0;
  const ends = [0, 1].map(
    (i) =>
      new OrderedDelivery({
        epoch: () => 0,
        fail: (m) => errors.push(m),
        deliver: (p) => received.push(p),
        write: (p) => {
          transmissions++;
          queued.push({ to: 1 - i, at: now + 300, packet: structuredClone(p) });
          return true;
        },
      }),
  );
  let sent = 0;
  for (now = 0; now < 8000; now += 10) {
    if (now % 50 === 0 && now < 6000) {
      ends[0].send({ kind: 'frames', seq: ++sent }, now);
    }
    for (let i = queued.length - 1; i >= 0; i--)
      if (queued[i].at <= now) {
        const item = queued.splice(i, 1)[0];
        ends[item.to].receive(item.packet, now);
      }
    ends.forEach((e) => e.pump(now));
  }
  assert.deepEqual(errors, []);
  assert.equal(received.length, sent);
  assert.ok(
    ends[0].stats.retransmitted === 0,
    `no-loss 600ms RTT amplified ${sent} packets with ${ends[0].stats.retransmitted} retransmissions (${transmissions} writes)`,
  );
});

test('bounded rotating pages eventually include every damaged world object', () => {
  const { spectator, published } = publisher({ count: 1800 });
  for (let now = 1000; now < 4000; now += 100) spectator.publish(now);
  const ids = new Set();
  for (const { frame } of published) {
    assert.ok(validSpectatorFrame(frame));
    assert.ok(JSON.stringify(frame).length <= 24000);
    frame.world.damaged.forEach(([id]) => ids.add(id));
  }
  assert.equal(ids.size, 1800);
});

test('slow viewer receives latest poses without losing skipped world changes or accepting stale credit', () => {
  const flow = new SpectatorFlow(),
    sent = [];
  const offer = (seq) => {
    const frame = spectatorFixture();
    frame.seq = seq;
    frame.world.broken = [[seq, [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0], 0xffffff]];
    flow.offer('m', frame, (f) => {
      sent.push(f);
      return true;
    });
  };
  offer(1);
  for (let seq = 2; seq <= 10; seq++) offer(seq);
  assert.equal(sent.length, 1);
  flow.acknowledge('old-match', 1);
  offer(11);
  assert.equal(sent.length, 1);
  flow.acknowledge('m', 1);
  offer(12);
  assert.equal(sent.at(-1).seq, 12);
  assert.deepEqual(
    sent.at(-1).world.broken.map(([id]) => id),
    Array.from({ length: 11 }, (_, i) => i + 2),
  );
  assert.equal(flow.world.size, 0);
  flow.acknowledge('m', 1);
  offer(13);
  assert.equal(sent.length, 2);
});

test('spectator applies a burst once per render, preserving world deltas and retrying unsent credit', () => {
  const { spectator, online, map, match, published } = publisher({ count: 3 });
  online.spectating = true;
  const message = (seq) => {
    const frame = spectatorFixture();
    frame.seq = seq;
    frame.flow = true;
    frame.fighters[0].pos = [seq, 0, 0];
    frame.world.broken = [[seq - 1, [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0], 0xffffff]];
    spectator.receive({ room: 1, match: 'm', frame });
  };
  message(1);
  message(2);
  message(3);
  assert.equal(spectator.stats.applied, 0);
  assert.equal(published.length, 0);
  const send = online.command;
  online.command = () => false;
  spectator.update(performance.now(), 1 / 60);
  assert.equal(spectator.stats.applied, 1);
  assert.equal(spectator.stats.coalesced, 2);
  assert.equal(match.player.pos.x, 3);
  assert.ok(map.destructibles.every((item) => item.broken));
  online.command = send;
  spectator.update(performance.now(), 1 / 60);
  assert.deepEqual(published, [{ type: 'spectator-ack', match: 'm', seq: 3 }]);
  spectator.update(performance.now(), 1 / 60);
  assert.equal(published.length, 1);
});

test('server bounds accumulated world pages and eventually drains all skipped damage', () => {
  const flow = new SpectatorFlow(),
    covered = new Set();
  const frame = spectatorFixture();
  frame.world.broken = Array.from({ length: 1800 }, (_, i) => [
    i,
    [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
    0xffffff,
  ]);
  for (let seq = 1; seq <= 10; seq++) {
    frame.seq = seq;
    flow.offer('m', frame, (next) => {
      assert.ok(JSON.stringify(next).length <= 32000);
      assert.ok(validSpectatorFrame(next));
      next.world.broken.forEach(([id]) => covered.add(id));
      return true;
    });
    flow.acknowledge('m', seq);
    frame.world.broken = [];
  }
  assert.equal(covered.size, 1800);
  assert.equal(flow.world.size, 0);
});

test('selective missing ranges reject duplicate, unsorted, excessive and out-of-window requests', () => {
  const packet = { kind: 'receipt', delivery: { version: 1, ack: 5, epoch: 1, want: 6 } };
  assert.equal(
    validDelivery({ ...packet, delivery: { ...packet.delivery, gaps: [6, 7, 9] } }),
    true,
  );
  for (const gaps of [
    [],
    [6, 6],
    [6, 5],
    [7],
    Array.from({ length: 17 }, (_, i) => i + 6),
    [6, 262],
  ])
    assert.equal(validDelivery({ ...packet, delivery: { ...packet.delivery, gaps } }), false);
});

test('setup receipt never asks for an already buffered record while a later hole remains', () => {
  const written = [];
  const stream = new OrderedDelivery({
    write: (p) => {
      written.push(p);
      return true;
    },
    deliver() {},
    fail: assert.fail,
    epoch: () => 0,
  });
  stream.receive({ kind: 'frames', seq: 4, delivery: { version: 1, seq: 4, ack: 0, epoch: 0 } }, 0);
  stream.receive(
    {
      kind: 'recovery',
      packets: [
        { id: 1, packet: { kind: 'begin' } },
        { id: 2, packet: { kind: 'frames', seq: 2 } },
      ],
      delivery: { version: 1, ack: 0, epoch: 0 },
    },
    10,
  );
  assert.ok(written.length > 0);
  assert.ok(written.every(validDelivery));
  assert.deepEqual(stream.metadata().gaps, [3]);
});

test('full state transfer waits for capacity on a 600 ms path instead of disconnecting', () => {
  let now = 0,
    restored = false,
    maxPending = 0;
  const queue = [],
    errors = [],
    snapshot = { payload: 'x'.repeat(1200000) };
  const streams = [0, 1].map(
    (i) =>
      new OrderedDelivery({
        epoch: () => 1,
        fail: (e) => errors.push(e),
        deliver: (p) => flows[i].receive(p, now),
        write: (p) => {
          queue.push({ to: 1 - i, at: now + 300, packet: structuredClone(p) });
          return true;
        },
      }),
  );
  const flows = [0, 1].map(
    (i) =>
      new StateRecovery({
        host: () => i === 0,
        send: (p) => streams[i].send(p, now),
        capture: () => snapshot,
        restore: (s) => {
          assert.deepEqual(s, snapshot);
          restored = true;
          return 'deadbeef';
        },
        digest: () => 'deadbeef',
        sequence: () => 10,
        setSequence() {},
        clearInput() {},
        notify() {},
        trace() {},
        fail: (e) => errors.push(e),
      }),
  );
  flows[1].request('test divergence', now);
  for (now = 0; now < 12000 && !errors.length; now += 10) {
    while (queue.length && queue[0].at <= now) {
      const e = queue.shift();
      streams[e.to].receive(e.packet, now);
    }
    streams.forEach((s) => s.pump(now));
    flows.forEach((f) => f.pump(now));
    maxPending = Math.max(maxPending, streams[0].pendingBytes);
  }
  assert.deepEqual(errors, []);
  assert.equal(restored, true);
  assert.ok(flows.every((f) => !f.paused));
  assert.ok(maxPending <= 512 * 1024);
});
