import { OrderedDelivery, validDelivery } from './delivery.js';

/** A single lobby socket; peer traffic uses WebRTC unless the connection is unavailable. */
export class OnlineTransport {
  constructor({
    url,
    onState,
    onPacket,
    onSpectatorFrame,
    onStatus,
    onError,
    onFailure,
    onDiagnostic,
  }) {
    Object.assign(this, {
      url,
      onState,
      onPacket,
      onSpectatorFrame,
      onStatus,
      onError,
      onFailure,
      onDiagnostic,
    });
    this.stats = {
      socketMessages: 0,
      relayMessages: 0,
      directMessages: 0,
      connections: 0,
      heartbeats: 0,
      controlMessages: 0,
      spectatorMessages: 0,
    };
    this.generation = 0;
    this.forceRelay = false;
  }
  get match() {
    return this.matchId;
  }
  set match(id) {
    if (id === this.matchId) return;
    clearInterval(this.deliveryTimer);
    this.delivery?.close();
    this.matchId = id;
    this.delivery = null;
    this.epoch = 0;
    this.forceRelay = false;
    if (!id) return;
    this.delivery = new OrderedDelivery({
      write: (packet) => this.writePacket(packet),
      deliver: (packet) => this.onPacket(packet),
      fail: (message) => (this.onFailure ?? this.onError)(message),
      epoch: () => this.epoch,
    });
    this.deliveryTimer = setInterval(() => this.pump(), 25);
  }
  connect() {
    if (this.ws && this.ws.readyState < 2) return;
    this.stats.connections++;
    this.onStatus('正在连接…');
    let socket,
      handshaken = false;
    try {
      socket = this.ws = new WebSocket(this.url);
    } catch {
      this.onError('无法建立联机连接，请重试');
      return;
    }
    const fail = (message) => {
      if (this.ws !== socket) return;
      this.onDiagnostic?.('socket-error', { message, state: socket.readyState });
      this.close();
      this.onState({ you: null, rooms: [] });
      this.onError(message);
    };
    this.connectTimeout = setTimeout(() => fail('连接超时，请重试'), 10000);
    socket.onopen = () => {
      this.heartbeat = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.stats.heartbeats++;
          this.ws.send('ping');
        }
      }, 45000);
    };
    socket.onmessage = async ({ data }) => {
      if (data === 'pong') return;
      try {
        const message = JSON.parse(data);
        if (message.type === 'state') {
          clearTimeout(this.connectTimeout);
          if (!handshaken) this.onStatus('已连接');
          handshaken = true;
          this.onState(message);
        }
        if (message.type === 'error') this.onError(message.message);
        if (message.type === 'peer' && message.match === this.match)
          this.receivePacket(message.packet);
        if (message.type === 'signal') await this.signal(message);
        if (message.type === 'spectator-frame') this.onSpectatorFrame?.(message);
      } catch (error) {
        this.onError('连接协商失败：' + error.message);
      }
    };
    socket.onclose = (event) => {
      if (this.ws !== socket) return;
      this.onDiagnostic?.('socket-closed', {
        code: event?.code,
        reason: event?.reason,
        clean: event?.wasClean,
        queuedBytes: socket.bufferedAmount,
        pending: this.delivery?.pending.size,
        delivery: this.delivery ? { ...this.delivery.stats } : null,
      });
      clearTimeout(this.connectTimeout);
      clearInterval(this.heartbeat);
      this.resetPeer();
      this.onStatus('连接已断开，请重新进入大厅');
      this.onState({ you: null, rooms: [] });
    };
    socket.onerror = () => fail('暂时无法连接联机服务，请重试');
  }
  canSendSpectator() {
    return this.ws?.readyState === WebSocket.OPEN && (this.ws.bufferedAmount ?? 0) < 8192;
  }
  send(data) {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    if (data.type === 'spectator-frame' && !this.canSendSpectator()) return false;
    this.stats.socketMessages++;
    if (!['signal', 'relay', 'spectator-frame'].includes(data.type)) this.stats.controlMessages++;
    if (data.type === 'spectator-frame') this.stats.spectatorMessages++;
    try {
      if (this.ws.bufferedAmount > 512 * 1024) return false;
      this.ws.send(JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }
  resetPeer() {
    this.generation++;
    this.channel?.close();
    this.pc?.close();
    this.channel = this.pc = null;
    this.peerKey = null;
    this.forceRelay = false;
    this.match = null;
    this.candidates = [];
  }
  async peer(key, host) {
    if (this.peerKey === key) return;
    this.resetPeer();
    this.peerKey = key;
    if (!globalThis.RTCPeerConnection) return;
    const pc = (this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
    }));
    pc.onicecandidate = ({ candidate }) => {
      if (pc === this.pc && candidate) this.send({ type: 'signal', candidate: candidate.toJSON() });
    };
    pc.ondatachannel = ({ channel }) => this.attachChannel(channel);
    if (host) {
      this.attachChannel(pc.createDataChannel('battle', { ordered: true }));
      await pc.setLocalDescription(await pc.createOffer());
      if (pc === this.pc) this.send({ type: 'signal', description: pc.localDescription.toJSON() });
    }
  }
  attachChannel(channel) {
    this.channel = channel;
    channel.onmessage = ({ data }) => {
      try {
        const { match, packet } = JSON.parse(data);
        if (match === this.match) this.receivePacket(packet);
      } catch {
        this.onError('对战数据无效');
      }
    };
  }
  async signal({ description, candidate }) {
    const pc = this.pc;
    if (!pc || pc.signalingState === 'closed') return;
    if (candidate) {
      if (pc.remoteDescription) await pc.addIceCandidate(candidate);
      else this.candidates.push(candidate);
      return;
    }
    await pc.setRemoteDescription(description);
    if (pc !== this.pc) return;
    for (const pending of this.candidates.splice(0)) await pc.addIceCandidate(pending);
    if (description.type === 'offer') {
      await pc.setLocalDescription(await pc.createAnswer());
      if (pc === this.pc) this.send({ type: 'signal', description: pc.localDescription.toJSON() });
    }
  }
  packet(packet) {
    if (!this.match || !this.delivery) return false;
    this.preparePath();
    const accepted = this.delivery.send(packet, performance.now());
    this.pump();
    return accepted;
  }
  useRelay(reason) {
    if (this.epoch === 1) return;
    this.forceRelay = true;
    this.epoch = 1;
    this.delivery?.retryAll();
    this.onDiagnostic?.('transport-switch', { reason, epoch: this.epoch });
  }
  preparePath() {
    if (this.forceRelay) this.useRelay('peer-or-local-fallback');
    else if (this.channel?.readyState !== 'open') this.useRelay('channel-unavailable');
    else if (this.channel.bufferedAmount >= 65536) this.useRelay('channel-backpressure');
    else {
      const oldest = this.delivery?.pending.values().next().value;
      if (
        oldest &&
        performance.now() - oldest.at >
          Math.max(1500, this.delivery.stats.rtt ? 2 * this.delivery.stats.rto : 0)
      )
        this.useRelay('receipt-timeout');
    }
  }
  writePacket(packet) {
    if (!this.match) return false;
    if (!this.forceRelay && this.channel?.readyState === 'open') {
      try {
        this.channel.send(JSON.stringify({ match: this.match, packet }));
        this.stats.directMessages++;
        return true;
      } catch {
        this.useRelay('channel-send-failed');
        return false;
      }
    }
    this.stats.relayMessages++;
    return this.send({ type: 'relay', match: this.match, packet });
  }
  receivePacket(packet) {
    if (!this.match || !this.delivery || !packet) return;
    // Old clients still receive the application's version-mismatch response.
    if (!packet.delivery) return this.onPacket(packet);
    if (validDelivery(packet) && packet.delivery.epoch === 1) this.useRelay('peer-fallback');
    this.delivery.receive(packet, performance.now());
  }
  pump() {
    if (!this.delivery) return;
    if (this.delivery.pending.size || this.delivery.ackPending) this.preparePath();
    this.delivery.pump(performance.now());
  }
  close() {
    clearTimeout(this.connectTimeout);
    clearInterval(this.heartbeat);
    this.resetPeer();
    if (this.ws) {
      this.ws.onopen = this.ws.onmessage = this.ws.onerror = this.ws.onclose = null;
      this.ws.close(1000, '离开大厅');
      this.ws = null;
    }
  }
}
