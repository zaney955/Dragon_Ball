export const ROOM_LIMIT = 3;
export const PLAYER_LIMIT = 2;

export function roomList(sessions) {
  return Array.from({ length: ROOM_LIMIT }, (_, index) => {
    const members = sessions.filter((s) => s.room === index + 1).sort((a, b) => a.seat - b.seat);
    const host = members[0];
    return {
      id: index + 1,
      map: host?.map ?? 0,
      light: host?.light ?? 'day',
      rule: host?.rule ?? 'senzu',
      ringOut: host?.ringOut ?? false,
      revision: host?.revision ?? 0,
      match: host?.match ?? null,
      series: host?.series ?? { scores: [0, 0], rounds: 0, votes: [false, false] },
      spectators: sessions.filter((s) => s.watching === index + 1).length,
      players: members.map(({ id, seat, character, ready }) => ({ id, seat, character, ready })),
    };
  });
}

/** One atomic synchronous transition. Room membership lives on hibernating sockets. */
export function command(sessions, player, message, newMatch) {
  const error = (text) => ({ error: text });
  const members = () => sessions.filter((s) => s.room && s.room === player.room);
  const reset = (list) =>
    list.forEach((s) => {
      s.ready = false;
      s.match = null;
    });
  const series = (list) => {
    const value = list[0]?.series ?? { scores: [0, 0], rounds: 0, votes: [false, false] };
    list.forEach((s) => (s.series = structuredClone(value)));
    return value;
  };
  const start = (list) => {
    const value = series(list);
    value.rounds++;
    value.votes = [false, false];
    const match = newMatch();
    list.forEach((s) => {
      s.match = match;
      s.ready = true;
      s.series = structuredClone(value);
    });
  };
  if (message.type === 'watch') {
    if (player.room) return error('请先离开当前房间');
    const room = roomList(sessions).find((r) => r.id === message.room);
    if (!room || room.players.length !== 2 || !room.match?.playing)
      return error('这个房间暂时没有正在进行的对战');
    player.watching = room.id;
    return { changed: true };
  }
  if (message.type === 'unwatch') {
    player.watching = 0;
    return { changed: true };
  }
  if (message.type === 'create' || message.type === 'join') {
    if (player.room) return error('请先离开当前房间');
    const room = Number(message.room);
    if (!Number.isInteger(room) || room < 1 || room > ROOM_LIMIT) return error('房间不存在');
    const occupants = sessions.filter((s) => s.room === room);
    if (message.type === 'create' && occupants.length) return error('这个房间已被创建');
    if (message.type === 'join' && !occupants.length) return error('房间已经关闭');
    if (occupants.length >= PLAYER_LIMIT || occupants.some((s) => s.match))
      return error('房间已满');
    player.room = room;
    player.watching = 0;
    player.seat = occupants.length ? 1 : 0;
    player.map = occupants[0]?.map ?? 0;
    player.light = occupants[0]?.light ?? 'day';
    player.rule = occupants[0]?.rule ?? 'senzu';
    player.ringOut = occupants[0]?.ringOut ?? false;
    const revision = (occupants[0]?.revision ?? 0) + 1;
    [...occupants, player].forEach((s) => (s.revision = revision));
    reset([...occupants, player]);
    const initial = { scores: [0, 0], rounds: 0, votes: [false, false] };
    [...occupants, player].forEach((s) => (s.series = structuredClone(initial)));
    return { changed: true };
  }
  if (message.type === 'leave') {
    player.watching = 0;
    const remaining = members().filter((s) => s !== player);
    reset(remaining);
    remaining.forEach((s) => (s.series = { scores: [0, 0], rounds: 0, votes: [false, false] }));
    remaining.forEach((s) => {
      s.seat = 0;
      s.revision = (s.revision ?? 0) + 1;
    });
    player.room = 0;
    player.seat = 0;
    reset([player]);
    return { changed: true };
  }
  if (!player.room) return error('请先加入房间');
  if (message.type === 'playing' || message.type === 'ended') {
    if (player.seat !== 0 || player.match?.id !== message.match || members().length !== 2)
      return error('对局状态无效');
    const playing = message.type === 'playing';
    if (playing && player.match.finished) return error('本回合已经结束');
    if (!playing && !player.match.finished) {
      const value = series(members());
      if (message.winner === 0 || message.winner === 1) value.scores[message.winner]++;
      value.votes = [false, false];
      members().forEach((s) => {
        s.series = structuredClone(value);
        s.match = { ...s.match, playing: false, finished: true, winner: message.winner ?? null };
      });
      return { changed: true };
    }
    if (!!player.match.playing === playing) return { changed: false };
    members().forEach((s) => (s.match = { ...s.match, playing }));
    return { changed: true };
  }
  if (message.type === 'select') {
    if (player.match) return error('对战中不能更换角色');
    const character = Number(message.character);
    if (!Number.isInteger(character) || character < 0 || character >= 14)
      return error('角色不存在');
    if (player.character === character) return { changed: false };
    player.character = character;
    const revision = (player.revision ?? 0) + 1;
    members().forEach((s) => {
      s.revision = revision;
      s.ready = false;
    });
    return { changed: true };
  }
  if (message.type === 'settings') {
    if (player.match) return error('对战中不能修改设置');
    const patch = {};
    if ('map' in message) {
      if (!Number.isInteger(message.map) || message.map < 0 || message.map > 3)
        return error('舞台不存在');
      patch.map = message.map;
    }
    if ('light' in message) {
      if (!['day', 'sunset', 'moon'].includes(message.light)) return error('光照不存在');
      patch.light = message.light;
    }
    if ('rule' in message) {
      if (!['senzu', 'competitive'].includes(message.rule)) return error('对局规则不存在');
      patch.rule = message.rule;
    }
    if ('ringOut' in message) {
      if (typeof message.ringOut !== 'boolean') return error('出界设置无效');
      patch.ringOut = message.ringOut;
    }
    if (!Object.keys(patch).length) return error('设置为空');
    if (
      Object.entries(patch).every(
        ([key, value]) =>
          (player[key] ?? (key === 'rule' ? 'senzu' : key === 'ringOut' ? false : undefined)) ===
          value,
      )
    )
      return { changed: false };
    const revision = (player.revision ?? 0) + 1;
    members().forEach((s) => Object.assign(s, patch, { ready: false, revision }));
    return { changed: true };
  }
  if (message.type === 'ready') {
    if (player.match) return error('对战已经开始');
    if (message.revision !== (player.revision ?? 0)) return error('设置已更新，请确认后重新准备');
    player.ready = message.ready === true;
    const list = members();
    if (list.length === PLAYER_LIMIT && list.every((s) => s.ready)) {
      start(list);
    }
    return { changed: true };
  }
  if (message.type === 'rematch') {
    if (player.match?.id !== message.match || !player.match.finished || members().length !== 2)
      return error('本回合尚未确认结束');
    const list = members(),
      value = series(list);
    value.votes[player.seat] = message.ready === true;
    list.forEach((s) => (s.series = structuredClone(value)));
    if (value.votes.every(Boolean)) start(list);
    return { changed: true };
  }
  if (message.type === 'finish') {
    if (player.match?.id !== message.match) return error('对局已结束');
    reset(members());
    const value = series(members());
    value.votes = [false, false];
    members().forEach((s) => (s.series = structuredClone(value)));
    return { changed: true };
  }
  return error('不支持的操作');
}
