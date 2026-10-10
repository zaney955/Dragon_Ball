import { DurableObject } from 'cloudflare:workers';
import { command, roomList } from './lobby.js';
import { validSpectatorFrame } from '../src/online/spectator-codec.js';
import { SpectatorFlow } from './spectator-flow.js';
import { MessageBudget, validRelayPacket } from './traffic-policy.js';

export class OnlineLobby extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    this.rates = new Map();
    this.viewers = new Map();
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
    for (const s of sessions) {
      const host = sessions.find((p) => p.room === s.watching && p.seat === 0);
      if (
        s.watching &&
        (!host?.match?.playing || !sessions.some((p) => p.room === s.watching && p.seat === 1))
      )
        s.watching = 0;
    }
    for (const s of sessions) if (!s.watching) this.viewers.delete(s.ws);
    this.save(sessions);
    const rooms = roomList(sessions);
    for (const s of sessions)
      this.send(s.ws, { type: 'state', you: s.id, watching: s.watching ?? 0, rooms });
  }

  send(ws, data) {
    try {
      ws.send(JSON.stringify(data));
      return true;
    } catch {
      /* Close event removes membership. */
      return false;
    }
  }

  fetch() {
    if (this.sessions().length >= 64) return new Response('大厅暂时已满', { status: 503 });
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({
      id: crypto.randomUUID(),
      room: 0,
      watching: 0,
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
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      message = null;
    }
    const rate = this.rates.get(ws) ?? new MessageBudget();
    this.rates.set(ws, rate);
    if (!rate.allow(message ?? {}, new TextEncoder().encode(raw).byteLength, Date.now()))
      return ws.close(1008, '发送过于频繁');
    if (!message || typeof message !== 'object')
      return this.send(ws, { type: 'error', message: '消息无效' });
    const sessions = this.sessions();
    const self = sessions.find((s) => s.ws === ws);
    if (!self) return;
    if (message.type === 'spectator-frame') {
      if (
        !self.room ||
        self.seat !== 0 ||
        !self.match?.playing ||
        message.match !== self.match.id ||
        !validSpectatorFrame(message.frame)
      )
        return;
      for (const spectator of sessions.filter((s) => s.watching === self.room && !s.room)) {
        const send = (frame) =>
          this.send(spectator.ws, {
            type: 'spectator-frame',
            match: self.match.id,
            room: self.room,
            frame,
          });
        if (spectator.spectatorFlow) {
          const flow = this.viewers.get(spectator.ws) ?? new SpectatorFlow();
          this.viewers.set(spectator.ws, flow);
          flow.offer(self.match.id, message.frame, send);
        } else send(message.frame);
      }
      return;
    }
    if (message.type === 'spectator-ack') {
      if (self.watching && !self.room && Number.isSafeInteger(message.seq))
        this.viewers.get(ws)?.acknowledge(message.match, message.seq);
      return;
    }
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
      if (!validRelayPacket(packet, self.seat)) return;
      return this.send(peer.ws, { type: 'peer', match: self.match.id, packet });
    }
    const result = command(sessions, self, message, () => ({
      id: crypto.randomUUID(),
      seed: crypto.getRandomValues(new Uint32Array(1))[0] || 1,
    }));
    if (result.error) return this.send(ws, { type: 'error', message: result.error });
    if (result.changed) {
      if (message.type === 'watch') this.viewers.delete(ws);
      this.save(sessions);
      this.publish(sessions);
    }
  }

  webSocketClose(ws) {
    const self = ws.deserializeAttachment();
    // Clear attachment before publishing: a closing socket can still be returned by getWebSockets().
    ws.serializeAttachment({ ...self, room: 0, watching: 0 });
    const sessions = this.sessions();
    if (self?.room) {
      const remaining = sessions.filter((s) => s.room === self.room);
      for (const s of remaining) {
        s.ready = false;
        s.match = null;
        s.series = { scores: [0, 0], rounds: 0, votes: [false, false] };
        s.seat = 0;
        s.revision = (s.revision ?? 0) + 1;
      }
      this.save(sessions);
      this.publish(sessions);
    } else if (self?.watching) this.publish(sessions);
    this.rates.delete(ws);
    this.viewers.delete(ws);
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
