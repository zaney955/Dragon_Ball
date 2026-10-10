import test from 'node:test';
import assert from 'node:assert/strict';
import { OnlineTransport } from '../../src/online/transport.js';
import { OrderedDelivery } from '../../src/online/delivery.js';

function pair(t) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  let now = 0;
  t.mock.method(performance, 'now', () => now);
  const queues = [],
    received = [[], []],
    errors = [];
  const endpoints = [0, 1].map(
    (i) =>
      new OnlineTransport({
        onPacket: (packet) => received[i].push(packet),
        onState() {},
        onStatus() {},
        onError: (error) => errors.push(error),
      }),
  );
  endpoints.forEach((endpoint, i) => {
    endpoint.ws = {
      readyState: 1,
      bufferedAmount: 0,
      send(raw) {
        const message = JSON.parse(raw);
        queues.push({ path: 'relay', to: 1 - i, match: message.match, packet: message.packet });
      },
    };
    endpoint.attachChannel({
      readyState: 'open',
      bufferedAmount: 0,
      close() {},
      send(raw) {
        queues.push({ path: 'direct', to: 1 - i, ...JSON.parse(raw) });
      },
    });
    endpoint.match = 'match-1';
  });
  t.after(() =>
    endpoints.forEach((endpoint) => {
      endpoint.match = null;
    }),
  );
  function deliver(message) {
    endpoints[message.to].channel.onmessage({
      data: JSON.stringify({ match: message.match, packet: message.packet }),
    });
  }
  function drain() {
    for (let count = 0; queues.length && count < 1000; count++) deliver(queues.shift());
    assert.equal(queues.length, 0, 'protocol does not create an acknowledgement loop');
  }
  function advance(ms) {
    now += ms;
    t.mock.timers.tick(ms);
    drain();
  }
  return { endpoints, queues, received, errors, deliver, drain, advance };
}

test('switching away from a congested direct path recovers older frames before newer frames', (t) => {
  const {
    endpoints: [host],
    queues,
    received,
    errors,
    deliver,
    drain,
    advance,
  } = pair(t);
  host.packet({ kind: 'frames', seq: 1 });
  const delayed = queues.shift();
  host.channel.bufferedAmount = 65536;
  host.packet({ kind: 'frames', seq: 2 });
  drain();
  advance(300);
  assert.deepEqual(
    received[1].map((packet) => packet.seq),
    [1, 2],
  );
  deliver(delayed);
  advance(300);
  assert.deepEqual(
    received[1].map((packet) => packet.seq),
    [1, 2],
    'late old-path frame is ignored',
  );
  assert.deepEqual(errors, []);
});

test('replayed inputs execute each action once and cannot restore a released held key', (t) => {
  const {
    endpoints: [, guest],
    queues,
    received,
    deliver,
    drain,
    advance,
  } = pair(t);
  guest.packet({ kind: 'input', data: [1, 0, [[0, 0, 0]]], at: 0 });
  const delayed = queues.shift();
  guest.channel.bufferedAmount = 65536;
  guest.packet({ kind: 'input', data: [0, 0, []], at: 10 });
  drain();
  advance(300);
  deliver(delayed);
  deliver(delayed);
  advance(300);
  assert.deepEqual(
    received[0].map((p) => p.data[0]),
    [1, 0],
  );
  assert.equal(received[0].flatMap((p) => p.data[2]).length, 1);
});

test('a throwing channel and temporarily blocked socket retain accepted packets for recovery', (t) => {
  const {
    endpoints: [host],
    received,
    errors,
    advance,
  } = pair(t);
  host.channel.send = () => {
    throw new Error('closed during send');
  };
  const socketSend = host.ws.send;
  host.ws.send = () => {
    throw new Error('socket temporarily unavailable');
  };
  assert.equal(host.packet({ kind: 'frames', seq: 1 }), true);
  advance(100);
  assert.deepEqual(received[1], []);
  host.ws.send = socketSend;
  advance(300);
  assert.deepEqual(
    received[1].map((p) => p.seq),
    [1],
  );
  assert.deepEqual(errors, []);
});

test('missing receipts on a silently stalled direct path trigger bounded relay recovery', (t) => {
  const {
    endpoints: [host],
    queues,
    received,
    errors,
    advance,
  } = pair(t);
  host.channel.send = () => {};
  host.packet({ kind: 'frames', seq: 1 });
  for (let i = 0; i < 10; i++) advance(100);
  assert.equal(host.forceRelay, true);
  assert.deepEqual(
    received[1].map((p) => p.seq),
    [1],
  );
  assert.deepEqual(errors, []);
  assert.equal(queues.length, 0);
});

