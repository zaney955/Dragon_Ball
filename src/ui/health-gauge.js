const gauges = new WeakMap();

function shatter(stack, reserve) {
  const fragments = document.createElement('div');
  fragments.className = 'healthShatter' + (reserve ? ' reserveShatter' : '');
  fragments.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 8; i++) {
    const shard = document.createElement('i');
    shard.style.left = i * 12.5 + '%';
    shard.style.setProperty('--shard-x', (i - 3.5) * 5 + 'px');
    shard.style.setProperty('--shard-y', 8 + (i % 3) * 7 + 'px');
    shard.style.setProperty('--shard-turn', (i % 2 ? 1 : -1) * (12 + i * 4) + 'deg');
    fragments.append(shard);
  }
  stack.append(fragments);
  // A hidden HUD has no CSS animation events; still retire its fragments on time.
  const cleanup = setTimeout(() => fragments.remove(), 700);
  fragments.addEventListener(
    'animationend',
    () => {
      clearTimeout(cleanup);
      fragments.remove();
    },
    { once: true },
  );
}

/** Shared presentation for the main HUD and both shoulder-camera views. */
export function updateHealthGauge(fighter, mainFill, reserveFill) {
  const stack = mainFill.parentElement.parentElement;
  const previous = gauges.get(stack);
  const half = fighter.maxHp / 2;
  const depleted = fighter.hp <= half;
  const empty = fighter.hp <= 0;
  if (!previous || previous.fighter !== fighter || fighter.hp > previous.hp) {
    stack.querySelectorAll('.healthShatter').forEach((node) => node.remove());
  } else {
    if (previous.hp > half && depleted) shatter(stack, false);
    if (previous.hp > 0 && empty) shatter(stack, true);
  }
  stack.classList.toggle('primaryDepleted', depleted);
  stack.classList.toggle('reserveDepleted', empty);
  mainFill.style.width = Math.min(1, Math.max(0, (fighter.hp - half) / half)) * 100 + '%';
  reserveFill.style.width = Math.min(1, Math.max(0, fighter.hp / half)) * 100 + '%';
  gauges.set(stack, { fighter, hp: fighter.hp });
}
