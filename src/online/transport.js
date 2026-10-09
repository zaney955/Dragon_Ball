/** A single lobby socket; peer traffic uses WebRTC unless the connection is unavailable. */
export class OnlineTransport {
  constructor({ url, onState, onPacket, onStatus, onError }) {
    Object.assign(this, { url, onState, onPacket, onStatus, onError });
    this.stats = {
      socketMessages: 0,
      relayMessages: 0,
      directMessages: 0,
      connections: 0,
      heartbeats: 0,
      controlMessages: 0,
    };
    this.generation = 0;
    this.forceRelay = false;
  }
  connect() {
    if (this.ws && this.ws.readyState < 2) return;
    this.stats.connections++;
    this.onStatus('正在连接…');
    let socket;
    try {
      socket = this.ws = new WebSocket(this.url);
    } catch {
      this.onError('无法建立联机连接，请重试');
      return;
    }
    const fail = (message) => {
      if (this.ws !== socket) return;
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
          this.onStatus('已连接');
          this.onState(message);
        }
        if (message.type === 'error') this.onError(message.message);
        if (message.type === 'peer' && message.match === this.match) this.onPacket(message.packet);
        if (message.type === 'signal') await this.signal(message);
      } catch (error) {
        this.onError('连接协商失败：' + error.message);
      }
    };
    socket.onclose = () => {
      clearTimeout(this.connectTimeout);
      clearInterval(this.heartbeat);
      this.resetPeer();
      this.onStatus('连接已断开，请重新进入大厅');
      this.onState({ you: null, rooms: [] });
    };
    socket.onerror = () => fail('暂时无法连接联机服务，请重试');
  }
  send(data) {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.stats.socketMessages++;
    if (!['signal', 'relay'].includes(data.type)) this.stats.controlMessages++;
    this.ws.send(JSON.stringify(data));
    return true;
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
        if (match === this.match) this.onPacket(packet);
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
    if (!this.match) return false;
    if (
      !this.forceRelay &&
      this.channel?.readyState === 'open' &&
      this.channel.bufferedAmount < 65536
    ) {
      this.stats.directMessages++;
      this.channel.send(JSON.stringify({ match: this.match, packet }));
      return true;
    }
    this.forceRelay = true; // Keep ordering stable for this match after fallback.
    this.stats.relayMessages++;
    return this.send({ type: 'relay', match: this.match, packet });
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
