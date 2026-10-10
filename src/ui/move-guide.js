import {
  CHARACTER_HELP,
  INPUT_LABELS,
  inputCopy,
  jumpAction,
  remoteAction,
  skillCost,
} from './character-help.js';

export function register({ characters, combat, match, training, ui }) {
  let previousFocus, wasPaused;
  const el = (id) => document.getElementById(id);
  ui.controlledFighter = () =>
    match.game.online && match.game.onlineSeat === 1 ? match.enemy : match.player;
  function selectGuideTab(id) {
    for (const tab of document.querySelectorAll('[data-guide-tab]')) {
      const active = tab.dataset.guideTab === id;
      tab.setAttribute('aria-selected', active);
      tab.tabIndex = active ? 0 : -1;
      el(tab.dataset.guideTab).hidden = !active;
    }
    document.querySelector('.guideContent').scrollTop = 0;
  }
  function guideDef() {
    return characters.CHARACTERS[Number(el('guideCharacter').value)] ?? characters.CHARACTERS[0];
  }
  function helpCard(key, title, meta, description) {
    return `<article class="helpMove"><div class="helpMoveTitle"><kbd>${key}</kbd><h4>${title}</h4></div><p class="helpMeta">${meta}</p><p>${description}</p></article>`;
  }
  ui.refreshCharacterGuide = function refreshCharacterGuide() {
    const c = guideDef(),
      h = CHARACTER_HELP[c.id],
      k = INPUT_LABELS[el('guideInput').value],
      r = remoteAction(c.id);
    ui.guideCharacter = c;
    const flight = jumpAction(c.id);
    const remote =
      c.id === 'pilaf'
        ? `按 ${k.remote} 发射当前武装；导弹10能量，喷火12能量。按 ${k.primary} 切换后仍需另按远程键发射；喷火需靠近，射程约2.5米。`
        : r.range
          ? `点按 ${k.remote} 发射${r.name}；每次${r.cost}能量，射程约${r.range}米。`
          : '这个角色没有远程攻击，请用近战和专属技能。';
    el('characterGuide').innerHTML =
      `<h3>${c.name}</h3><p class="helpLead">${h.summary}</p><p class="helpCaution">${inputCopy(h.caution, k)}</p><div class="helpMoves">${helpCard(k.remote, r.name === '无远程' ? '远程攻击：无' : c.id === 'pilaf' ? '导弹 / 喷火' : r.name, r.range ? '点按发射' : '使用近战与技能', remote)}${helpCard(k.jump, flight, flight === '跳跃' ? '点按跳跃' : '点按起跳，按住继续升高', flight === '跳跃' ? '跳跃躲避地面攻击，在空中也能轻击或重击。' : flight === '筋斗云' ? '悟空使用筋斗云升空；最多连续升空2秒，松开后下降。大猩猩形态不能使用筋斗云。' : '按住跳跃键短时舞空，最多连续2秒，松开后下降。')}${c.skills.map((s, i) => helpCard(i ? k.secondary : k.primary, s.name, skillCost(s), h.skills[i])).join('')}${helpCard(k.ultimate, c.ultName, '100 能量 · 点按发动', h.ultimate)}</div><div id="guideConditions"></div><details class="helpDetails"><summary>基础连招与操作组合</summary><p>轻击连段：连续按 ${k.light}，最多${c.combos.light.length}段。重击连段：连续按 ${k.heavy}，最多${c.combos.heavy.length}段。按键无需同时按，打空后需等待收招。</p><p>${k.forward} + ${k.heavy} 挑空；后退 + ${k.heavy} 下段；${k.throw} 投技与拆投。命中后可以用 ${k.pursuit} 追击。</p></details><button id="guidePractice" class="smallBtn">练习${c.name}</button>`;
    el('guidePractice').hidden = match.game.online || match.game.spectating;
    el('guidePractice').onclick = () => {
      ui.closeGuide(false);
      ui.startCharacterPractice(characters.CHARACTERS.indexOf(c));
    };
    ui.updateGuideConditions();
    const rows = [
      ['移动', k.move, '按住方向键或按钮移动'],
      ['轻击 / 重击', `${k.light} / ${k.heavy}`, '连续点按衔接连段；打空需等收招'],
      ['格挡', k.block, '按住；下蹲 + 格挡防下段'],
      ['聚气', k.charge, '按住，在地面站定恢复能量，受击打断'],
      ['远程攻击', k.remote, remote],
      ['主技能', k.primary, c.skills[0].name],
      ['第二技能', k.secondary, c.skills[1].name],
      ['必杀', k.ultimate, `${c.ultName}，需要100能量`],
      [flight, k.jump, flight === '跳跃' ? '点按跳跃' : '点按起跳，按住升高，最多2秒'],
    ];
    el('guideKeys').innerHTML =
      `<h3>${c.name} · 基础操作</h3><p class="keyLegend">+ 表示同时按，→ 表示依次按。${el('guideInput').value === 'touch' ? '主技能与第二技能使用各自的按钮，无需组合后退键。' : el('guideInput').value === 'two' ? '小键盘按键用于本地双人2P，键盘上排数字键无效。' : '联机双方都使用这一套按键。'}</p><div class="tableScroll"><table class="keyTable"><thead><tr><th>动作</th><th>输入</th><th>怎么用</th></tr></thead><tbody>${rows.map(([name, key, note]) => `<tr><td>${name}</td><td><kbd>${key}</kbd></td><td>${note}</td></tr>`).join('')}</tbody></table></div><details class="helpDetails"><summary>进阶操作</summary><table><tbody>${[
        ['下蹲', k.crouch, '按住，避开高位攻击'],
        ['挑空', `${k.forward} + ${k.heavy}`, '命中后可爆冲追击'],
        ['下段攻击', `后退 + ${k.heavy}`, '对手需下蹲格挡'],
        ['投技 / 拆投', k.throw, '靠近投技；被投时及时点按拆投'],
        ['闪身', k.dash, '快速调整站位，命中取消消耗8能量'],
        ['残像脱身', k.evasion, '受击时点按；15能量，消耗一次机会'],
        ['爆气解围', k.burst, '受击时同时按；35能量'],
        ['爆冲追击', k.pursuit, '命中后点按；12能量，最远10米'],
        ['连续后空翻', k.backflip, '同时按；12能量，后翻三次'],
      ]
        .map(
          ([name, key, note]) =>
            `<tr><td>${name}</td><td><kbd>${key}</kbd></td><td>${note}</td></tr>`,
        )
        .join(
          '',
        )}</tbody></table></details><p class="helpMeta">${el('guideInput').value === 'touch' ? '本地暂停与关闭指南使用界面按钮；练习工具内可重置位置与资源、查看判定。' : '本地暂停：P；关闭指南：Esc。自由练习重置：T，判定显示：B。'}</p>`;
    training.refreshMoveTable();
  };
  ui.updateGuideConditions = function updateGuideConditions() {
    const box = el('guideConditions');
    if (!box) return;
    const c = guideDef();
    if (c.id !== 'goku') {
      box.replaceChildren();
      return;
    }
    const own = ui.controlledFighter();
    const f =
      match.game.screen === 'fight'
        ? own?.def === c
          ? own
          : [match.player, match.enemy].find((x) => x?.def === c)
        : null;
    const checks = [
      [match.game.lightPreset === 'moon', '场景为满月夜'],
      [f ? f.hp / f.maxHp <= 0.25 : null, '总生命不高于25%'],
      [f ? f.ki >= c.skills[1].kiCost : null, `至少${c.skills[1].kiCost}能量`],
      [f ? f.pos.y <= 0.1 : null, '站在地面'],
      [f ? f.youth.tailIntact : null, '尾巴完整'],
      [f ? !f.youth.apeUsed : null, '本回合尚未成功变身'],
    ];
    const content = `<h4>大猩猩条件${f ? ' · 当前状态' : ''}</h4><ul class="conditionList">${checks.map(([ok, label]) => `<li data-met="${ok}"><span>${ok === null ? '条件' : ok ? '已满足' : '未满足'}</span>${label}</li>`).join('')}</ul>`;
    if (box.innerHTML !== content) box.innerHTML = content;
  };
  ui.startCharacterPractice = function startCharacterPractice(index) {
    if (match.game.online || match.game.spectating) return;
    if (match.game.screen !== 'menu') match.backToMenu();
    match.game.selectedChar = index;
    match.game.selectionPlayer = 1;
    match.game.difficulty = 'training';
    match.game.trainingDummy = 'idle';
    match.game.keepPair = false;
    ui.showSelection();
    ui.guideCharacter = null;
    ui.startMechanicPractice();
  };
  ui.openGuide = function openGuide(id = 'characterGuide', characterIndex) {
    if (el('moveGuide').classList.contains('show')) return;
    const localSelection =
      match.game.selectionPlayer === 2 ? Math.max(0, match.game.opponent) : match.game.selectedChar;
    const fighter = ui.controlledFighter();
    el('guideCharacter').value = String(
      characterIndex ??
        (match.game.screen === 'fight' && fighter
          ? characters.CHARACTERS.indexOf(fighter.def)
          : localSelection),
    );
    el('guideInput').value = matchMedia('(pointer: coarse), (max-width: 600px)').matches
      ? 'touch'
      : !match.game.online &&
          match.game.difficulty === 'local' &&
          match.game.selectionPlayer === 2 &&
          match.game.screen === 'menu'
        ? 'two'
        : 'one';
    ui.refreshCharacterGuide();
    previousFocus = document.activeElement;
    wasPaused = match.game.paused;
    if (match.game.screen === 'fight' && !match.game.over) match.setPaused(true);
    el('guideContext').textContent = match.game.online
      ? match.game.spectating
        ? '正在观战 · 查看指南不会暂停对局'
        : '联机对局仍在进行 · 关闭指南后继续操作'
      : match.game.screen === 'fight'
        ? '对局已暂停 · 关闭指南后恢复原状态'
        : '选择角色和输入方式，查看对应操作';
    selectGuideTab(id);
    el('moveGuide').classList.add('show');
    for (const name of ['home', 'menu', 'hud', 'pause', 'trainingPanel', 'result'])
      el(name).inert = true;
    el('guideClose').focus();
  };
  ui.closeGuide = function closeGuide(restoreFocus = true) {
    if (!el('moveGuide').classList.contains('show')) return;
    el('moveGuide').classList.remove('show');
    ui.guideCharacter = null;
    el('menu').inert =
      match.game.screen !== 'menu' || !['select', 'online'].includes(match.game.menuPage);
    el('home').inert = el('home').hidden;
    if (match.game.screen === 'fight' && !match.game.over) match.setPaused(wasPaused);
    el('hud').inert = match.game.paused || match.game.over || match.game.screen !== 'fight';
    el('pause').inert = !match.game.paused;
    el('trainingPanel').inert = false;
    el('result').inert = !match.game.over;
    if (restoreFocus && previousFocus?.getClientRects().length) previousFocus.focus();
  };
  return function initialize() {
    ui.guideCharacter = null;
    queueMicrotask(() => {
      for (const [index, c] of characters.CHARACTERS.entries()) {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = c.name;
        el('guideCharacter').append(option);
      }
      ui.refreshCharacterGuide();
      ui.guideCharacter = null;
    });
    for (const id of ['moveGuideBtn', 'homeGuide', 'pauseGuide', 'fightGuide', 'heroGuide'])
      el(id).onclick = () => ui.openGuide(id === 'homeGuide' ? 'guideKeys' : 'characterGuide');
    el('liveGuide').onclick = () => ui.openGuide('characterMoves');
    el('heroPractice').onclick = () =>
      ui.startCharacterPractice(
        match.game.selectionPlayer === 2
          ? Math.max(0, match.game.opponent)
          : match.game.selectedChar,
      );
    el('guideCharacter').onchange = ui.refreshCharacterGuide;
    el('guideInput').onchange = ui.refreshCharacterGuide;
    el('guideClose').onclick = () => ui.closeGuide();
    document.querySelectorAll('[data-guide-tab]').forEach((tab) => {
      tab.onclick = () => selectGuideTab(tab.dataset.guideTab);
      tab.onkeydown = (e) => {
        const tabs = [...document.querySelectorAll('[data-guide-tab]')],
          i = tabs.indexOf(tab);
        let next = i;
        if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') next = (i + tabs.length - 1) % tabs.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = tabs.length - 1;
        else return;
        e.preventDefault();
        e.stopPropagation();
        selectGuideTab(tabs[next].dataset.guideTab);
        tabs[next].focus();
      };
    });
    el('moveGuide').addEventListener('click', (e) => {
      if (e.target.id === 'moveGuide') ui.closeGuide();
    });
    addEventListener(
      'keydown',
      (e) => {
        if (!el('moveGuide').classList.contains('show')) return;
        if (
          e.target.matches('[data-guide-tab]') &&
          ['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)
        )
          return;
        if (e.code === 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation();
          ui.closeGuide();
          return;
        }
        if (e.key === 'Tab') {
          const items = [...el('moveGuide').querySelectorAll('button,summary,select')].filter(
              (x) => x.getClientRects().length && x.tabIndex >= 0 && !x.disabled,
            ),
            first = items[0],
            last = items.at(-1);
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
        e.stopImmediatePropagation();
      },
      { capture: true },
    );
    for (const id of ['pause', 'result']) {
      el(id).setAttribute('role', 'dialog');
      el(id).setAttribute('aria-modal', 'true');
      el(id).setAttribute('aria-labelledby', id === 'pause' ? 'pauseTitle' : 'resultTitle');
    }
  };
}
