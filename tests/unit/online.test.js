import test from 'node:test';
import assert from 'node:assert/strict';
import { command, roomList } from '../../workers/lobby.js';
import { decodeInput, encodeInput } from '../../src/online/input-codec.js';

const player = (id) => ({
  id,
  room: 0,
  seat: 0,
  character: 0,
  ready: false,
  map: 0,
  light: 'day',
  match: null,
});
const newMatch = () => ({ id: 'match-one', seed: 123 });

test('global room limit and two-player capacity are enforced by authoritative transitions', () => {
  const players = Array.from({ length: 7 }, (_, i) => player(String(i)));
  for (let room = 1; room <= 3; room++)
    assert.equal(
      command(players, players[room - 1], { type: 'create', room }, newMatch).changed,
      true,
    );
  assert.ok(command(players, players[3], { type: 'create', room: 4 }, newMatch).error);
  assert.ok(command(players, players[3], { type: 'create', room: 1 }, newMatch).error);
  assert.equal(command(players, players[3], { type: 'join', room: 1 }, newMatch).changed, true);
  assert.ok(command(players, players[4], { type: 'join', room: 1 }, newMatch).error);
  assert.equal(roomList(players).filter((r) => r.players.length).length, 3);
  assert.equal(players[4].room, 0);
});

test('both ready is required; selection clears readiness; a match starts exactly once', () => {
  const players = [player('a'), player('b')];
  command(players, players[0], { type: 'create', room: 1 }, newMatch);
  command(players, players[1], { type: 'join', room: 1 }, newMatch);
  command(
    players,
    players[0],
    { type: 'ready', ready: true, revision: players[0].revision },
    newMatch,
  );
  assert.equal(players[0].match, null);
  command(players, players[0], { type: 'select', character: 4 }, newMatch);
  assert.equal(players[0].ready, false);
  for (const p of players)
    command(players, p, { type: 'ready', ready: true, revision: p.revision }, newMatch);
  assert.deepEqual(
    players.map((p) => p.match),
    [newMatch(), newMatch()],
  );
  assert.ok(
    command(
      players,
      players[0],
      { type: 'ready', ready: true, revision: players[0].revision },
      () => {
        throw Error('duplicate match');
      },
    ).error,
  );
});

test('host departure promotes remaining player, cancels match, and last departure closes room', () => {
  const players = [player('a'), player('b')];
  command(players, players[0], { type: 'create', room: 2 }, newMatch);
  command(players, players[1], { type: 'join', room: 2 }, newMatch);
  for (const p of players)
    command(players, p, { type: 'ready', ready: true, revision: p.revision }, newMatch);
  command(players, players[0], { type: 'leave' }, newMatch);
  assert.equal(players[1].seat, 0);
  assert.equal(players[1].ready, false);
  assert.equal(players[1].match, null);
  command(players, players[1], { type: 'leave' }, newMatch);
  assert.equal(roomList(players)[1].players.length, 0);
});

test('invalid selection does not partially mutate character or ready state', () => {
  const players = [player('a')];
  command(players, players[0], { type: 'create', room: 1 }, newMatch);
  command(
    players,
    players[0],
    { type: 'ready', ready: true, revision: players[0].revision },
    newMatch,
  );
  const before = structuredClone(players[0]);
  assert.ok(
    command(players, players[0], { type: 'settings', light: 'moon', map: 99 }, newMatch).error,
  );
  assert.deepEqual(players[0], before);
});

test('input codec preserves every action edge and rejects malformed client payloads', () => {
  const input = {
    left: true,
    blastHeld: true,
    moveYaw: 1.25,
    actions: [
      { type: 'special', up: false, down: true },
      { type: 'heavy', up: true, down: false },
    ],
  };
  const result = decodeInput(encodeInput(input));
  assert.equal(result.left, true);
  assert.equal(result.blastHeld, true);
  assert.equal(result.moveYaw, input.moveYaw);
  assert.deepEqual(result.actions, input.actions);
  for (const bad of [
    null,
    [Infinity, 0, []],
    [0, NaN, []],
    [0, 0, [[99, 0, 0]]],
    [0, 0, Array(21).fill([1, 0, 0])],
  ])
    assert.throws(() => decodeInput(bad));
});

test('either player changes shared settings atomically and stale preparation is rejected', () => {
  const players = [player('a'), player('b')];
  command(players, players[0], { type: 'create', room: 1 }, newMatch);
  command(players, players[1], { type: 'join', room: 1 }, newMatch);
  const stale = players[0].revision;
  command(players, players[0], { type: 'ready', ready: true, revision: stale }, newMatch);
  command(
    players,
    players[1],
    { type: 'settings', map: 2, light: 'moon', rule: 'competitive', ringOut: true },
    newMatch,
  );
  for (const p of players) {
    assert.deepEqual(
      [p.map, p.light, p.rule, p.ringOut, p.ready],
      [2, 'moon', 'competitive', true, false],
    );
  }
  assert.ok(
    command(players, players[0], { type: 'ready', ready: true, revision: stale }, newMatch).error,
  );
  assert.equal(command(players, players[0], { type: 'settings', map: 2 }, newMatch).changed, false);
  command(players, players[0], { type: 'settings', map: 0 }, newMatch);
  assert.equal(players[1].map, 0);
  for (const p of players)
    command(players, p, { type: 'ready', ready: true, revision: p.revision }, newMatch);
  assert.deepEqual(roomList(players)[0].match, newMatch());
});
