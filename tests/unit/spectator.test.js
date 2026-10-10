import test from 'node:test';
import assert from 'node:assert/strict';
import { command, roomList } from '../../workers/lobby.js';
import { validSpectatorFrame } from '../../src/online/spectator-codec.js';

import { spectatorFixture } from '../fixtures/spectator.js';

function room() {
  const sessions = ['host', 'guest', 'viewer', 'viewer2'].map((id) => ({
    id,
    room: 0,
    watching: 0,
    seat: 0,
    character: 0,
    ready: false,
    match: null,
  }));
  const send = (i, message) =>
    command(sessions, sessions[i], message, () => ({ id: 'match', seed: 123 }));
  send(0, { type: 'create', room: 1 });
  send(1, { type: 'join', room: 1 });
  return { sessions, send };
}

test('spectating requires two players actually fighting, not merely connecting', () => {
  const { sessions, send } = room();
  assert.ok(send(2, { type: 'watch', room: 1 }).error);
  for (const i of [0, 1]) send(i, { type: 'ready', ready: true, revision: sessions[i].revision });
  assert.ok(send(2, { type: 'watch', room: 1 }).error);
  assert.ok(send(1, { type: 'playing', match: 'match' }).error);
  assert.ok(send(0, { type: 'playing', match: 'stale' }).error);
  assert.ok(send(0, { type: 'playing', match: 'match' }).changed);
  assert.ok(send(2, { type: 'watch', room: 1 }).changed);
  assert.ok(send(3, { type: 'watch', room: 1 }).changed);
  assert.equal(roomList(sessions)[0].players.length, 2);
  assert.equal(roomList(sessions)[0].spectators, 2);
  assert.equal(sessions[2].room, 0);
  assert.ok(send(0, { type: 'watch', room: 1 }).error);
  assert.ok(send(2, { type: 'watch', room: 2 }).error);
});

test('spectators cannot change combat, preparation or settings; leaving preserves the match', () => {
  const { sessions, send } = room();
  for (const i of [0, 1]) send(i, { type: 'ready', ready: true, revision: sessions[i].revision });
  send(0, { type: 'playing', match: 'match' });
  send(2, { type: 'watch', room: 1 });
  const before = structuredClone(sessions.slice(0, 2));
  for (const message of [
    { type: 'select', character: 1 },
    { type: 'settings', map: 1 },
    { type: 'ready', ready: false },
    { type: 'finish', match: 'match' },
    { type: 'ended', match: 'match' },
  ])
    assert.ok(send(2, message).error);
  send(2, { type: 'unwatch' });
  assert.equal(sessions[2].watching, 0);
  send(2, { type: 'watch', room: 1 });
  send(2, { type: 'leave' });
  assert.deepEqual(sessions.slice(0, 2), before);
  assert.equal(roomList(sessions)[0].spectators, 0);
  send(0, { type: 'ended', match: 'match' });
  assert.ok(send(2, { type: 'watch', room: 1 }).error);
  assert.equal(sessions[0].match.id, 'match');
});

test('spectator snapshots reject unsafe, malformed and excessive geometry before rendering', () => {
  assert.ok(validSpectatorFrame(spectatorFixture()));
  const bad = [
    (f) => {
      f.fighters[0] = null;
    },
    (f) => {
      f.fighters[0].pos[0] = Infinity;
    },
    (f) => {
      f.fighters[0].props.execute = 'code';
    },
    (f) => {
      f.fighters[0].parts[0][1][7] = 1000;
    },
    (f) => {
      f.fighters[0].form = 'robot';
    },
    (f) => {
      f.objects[0] = null;
    },
    (f) => {
      f.objects[0].geometry = { type: 'IcosahedronGeometry', args: [1, 64] };
    },
    (f) => {
      f.objects[0].geometry.type = 'Unknown';
    },
    (f) => {
      f.objects[0].geometry.args[0] = -1;
    },
    (f) => {
      f.objects = Array(161).fill(f.objects[0]);
    },
  ];
  for (const mutate of bad) {
    const frame = spectatorFixture();
    mutate(frame);
    assert.equal(!!validSpectatorFrame(frame), false);
  }
});
