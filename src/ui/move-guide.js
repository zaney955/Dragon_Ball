export function register({ match: matchModule, training: trainingModule, ui: uiModule }) {
  let guidePreviousFocus, guideWasPaused;
  function selectGuideTab(id) {
    for (const tab of document.querySelectorAll('[data-guide-tab]')) {
      const active = tab.dataset.guideTab === id;
      tab.setAttribute('aria-selected', active);
      tab.tabIndex = active ? 0 : -1;
      document.getElementById(tab.dataset.guideTab).hidden = !active;
    }
    document.querySelector('.guideContent').scrollTop = 0;
  }
  function openMoveGuide(id = 'guideKeys') {
    const panel = document.getElementById('moveGuide');
    if (panel.classList.contains('show')) return;
    trainingModule.refreshMoveTable();
    guidePreviousFocus = document.activeElement;
    guideWasPaused = matchModule.game.paused;
    if (matchModule.game.screen === 'fight' && !matchModule.game.over) matchModule.setPaused(true);
    selectGuideTab(id);
    panel.classList.add('show');
    document.getElementById('menu').inert = true;
    uiModule.el.hud.inert = true;
    document.getElementById('pause').inert = true;
    document.getElementById('guideClose').focus();
  }
  function closeMoveGuide(restoreFocus = true) {
    const panel = document.getElementById('moveGuide');
    if (!panel.classList.contains('show')) return;
    panel.classList.remove('show');
    document.getElementById('menu').inert =
      matchModule.game.screen !== 'menu' ||
      !['select', 'online'].includes(matchModule.game.menuPage);
    if (matchModule.game.screen === 'fight' && !matchModule.game.over)
      matchModule.setPaused(guideWasPaused);
    if (restoreFocus) guidePreviousFocus?.focus();
  }
  return function initialize() {
    guidePreviousFocus = null;
    guideWasPaused = false;
    document.getElementById('moveGuideBtn').onclick = () => openMoveGuide();
    document.getElementById('fightGuide').onclick = () => openMoveGuide();
    document.getElementById('liveGuide').onclick = () => openMoveGuide('characterMoves');
    document.getElementById('guideClose').onclick = () => closeMoveGuide();
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
    document.getElementById('moveGuide').addEventListener('click', (e) => {
      if (e.target.id === 'moveGuide') closeMoveGuide();
    });
    addEventListener(
      'keydown',
      (e) => {
        if (!document.getElementById('moveGuide').classList.contains('show')) return;
        if (
          e.target.matches('[data-guide-tab]') &&
          ['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)
        )
          return;
        if (e.code === 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation();
          closeMoveGuide();
          return;
        }
        if (e.key === 'Tab') {
          const items = [
              ...document.querySelectorAll('#moveGuide button,#moveGuide summary'),
            ].filter((x) => x.getClientRects().length && x.tabIndex >= 0),
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
      {
        capture: true,
      },
    );
    for (const id of ['pause', 'result']) {
      const node = document.getElementById(id);
      node.setAttribute('role', 'dialog');
      node.setAttribute('aria-modal', 'true');
      node.setAttribute('aria-labelledby', id === 'pause' ? 'pauseTitle' : 'resultTitle');
    }

    /* V2 extension: anatomy, moves and ability state stay on V1's 120 Hz rules. */
  };
}
