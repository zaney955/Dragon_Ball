import { DurableObject } from 'cloudflare:workers';
import { command, roomList } from './lobby.js';

export class OnlineLobby extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    this.rates = new Map();
  }

  sessions() {
    return this.ctx
      .getWebSockets()
      .filter((ws) => ws.readyState === 1)
      .map((ws) => ({
        ws,
        ...ws.deserializeAttachment(),
      }));
  }

  save(sessions) {
    for (const { ws, ...state } of sessions) ws.serializeAttachment(state);
  }

  publish(sessions = this.sessions()) {
    const rooms = roomList(sessions);
    for (const s of sessions) this.send(s.ws, { type: 'state', you: s.id, rooms });
  }

  send(ws, data) {
    try {
      ws.send(JSON.stringify(data));
    } catch {
      /* Close event removes membership. */
    }
  }

  fetch() {
    if (this.sessions().length >= 64) return new Response('大厅暂时已满', { status: 503 });
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({
      id: crypto.randomUUID(),
      room: 0,
      seat: 0,
      character: 0,
      ready: false,
      map: 0,
      light: 'day',
      rule: 'senzu',
      ringOut: false,
      revision: 0,
      match: null,
    });
    const sessions = this.sessions();
    const self = sessions.find((s) => s.ws === server);
    this.send(server, { type: 'state', you: self.id, rooms: roomList(sessions) });
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 49152) return ws.close(1009, '消息过大');
    const now = Date.now();
    const rate = this.rates.get(ws) ?? { start: now, count: 0 };
    if (now - rate.start > 1000) {
      rate.start = now;
      rate.count = 0;
    }
    this.rates.set(ws, rate);
    if (++rate.count > 40) return ws.close(1008, '发送过于频繁');
    const sessions = this.sessions();
    const self = sessions.find((s) => s.ws === ws);
    if (!self) return;
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return this.send(ws, { type: 'error', message: '消息无效' });
    }
    if (!message || typeof message !== 'object') return;
    if (message.type === 'signal' || message.type === 'relay') {
      const peer = sessions.find((s) => self.room && s.room === self.room && s.id !== self.id);
      if (!peer) return;
      if (message.type === 'signal') {
        const description = message.description;
        const candidate = message.candidate;
        if (
          candidate &&
          typeof candidate.candidate === 'string' &&
          candidate.candidate.length < 2048
        )
          return this.send(peer.ws, { type: 'signal', from: self.id, candidate });
        if (
          !description ||
          !['offer', 'answer'].includes(description.type) ||
          typeof description.sdp !== 'string'
        )
          return;
        return this.send(peer.ws, { type: 'signal', from: self.id, description });
      }
      if (!self.match || message.match !== self.match.id || message.match !== peer.match?.id)
        return;
      const packet = message.packet;
      if (!packet || !['input', 'frames', 'begin', 'ack', 'return'].includes(packet.kind)) return;
      if (['frames', 'begin'].includes(packet.kind) && self.seat !== 0) return;
      if (packet.kind === 'input' && self.seat !== 1) return;
      return this.send(peer.ws, { type: 'peer', match: self.match.id, packet });
    }
    const result = command(sessions, self, message, () => ({
      id: crypto.randomUUID(),
      seed: crypto.getRandomValues(new Uint32Array(1))[0] || 1,
    }));
    if (result.error) return this.send(ws, { type: 'error', message: result.error });
    if (result.changed) {
      this.save(sessions);
      this.publish(sessions);
    }
  }

  webSocketClose(ws) {
    const self = ws.deserializeAttachment();
    // Clear attachment before publishing: a closing socket can still be returned by getWebSockets().
    ws.serializeAttachment({ ...self, room: 0 });
    const sessions = this.sessions();
    if (self?.room) {
      const remaining = sessions.filter((s) => s.room === self.room);
      for (const s of remaining) {
        s.ready = false;
        s.match = null;
        s.seat = 0;
        s.revision = (s.revision ?? 0) + 1;
      }
      this.save(sessions);
      this.publish(sessions);
    }
    this.rates.delete(ws);
  }

  webSocketError(ws) {
    this.webSocketClose(ws);
    ws.close(1011, '连接中断');
  }
}

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ ok: true, rooms: 3, protocol: 1 });
    if (
      url.pathname !== '/connect' ||
      request.headers.get('Upgrade')?.toLowerCase() !== 'websocket'
    ) {
      return new Response('Not found', { status: 404 });
    }
    const origin = request.headers.get('Origin');
    const allowed =
      origin === env.ALLOWED_ORIGIN ||
      /^https:\/\/[a-z0-9-]+\.dragon-ball-budokai\.pages\.dev$/.test(origin ?? '') ||
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1';
    if (!allowed) return new Response('Origin not allowed', { status: 403 });
    // The global coordination atom is exactly THREE rooms / SIX players; gameplay is peer-to-peer.
    return env.LOBBY.getByName('three-room-lobby-v1').fetch(request);
  },
};
