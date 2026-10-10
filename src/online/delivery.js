// A match-scoped ordered stream spanning both DC and WS. Wire receipts are not
// combat-input acknowledgements: only session.js knows when an input was used.
const MAX_PACKETS = 256;
const MAX_BYTES = 512 * 1024;
const RETRY_MS = 250;
const MAX_AGE_MS = 10000;
const positive = (n) => Number.isSafeInteger(n) && n > 0;
const nonnegative = (n) => Number.isSafeInteger(n) && n >= 0;
const applicationKinds = new Set([
  'input',
  'frames',
  'begin',
  'ack',
  'return',
  'state-request',
  'state-chunk',
  'state-loaded',
  'state-resume',
]);

export function validDelivery(packet) {
  const d = packet?.delivery;
  if (!d || d.version !== 1 || !nonnegative(d.ack) || ![0, 1].includes(d.epoch)) return false;
  if (d.want !== undefined && (!positive(d.want) || d.want !== d.ack + 1)) return false;
  if (packet.kind === 'receipt') return d.seq === undefined;
  if (packet.kind === 'recovery')
    return (
      d.seq === undefined &&
      Array.isArray(packet.packets) &&
      packet.packets.length > 0 &&
      packet.packets.length <= 16 &&
      packet.packets.every(
        (entry) =>
          positive(entry?.id) && applicationKinds.has(entry.packet?.kind) && !entry.packet.delivery,
      )
    );
  return applicationKinds.has(packet.kind) && positive(d.seq);
}

export class OrderedDelivery {
  constructor({ write, deliver, fail, epoch }) {
    Object.assign(this, { write, deliver, fail, epoch });
    this.pending = new Map();
    this.incoming = new Map();
    this.next = 1;
    this.received = 0;
    this.pendingBytes = this.incomingBytes = 0;
    this.lastReceipt = this.lastRecovery = -Infinity;
    this.ackPending = false;
    this.closed = false;
    this.stats = { retransmitted: 0, duplicates: 0, reordered: 0, receipts: 0 };
  }
  metadata(seq) {
    return {
      version: 1,
      seq,
      ack: this.received,
      epoch: this.epoch(),
      ...(this.incoming.size ? { want: this.received + 1 } : {}),
    };
  }
  transmit(packet, now) {
    if (!this.write(packet)) return false;
    this.ackPending = false;
    this.lastReceipt = now;
    return true;
  }
  send(packet, now) {
    if (this.closed) return false;
    const json = JSON.stringify(packet),
      bytes = json.length * 2;
    if (
      json.length > 45000 ||
      this.pending.size >= MAX_PACKETS ||
      this.pendingBytes + bytes > MAX_BYTES
    ) {
      this.abort('网络积压超出恢复窗口，请重新准备');
      return false;
    }
    const id = this.next++;
    const entry = { packet: JSON.parse(json), bytes, at: now, sentAt: -Infinity };
    this.pending.set(id, entry);
    this.pendingBytes += bytes;
    if (this.transmit({ ...entry.packet, delivery: this.metadata(id) }, now)) entry.sentAt = now;
    return true; // Ownership transferred to the bounded retry queue, even if send failed.
  }
  retryAll() {
    for (const entry of this.pending.values()) entry.sentAt = -Infinity;
  }
  receive(packet, now) {
    if (this.closed) return;
    if (!validDelivery(packet) || packet.delivery.ack >= this.next) {
      this.abort('收到无效的联机确认数据，请重新准备');
      return;
    }
    const d = packet.delivery;
    for (const [id, entry] of this.pending) {
      if (id > d.ack) break;
      this.pending.delete(id);
      this.pendingBytes -= entry.bytes;
    }
    if (d.want && now - this.lastRecovery >= 50) this.retryAll();
    if (packet.kind === 'receipt') return;
    const entries =
      packet.kind === 'recovery'
        ? packet.packets
        : [
            {
              id: d.seq,
              packet: Object.fromEntries(Object.entries(packet).filter(([k]) => k !== 'delivery')),
            },
          ];
    for (const entry of entries) {
      const { id, packet: data } = entry;
      this.ackPending = true;
      if (id <= this.received || this.incoming.has(id)) {
        this.stats.duplicates++;
        continue;
      }
      const bytes = JSON.stringify(data).length * 2;
      if (id > this.received + MAX_PACKETS || this.incomingBytes + bytes > MAX_BYTES) {
        this.abort('联机缺帧超出恢复窗口，请重新准备');
        return;
      }
      if (id > this.received + 1) this.stats.reordered++;
      this.incoming.set(id, { packet: data, bytes });
      this.incomingBytes += bytes;
    }
    while (!this.closed && this.incoming.has(this.received + 1)) {
      const id = ++this.received,
        entry = this.incoming.get(id);
      this.incoming.delete(id);
      this.incomingBytes -= entry.bytes;
      // Receipt means this ordered stream owns the packet. Send it before
      // synchronous actor/map construction or the final snapshot load blocks
      // the event loop, which otherwise looks like a stalled healthy DC.
      if (
        ['begin', 'ack'].includes(entry.packet.kind) ||
        (entry.packet.kind === 'state-chunk' && entry.packet.index === entry.packet.total - 1)
      ) {
        this.transmit({ kind: 'receipt', delivery: this.metadata() }, now);
      }
      this.deliver(entry.packet);
    }
  }
  pump(now) {
    if (this.closed) return;
    const oldest = this.pending.values().next().value;
    if (oldest && now - oldest.at > MAX_AGE_MS) {
      this.abort('对手长时间未确认数据，请重新准备');
      return;
    }
    if (now - this.lastRecovery >= 25) {
      const entries = [];
      let size = 0;
      for (const [id, entry] of this.pending) {
        if (now - entry.sentAt < RETRY_MS) continue;
        if (entries.length && (entries.length >= 16 || size + entry.bytes > 28000)) break;
        entries.push({ id, packet: entry.packet });
        size += entry.bytes;
      }
      if (entries.length) {
        this.lastRecovery = now;
        if (this.transmit({ kind: 'recovery', packets: entries, delivery: this.metadata() }, now)) {
          for (const { id } of entries) {
            const entry = this.pending.get(id);
            if (entry) entry.sentAt = now;
          }
          this.stats.retransmitted += entries.length;
        }
      }
    }
    if (
      this.ackPending &&
      now - this.lastReceipt >= 50 &&
      this.transmit({ kind: 'receipt', delivery: this.metadata() }, now)
    )
      this.stats.receipts++;
  }
  abort(message) {
    if (this.closed) return;
    this.close();
    this.fail(message);
  }
  close() {
    this.closed = true;
    this.pending.clear();
    this.incoming.clear();
    this.pendingBytes = this.incomingBytes = 0;
  }
}
