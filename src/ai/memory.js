export function register({ ai: aiModule }) {
  aiModule.armorWindow = function armorWindow(f) {
    return !!f.attack?.armor && f.stateTimer < f.attack.hitT && !f.armorSpent;
  };
  aiModule.cpuDistance = function cpuDistance(ai, seen) {
    const p = aiModule.TACTICS[ai.def.id];
    return p
      ? Math.min(p.near, seen.scale < ai.baseScale * 0.7 ? 0.86 : p.near)
      : Math.min(1.05, ai.def.combos.light[0].range * 0.7);
  };
  aiModule.aiMemory = function aiMemory(ai, seen) {
    const m = (ai.tacticalMemory ??= {
      samples: [],
      serial: null,
      guard: 0,
      miss: 0,
    });
    if (seen.state === 'block' || seen.state === 'blockstun') m.guard = Math.min(1, m.guard + 0.08);
    else m.guard *= 0.97;
    if (seen.attack && seen.attack.serial !== m.serial) {
      m.serial = seen.attack.serial;
      m.samples.push({
        time: seen.time,
        motion: seen.attack.motion,
      });
      if (m.samples.length > 6) m.samples.shift();
    }
    if (
      seen.attack?.result === null &&
      seen.attack.phase > seen.attack.hitT + (seen.attack.active ?? 0.07)
    )
      m.miss = Math.min(1, m.miss + 0.12);
    else m.miss *= 0.97;
    return m;
  };
  return function initialize() {
    aiModule.TACTICS = {
      goku: {
        near: 0.91,
        control: 2.1,
        notes: 'J 快击确认；W+K 挑空 → E（12气）→ 空中 J；R 如意棒控制中距，空挥有收招。',
      },
      taopaipai: {
        near: 0.84,
        control: 1.3,
        notes: 'J 命中 → R（30气）快速突掌；侧闪避开洞洞波；突掌失败需完整收招。',
      },
      piccolo: {
        near: 1.0,
        control: 1.35,
        notes: '近身爪击确认；W+K → E（12气）→ 空中 J；震掌压盾；慢速重击/必杀容易被确反。',
      },
    };
  };
}
