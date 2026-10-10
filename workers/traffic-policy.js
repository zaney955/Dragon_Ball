import { validDelivery } from '../src/online/delivery.js';

// Token buckets allow short bursts without giving control/spectator traffic an
// unlimited budget. Message count and UTF-8 bytes are independently bounded.
const LIMITS = {
  total: [180, 240],
  bytes: [768 * 1024, 1536 * 1024],
  battle: [90, 120],
  recovery: [72, 96],
  spectator: [12, 16],
  signal: [20, 40],
  control: [8, 16],
};

export class MessageBudget {
  constructor() {
    this.buckets = new Map();
  }
  allow(message, bytes, now) {
    const group =
      message.type === 'relay'
        ? ['receipt', 'recovery'].includes(message.packet?.kind)
          ? 'recovery'
          : 'battle'
        : message.type === 'spectator-frame'
          ? 'spectator'
          : message.type === 'signal'
            ? 'signal'
            : 'control';
    const charges = [
      ['total', 1],
      ['bytes', bytes],
      [group, 1],
    ];
    const updated = charges.map(([key, cost]) => {
      const [rate, capacity] = LIMITS[key];
      const old = this.buckets.get(key) ?? { at: now, tokens: capacity };
      const tokens = Math.min(capacity, old.tokens + (Math.max(0, now - old.at) * rate) / 1000);
      return { key, cost, tokens };
    });
    if (updated.some(({ tokens, cost }) => tokens < cost)) return false;
    for (const { key, tokens, cost } of updated)
      this.buckets.set(key, { at: now, tokens: tokens - cost });
    return true;
  }
}

function permittedApplication(packet, seat) {
  if (
    !packet ||
    ![
      'input',
      'frames',
      'begin',
      'ack',
      'return',
      'state-request',
      'state-chunk',
      'state-loaded',
      'state-resume',
    ].includes(packet.kind)
  )
    return false;
  if (['frames', 'begin', 'state-chunk', 'state-resume'].includes(packet.kind)) return seat === 0;
  if (['input', 'ack', 'state-request', 'state-loaded'].includes(packet.kind)) return seat === 1;
  return true;
}

export function validRelayPacket(packet, seat) {
  if (!packet) return false;
  if (packet.delivery && !validDelivery(packet)) return false;
  if (packet.kind === 'receipt') return !!packet.delivery;
  if (packet.kind === 'recovery')
    return (
      !!packet.delivery &&
      packet.packets.every(({ packet: nested }) => permittedApplication(nested, seat))
    );
  return permittedApplication(packet, seat);
}