test('lost receipts cause harmless replay and eventually release the sender history', (t) => {
  const {
    endpoints: [host, guest],
    queues,
    received,
    deliver,
    advance,
  } = pair(t);
  const send = guest.channel.send;
  let dropReceipt = true;
  guest.channel.send = (raw) => {
    if (dropReceipt && JSON.parse(raw).packet.kind === 'receipt') {
      dropReceipt = false;
      return;
    }
    send(raw);
  };
  host.packet({ kind: 'frames', seq: 1 });
  deliver(queues.shift());
  advance(100);
  assert.equal(host.delivery.pending.size, 1);
  advance(300);
  assert.deepEqual(
    received[1].map((p) => p.seq),
    [1],
  );
  advance(100);
  assert.equal(host.delivery.pending.size, 0);
});

test('a new match discards old queued packets and starts an independent sequence', (t) => {
  const { endpoints, queues, received, deliver, drain } = pair(t);
  endpoints[0].packet({ kind: 'frames', seq: 99 });
  const old = queues.shift();
  for (const endpoint of endpoints) endpoint.match = 'match-2';
  deliver(old);
  endpoints[0].packet({ kind: 'frames', seq: 1 });
  drain();
  assert.deepEqual(
    received[1].map((p) => p.seq),
    [1],
  );
});

test('unrecoverable backlog ends explicitly instead of silently dropping frames', (t) => {
  const {
    endpoints: [host],
    errors,
  } = pair(t);
  host.channel.send = () => {};
  for (let seq = 1; seq <= 256; seq++) assert.equal(host.packet({ kind: 'frames', seq }), true);
  assert.equal(host.packet({ kind: 'frames', seq: 257 }), false);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /恢复窗口/);
  assert.equal(host.delivery.pending.size, 0);
});

test('both directions preserve exact application order under burst loss, duplication and reordering', (t) => {
  const {
    endpoints: [host, guest],
    received,
    errors,
    advance,
  } = pair(t);
  for (const endpoint of [host, guest]) {
    for (const connection of [endpoint.channel, endpoint.ws]) {
      const send = connection.send;
      let count = 0;
      connection.send = (raw) => {
        const n = ++count;
        if (n % 7 === 0 || n % 7 === 1) return;
        setTimeout(() => send(raw), (n % 4) * 25);
        if (n % 11 === 0) setTimeout(() => send(raw), 125);
      };
    }
  }
  for (let seq = 1; seq <= 60; seq++) {
    host.packet({ kind: 'frames', seq });
    guest.packet({ kind: 'input', actionId: seq });
    advance(25);
  }
  for (let i = 0; i < 30; i++) advance(100);
  assert.deepEqual(
    received[1].map((p) => p.seq),
    Array.from({ length: 60 }, (_, i) => i + 1),
  );
  assert.deepEqual(
    received[0].map((p) => p.actionId),
    Array.from({ length: 60 }, (_, i) => i + 1),
  );
  assert.equal(host.delivery.pending.size + guest.delivery.pending.size, 0);
  assert.deepEqual(errors, []);
});

test('an unacknowledged final packet times out even when no more game frames are generated', (t) => {
  const {
    endpoints: [host],
    errors,
    advance,
  } = pair(t);
  host.channel.send = host.ws.send = () => {};
  host.packet({ kind: 'frames', seq: 1 });
  for (let i = 0; i < 101; i++) advance(100);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /长时间未确认/);
  assert.equal(host.delivery.pending.size, 0);
});

test('malformed recovery and impossible receipts fail without unbounded allocation', (t) => {
  const {
    endpoints: [host],
    errors,
  } = pair(t);
  host.receivePacket({
    kind: 'recovery',
    delivery: { version: 1, ack: 0, epoch: 1 },
    packets: [null],
  });
  assert.equal(errors.length, 1);
  host.match = 'another-match';
  host.receivePacket({ kind: 'receipt', delivery: { version: 1, ack: 1000000, epoch: 1 } });
  assert.equal(errors.length, 2);
  assert.equal(host.delivery.incoming.size, 0);
});

test('setup receipts are sent before expensive application initialization blocks the peer', () => {
  const seen = [];
  const stream = new OrderedDelivery({
    write: (p) => {
      seen.push(p.kind);
      return true;
    },
    deliver: () => seen.push('construct-battle'),
    fail: assert.fail,
    epoch: () => 0,
  });
  stream.receive({ kind: 'begin', delivery: { version: 1, seq: 1, ack: 0, epoch: 0 } }, 1);
  assert.deepEqual(seen, ['receipt', 'construct-battle']);
});
