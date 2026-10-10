// Portable gameplay snapshots travel in bounded chunks on the existing ordered
// match stream. Both simulations pause until the guest validates the same digest.
// This repairs state divergence; it does not predict or roll back combat inputs.
export class StateRecovery {
  constructor({
    host,
    send,
    capture,
    restore,
    digest,
    sequence,
    setSequence,
    clearInput,
    notify,
    trace,
    fail,
  }) {
    Object.assign(this, {
      host,
      send,
      capture,
      restore,
      digest,
      sequence,
      setSequence,
      clearInput,
      notify,
      trace,
      fail,
    });
    this.serial = this.attempts = 0;
    this.pending = null;
  }
  get paused() {
    return !!this.pending;
  }
  request(reason, now) {
    if (this.host() || this.pending) return;
    if (++this.attempts > 2) return this.fail('模拟分歧反复出现，已返回房间');
    this.clearInput();
    this.pending = { at: now, waiting: true };
    this.trace('state-request', { reason, sequence: this.sequence() });
    this.notify('正在校验并恢复对战，请稍候');
    this.send({ kind: 'state-request', reason: String(reason).slice(0, 120) });
  }
  receive(packet, now) {
    if (!packet.kind.startsWith('state-')) return false;
    try {
      if (packet.kind === 'state-request' && this.host() && !this.pending) {
        if (++this.attempts > 2) throw new Error('模拟分歧反复出现');
        this.clearInput();
        const snapshot = this.capture(),
          text = JSON.stringify(snapshot);
        if (text.length > 2000000) throw new Error('完整状态超过恢复容量');
        this.pending = {
          at: now,
          id: ++this.serial,
          text,
          index: 0,
          total: Math.ceil(text.length / 12000),
          hash: this.digest(snapshot),
          sequence: this.sequence(),
          next: now,
        };
        this.notify('正在向对手恢复对战状态');
        this.trace('state-captured', { bytes: text.length, sequence: this.sequence() });
      } else if (packet.kind === 'state-chunk' && !this.host()) {
        if (
          !this.pending ||
          !Number.isSafeInteger(packet.id) ||
          packet.id < 1 ||
          !Number.isInteger(packet.total) ||
          packet.total < 1 ||
          packet.total > 167 ||
          !Number.isInteger(packet.index) ||
          packet.index < 0 ||
          packet.index >= packet.total ||
          !Number.isSafeInteger(packet.sequence) ||
          packet.sequence < 0 ||
          typeof packet.text !== 'string' ||
          packet.text.length > 12000 ||
          !/^[0-9a-f]{8}$/.test(packet.hash)
        )
          throw new Error('恢复数据无效');
        if (this.pending.waiting)
          this.pending = {
            at: this.pending.at,
            id: packet.id,
            total: packet.total,
            sequence: packet.sequence,
            hash: packet.hash,
            chunks: [],
          };
        const p = this.pending;
        if (
          p.id !== packet.id ||
          p.total !== packet.total ||
          p.sequence !== packet.sequence ||
          p.hash !== packet.hash ||
          packet.index !== p.chunks.length
        )
          throw new Error('恢复片段顺序无效');
        p.chunks.push(packet.text);
        if (p.chunks.length === p.total) {
          const snapshot = JSON.parse(p.chunks.join(''));
          if (this.digest(snapshot) !== p.hash || this.restore(snapshot) !== p.hash)
            throw new Error('恢复后的完整状态校验失败');
          this.setSequence(p.sequence);
          delete p.chunks;
          this.trace('state-loaded', { sequence: p.sequence, duration: now - p.at });
          this.send({ kind: 'state-loaded', id: p.id, hash: p.hash });
        }
      } else if (packet.kind === 'state-loaded' && this.host()) {
        const p = this.pending;
        if (!p || packet.id !== p.id || packet.hash !== p.hash || p.index !== p.total)
          throw new Error('对手的恢复确认无效');
        this.send({ kind: 'state-resume', id: p.id });
        this.trace('state-resumed', { duration: now - p.at, sequence: p.sequence });
        this.pending = null;
        this.notify('对战已恢复');
      } else if (packet.kind === 'state-resume' && !this.host()) {
        if (
          !this.pending ||
          packet.id !== this.pending.id ||
          this.pending.chunks ||
          this.pending.waiting
        )
          throw new Error('恢复尚未完成');
        this.pending = null;
        this.notify('对战已恢复');
      } else throw new Error('恢复消息与当前阶段不符');
    } catch (error) {
      this.trace('state-recovery-error', { message: error.message });
      this.pending = null;
      this.fail(error.message + '，已返回房间');
    }
    return true;
  }
  pump(now) {
    const p = this.pending;
    if (!p) return;
    if (now - p.at > 12000) {
      this.pending = null;
      return this.fail('状态恢复超时，已返回房间');
    }
    if (!this.host() || p.index >= p.total || now < p.next) return;
    if (
      this.send({
        kind: 'state-chunk',
        id: p.id,
        sequence: p.sequence,
        hash: p.hash,
        index: p.index,
        total: p.total,
        text: p.text.slice(p.index * 12000, (p.index + 1) * 12000),
      })
    ) {
      p.index++;
      p.next = now + 20;
    }
  }
}
