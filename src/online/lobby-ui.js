export function register({ app, characters, match, ui, world }) {
  return function initialize() {
    const online = app.online;
    const el = (id) => document.getElementById(id);
    const panel = document.createElement('section');
    panel.id = 'onlineLobby';
    panel.hidden = true;
    panel.innerHTML =
      '<div class="onlineShell"><header><div><h1>联机对战</h1></div><button id="onlineHome">← 主菜单</button></header><p class="onlineIntro">每房两人，双方准备后开战。</p><p id="onlineStatus" role="status" aria-live="polite">正在连接…</p><button id="onlineRetry" hidden>重新连接</button><div id="onlineRooms"></div></div>';
    document.body.append(panel);
    const info = document.createElement('section');
    info.id = 'onlineRoomInfo';
    info.hidden = true;
    info.innerHTML =
      '<div class="onlineRoomHeading"><h2 id="onlineRoomTitle"></h2></div><div id="onlinePlayers"></div><p id="onlineReadyHint" class="onlineReadyHint"></p><p id="onlineRoomStatus" role="status" aria-live="polite" hidden></p>';
    el('startBtn').before(info);
    let savedSelection;
    const selectionKeys = [
      'selectedChar',
      'selectedMap',
      'difficulty',
      'opponent',
      'selectionPlayer',
      'lightPreset',
      'matchRule',
      'ringOut',
    ];
    const saveSelection = () => {
      if (!savedSelection)
        savedSelection = Object.fromEntries(selectionKeys.map((k) => [k, match.game[k]]));
    };
    const restoreSelection = () => {
      if (savedSelection) {
        Object.assign(match.game, savedSelection);
        savedSelection = null;
        match.previewMap(match.game.selectedMap);
      }
      el('menu').classList.remove('onlineSelection');
      info.hidden = true;
      el('backHome').textContent = '← 主菜单';
      for (const node of document.querySelectorAll(
        '#charList button,#mapList button,#startBtn,#lighting,#matchRule,#ringOption',
      ))
        node.disabled = false;
      ui.updateSelection();
    };
    const showLobby = () => {
      restoreSelection();
      panel.hidden = false;
      el('home').hidden = true;
      el('home').inert = true;
      el('menu').classList.add('hidden');
      el('menu').inert = true;
      match.game.menuPage = 'online';
      document.body.classList.remove('inFight');
    };
    function paintRoom() {
      const room = online.room;
      if (!room || online.active || online.watching) return;
      saveSelection();
      const self = room.players.find((p) => p.id === online.you),
        foe = room.players.find((p) => p.id !== online.you);
      const mapChanged = match.game.selectedMap !== room.map;
      Object.assign(match.game, {
        selectedChar: self.character,
        selectedMap: room.map,
        lightPreset: room.light,
        matchRule: room.rule,
        ringOut: room.ringOut,
        difficulty: 'normal',
        selectionPlayer: 1,
        opponent: foe?.character ?? -1,
        menuPage: 'online',
      });
      if (mapChanged) match.previewMap(room.map);
      world.daylight();
      ui.updateSelection();
      panel.hidden = true;
      el('menu').classList.remove('hidden');
      el('menu').classList.add('onlineSelection');
      el('menu').inert =
        el('artGallery')?.classList.contains('show') || el('moveGuide').classList.contains('show');
      el('home').hidden = true;
      el('home').inert = true;
      info.hidden = false;
      el('backHome').textContent = '← 房间列表';
      el('onlineRoomTitle').textContent =
        `房间 ${room.id} · 系列比分 ${room.series?.scores?.join(' : ') ?? '0 : 0'}`;
      el('heroOwner').textContent = '你的角色';
      el('modeNote').textContent = `180 秒 / 回合 · 已开战 ${room.series?.rounds ?? 0} 场`;
      el('selectionSummary').textContent =
        `${characters.CHARACTERS[self.character].name} VS ${foe ? characters.CHARACTERS[foe.character].name : '等待玩家加入'} · ${world.MAPS[room.map].name}`;
      el('playerTabs').hidden = true;
      el('onlinePlayers').replaceChildren();
      for (let seat = 0; seat < 2; seat++) {
        const player = room.players.find((p) => p.seat === seat),
          row = document.createElement('div');
        row.className = 'onlinePlayer' + (player?.ready ? ' ready' : '');
        if (player) {
          const portrait = document.createElement('img');
          portrait.src = el('charList').children[player.character].querySelector('img').src;
          portrait.alt = characters.CHARACTERS[player.character].name;
          const label = document.createElement('span');
          const name = document.createElement('span'),
            ready = document.createElement('small');
          name.textContent = `${player.id === online.you ? '你' : '对手'} · ${characters.CHARACTERS[player.character].name}`;
          ready.textContent = player.ready ? '已准备' : '未准备';
          label.append(name, ready);
          row.append(portrait, label);
        } else row.textContent = '等待加入';
        el('onlinePlayers').append(row);
      }
      for (const [i, node] of [...el('mapList').children].entries()) {
        node.classList.toggle('sel', i === room.map);
        node.setAttribute('aria-pressed', i === room.map);
      }
      el('ringOption').checked = room.ringOut;
      for (const node of document.querySelectorAll(
        '#charList button,#mapList button,#lighting,#matchRule,#ringOption',
      ))
        node.disabled = !!room.match;
      el('startBtn').disabled = !!room.match;
      el('startBtn').textContent = room.match ? '连接对手中' : self.ready ? '取消准备' : '准备对战';
      el('onlineReadyHint').textContent = room.match
        ? '双方已准备，正在连接'
        : !foe
          ? '等待对手加入，可先准备'
          : self.ready
            ? foe.ready
              ? '双方已准备'
              : '等待对手准备'
            : '';
      el('onlineReadyHint').hidden = !el('onlineReadyHint').textContent;
      el('heroPractice').hidden = true;
    }
    el('homeOnline').onclick = () => {
      showLobby();
      online.connect();
    };
    el('onlineRetry').onclick = () => online.connect();
    if (location.protocol === 'file:') {
      el('homeOnline').disabled = true;
      el('homeOnline').textContent = '联机请打开网页版';
    }
    el('onlineHome').onclick = () => {
      online.close();
      restoreSelection();
      panel.hidden = true;
      match.game.menuPage = 'home';
      el('home').hidden = false;
      el('home').inert = false;
      el('homeOnline').focus();
    };
    online.onStatus = (message) => {
      el('onlineStatus').textContent = message;
      el('onlineRetry').hidden = !/重试|重新进入|断开|失败|超时/.test(message);
      el('onlineRoomStatus').textContent = message;
      el('onlineRoomStatus').hidden = !/无效|停止|超时|中断|拥堵|失败|已满|更新|不能/.test(message);
    };
    online.onBegin = () => {
      if (el('artGallery')?.classList.contains('show')) el('artClose').click();
      if (el('moveGuide').classList.contains('show')) el('guideClose').click();
      panel.hidden = true;
      el('menu').inert = true;
      if (!online.spectating)
        el(online.host ? 'p1name' : 'p2name').textContent =
          '你 · ' + characters.CHARACTERS[online.room.players[online.host ? 0 : 1].character].name;
    };
    online.onReturn = () => (online.room && !online.watching ? paintRoom() : showLobby());
    online.onState = () => {
      if (online.room) {
        paintRoom();
        return;
      }
      if (!panel.hidden || el('menu').classList.contains('onlineSelection')) showLobby();
      el('onlineRooms').replaceChildren();
      for (const room of online.rooms) {
        const card = document.createElement('article');
        card.className = 'onlineRoomCard';
        const title = document.createElement('h2');
        title.textContent = `房间 ${room.id}`;
        const summary = document.createElement('p');
        summary.textContent = room.players.length
          ? `${room.players.length}/2 人 · ${room.match?.playing ? '对战中' : room.match ? '正在连接' : '等待准备'}${room.spectators ? ' · ' + room.spectators + ' 人观战' : ''}`
          : '空房间';
        const button = document.createElement('button');
        button.dataset.room = String(room.id);
        button.textContent = room.players.length
          ? room.players.length === 2
            ? '房间已满'
            : '加入对战'
          : '创建房间';
        button.disabled = !online.you || room.players.length === 2 || !!room.match;
        button.onclick = () =>
          online.command({ type: room.players.length ? 'join' : 'create', room: room.id });
        card.append(title, summary, button);
        if (room.players.length === 2 && room.match?.playing) {
          const watch = document.createElement('button');
          watch.dataset.watchRoom = String(room.id);
          watch.textContent = '观战';
          watch.className = 'onlineWatch';
          watch.disabled = !online.you;
          watch.onclick = () => online.command({ type: 'watch', room: room.id });
          card.append(watch);
        }
        el('onlineRooms').append(card);
      }
    };
    addEventListener(
      'keydown',
      (event) => {
        if (
          event.code !== 'Escape' ||
          match.game.screen !== 'menu' ||
          match.game.menuPage !== 'online' ||
          el('moveGuide').classList.contains('show') ||
          el('artGallery')?.classList.contains('show')
        )
          return;
        event.preventDefault();
        event.stopImmediatePropagation();
        online.room ? online.leave() : el('onlineHome').click();
      },
      { capture: true },
    );
    queueMicrotask(() => {
      const start = el('startBtn').onclick,
        back = el('backHome').onclick;
      el('startBtn').onclick = () => {
        if (!online.room) return start();
        const self = online.room.players.find((p) => p.id === online.you);
        online.command({ type: 'ready', ready: !self.ready, revision: online.room.revision });
      };
      el('backHome').onclick = () => (online.room ? online.leave() : back());
      for (const [i, card] of [...el('charList').children].entries()) {
        const original = card.onclick;
        card.onclick = () => {
          if (!online.room) return original();
          if (online.room.players.find((p) => p.id === online.you).character !== i)
            online.command({ type: 'select', character: i });
        };
      }
      for (const [i, card] of [...el('mapList').children].entries()) {
        const original = card.onclick;
        card.onclick = () => {
          if (!online.room) return original();
          if (online.room.map !== i) online.command({ type: 'settings', map: i });
        };
      }
      for (const [id, key] of [
        ['lighting', 'light'],
        ['matchRule', 'rule'],
        ['ringOption', 'ringOut'],
      ])
        el(id).addEventListener(
          'change',
          (event) => {
            if (!online.room) return;
            event.stopImmediatePropagation();
            online.command({
              type: 'settings',
              [key]: key === 'ringOut' ? event.target.checked : event.target.value,
            });
          },
          { capture: true },
        );
    });
  };
}
