import test from 'node:test';
import assert from 'node:assert/strict';
import { OnlineTransport } from '../../src/online/transport.js';
import { onRequestGet } from '../../functions/api/online.js';

test('a stalled lobby handshake times out, allows retry and cancels the timer on room state', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const original = globalThis.WebSocket;
  t.after(() => {
    globalThis.WebSocket = original;
  });
  const sockets = [],
    errors = [],
    states = [];
  globalThis.WebSocket = class {
    static OPEN = 1;
    constructor() {
      this.readyState = 0;
      sockets.push(this);
    }
    close() {
      this.readyState = 3;
    }
    send() {}
  };
  const transport = new OnlineTransport({
    url: 'wss://example.test/api/online',
    onStatus() {},
    onError: (message) => errors.push(message),
    onState: (state) => states.push(state),
  });
  transport.connect();
  t.mock.timers.tick(10000);
  assert.deepEqual(errors, ['连接超时，请重试']);
  assert.equal(sockets[0].readyState, 3);
  assert.equal(transport.ws, null);
  assert.deepEqual(states, [{ you: null, rooms: [] }]);
  transport.connect();
  const socket = sockets[1];
  socket.readyState = 1;
  socket.onopen();
  socket.onmessage({ data: JSON.stringify({ type: 'state', you: 'player', rooms: [] }) });
  t.mock.timers.tick(10000);
  assert.equal(errors.length, 1);
  assert.equal(socket.readyState, 1);
  assert.equal(transport.stats.connections, 2);
  assert.equal(states.at(-1).you, 'player');
  transport.close();
});

test('same-origin Pages gateway rejects ordinary HTTP and cross-origin upgrades', () => {
  const url = 'https://example.test/api/online';
  assert.equal(onRequestGet({ request: new Request(url) }).status, 426);
  assert.equal(
    onRequestGet({
      request: new Request(url, {
        headers: { Upgrade: 'websocket', Origin: 'https://other.test' },
      }),
    }).status,
    403,
  );
  let requestedName, forwarded;
  const response = new Response('forwarded');
  const request = new Request(url, {
    headers: { Upgrade: 'websocket', Origin: 'https://example.test' },
  });
  const result = onRequestGet({
    request,
    env: {
      LOBBY: {
        getByName(name) {
          requestedName = name;
          return { fetch: (value) => ((forwarded = value), response) };
        },
      },
    },
  });
  assert.equal(result, response);
  assert.equal(forwarded, request);
  assert.equal(requestedName, 'three-room-lobby-v1');
});
