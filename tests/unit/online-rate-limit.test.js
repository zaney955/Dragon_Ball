import test from 'node:test';
import assert from 'node:assert/strict';
import { MessageBudget, validRelayPacket } from '../../workers/traffic-policy.js';

test('30 Hz battle, 10 Hz spectators and transport receipts share a connection without starvation', () => {
  const budget = new MessageBudget();
  for (let frame = 0; frame < 300; frame++) {
    const now = frame * (1000 / 30);
    assert.equal(budget.allow({ type: 'relay', packet: { kind: 'frames' } }, 2000, now), true);
    assert.equal(budget.allow({ type: 'relay', packet: { kind: 'receipt' } }, 120, now), true);
    if (frame % 3 === 0) assert.equal(budget.allow({ type: 'spectator-frame' }, 45000, now), true);
  }
});

test('separate control and byte budgets reject floods while allowing a short battle burst', () => {
  const burst = new MessageBudget();
  for (let i = 0; i < 100; i++)
    assert.equal(burst.allow({ type: 'relay', packet: { kind: 'input' } }, 200, 0), true);
  const controls = new MessageBudget();
  for (let i = 0; i < 16; i++) assert.equal(controls.allow({ type: 'ready' }, 100, 0), true);
  assert.equal(controls.allow({ type: 'ready' }, 100, 0), false);
  assert.equal(controls.allow({ type: 'ready' }, 100, 125), true);
  const bytes = new MessageBudget();
  let allowed = 0;
  while (bytes.allow({ type: 'relay', packet: { kind: 'frames' } }, 49000, 0)) allowed++;
  assert.ok(allowed > 0 && allowed < 40, 'byte ceiling applies before the message burst ceiling');
});

test('recovery envelopes cannot bypass player roles or smuggle nested recovery packets', () => {
  const recovery = {
    kind: 'recovery',
    delivery: { version: 1, ack: 0, epoch: 1 },
    packets: [{ id: 1, packet: { kind: 'frames', seq: 1 } }],
  };
  assert.equal(validRelayPacket(recovery, 0), true);
  assert.equal(validRelayPacket(recovery, 1), false);
  recovery.packets[0].packet = { kind: 'input', data: [0, 0, []] };
  assert.equal(validRelayPacket(recovery, 1), true);
  assert.equal(validRelayPacket(recovery, 0), false);
  recovery.packets[0].packet = { kind: 'recovery', packets: [] };
  assert.equal(validRelayPacket(recovery, 1), false);
  assert.equal(validRelayPacket({ kind: 'receipt' }, 1), false);
});

test('state recovery messages preserve host and guest roles through ordered retransmission', () => {
  for (const [kind, seat] of [
    ['state-request', 1],
    ['state-loaded', 1],
    ['state-chunk', 0],
    ['state-resume', 0],
  ]) {
    const packet = { kind, delivery: { version: 1, seq: 1, ack: 0, epoch: 1 } };
    assert.equal(validRelayPacket(packet, seat), true);
    assert.equal(validRelayPacket(packet, 1 - seat), false);
    const recovery = {
      kind: 'recovery',
      packets: [{ id: 1, packet: { kind } }],
      delivery: { version: 1, ack: 0, epoch: 1 },
    };
    assert.equal(validRelayPacket(recovery, seat), true);
    assert.equal(validRelayPacket(recovery, 1 - seat), false);
  }
});
