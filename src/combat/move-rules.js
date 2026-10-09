import * as THREE from 'three';
export function register({
  animation: animationModule,
  characters: charactersModule,
  combat: combatModule,
  render: renderModule,
}) {
  combatModule.spawnAfterimage = function spawnAfterimage(f) {
    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.25, 0.92, 4, 8),
      new THREE.MeshBasicMaterial({
        color: f.def.color,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
    );
    mesh.position.copy(f.pos).add(new THREE.Vector3(0, 1.15 * f.baseScale, 0));
    mesh.scale.set(f.baseScale, f.baseScale, 0.65 * f.baseScale);
    renderModule.scene.add(mesh);
    renderModule.effects.push({
      mesh,
      life: 0.16,
      maxLife: 0.16,
      type: 'orb',
      vel: new THREE.Vector3(),
      grow: 0,
      delay: 0,
    });
  };
  combatModule.prepareCombatData = function prepareCombatData() {
    const motions = new Map(Object.entries(animationModule.ANIM).map(([k, v]) => [v, k]));
    // Frame numbers are authored at 60 fps; simulation remains 120 Hz.
    // startup, active, recovery, damage, reach (including defender's body).
    const tables = {
      goku: {
        role: '全能机动 · 如意棒控制',
        light: [
          [5, 4, 10, 4, 1.28],
          [6, 4, 11, 5, 1.32],
          [8, 5, 15, 6, 1.36],
          [10, 6, 20, 9, 1.55],
        ],
        heavy: [
          [12, 5, 20, 9, 1.48],
          [14, 6, 23, 12, 1.65],
          [17, 7, 25, 15, 2.65],
          [23, 6, 33, 24, 2.75],
        ],
      },
      roshi: {
        role: '技巧防反 · 精准格挡反击',
        light: [
          [6, 4, 10, 5, 1.4],
          [7, 4, 10, 6, 1.32],
          [10, 6, 17, 7, 1.6],
          [12, 6, 22, 10, 1.7],
        ],
        heavy: [
          [13, 5, 22, 10, 1.6],
          [12, 5, 22, 13, 1.5],
          [18, 7, 27, 16, 1.8],
          [24, 7, 33, 23, 2.0],
        ],
      },
      taopaipai: {
        role: '高速突进 · 精准直线打击',
        light: [
          [4, 3, 10, 4, 1.34],
          [5, 3, 11, 5, 1.28],
          [7, 4, 13, 6, 1.36],
          [10, 5, 23, 10, 1.7],
        ],
        heavy: [
          [11, 5, 24, 11, 1.65],
          [10, 5, 27, 13, 1.75],
          [14, 5, 26, 16, 1.48],
          [20, 5, 34, 22, 1.65],
        ],
      },
      piccolo: {
        role: '重量压制 · 单次霸体承伤',
        light: [
          [8, 5, 13, 5, 1.7],
          [9, 5, 14, 6, 1.7],
          [11, 6, 18, 8, 2.0],
          [13, 6, 25, 11, 1.72],
        ],
        heavy: [
          [16, 7, 29, 11, 1.95],
          [18, 6, 30, 14, 1.85],
          [22, 8, 34, 18, 2.15],
          [28, 8, 38, 26, 2.15],
        ],
      },
      tien: {
        role: '技术控制 · 挑空反空',
        light: [
          [6, 4, 10, 4, 1.62],
          [7, 4, 11, 6, 1.68],
          [8, 4, 13, 7, 1.6],
          [11, 6, 23, 10, 1.95],
        ],
        heavy: [
          [12, 5, 24, 10, 1.82],
          [15, 6, 25, 13, 2.02],
          [18, 7, 28, 16, 2.1],
          [24, 6, 34, 25, 2.15],
        ],
      },
      krillin: {
        role: '灵活扰乱 · 低姿态连招',
        light: [
          [4, 4, 9, 4, 1.07],
          [5, 4, 10, 5, 1.12],
          [7, 5, 12, 6, 1.18],
          [9, 6, 20, 9, 1.3],
        ],
        heavy: [
          [10, 5, 20, 9, 1.32],
          [12, 5, 22, 12, 1.25],
          [17, 6, 28, 15, 1.45],
        ],
      },
      yamcha: {
        role: '近战连击 · 狼牙多段突进',
        light: [
          [5, 4, 9, 4, 1.43],
          [5, 4, 10, 5, 1.4],
          [6, 4, 12, 6, 1.48],
          [10, 6, 24, 10, 1.72],
        ],
        heavy: [
          [12, 5, 24, 11, 1.7],
          [13, 5, 25, 13, 1.75],
          [15, 5, 27, 16, 1.5],
          [22, 6, 34, 22, 1.75],
        ],
      },
    };
    for (const c of charactersModule.CHARACTERS) {
      c.hp = Math.round(c.hp * 2.4);
      c.role = tables[c.id].role;
      for (const type of ['light', 'heavy'])
        c.combos[type] = c.combos[type].map((a, i, list) => {
          const [s, ac, r, damage, range] = tables[c.id][type][i],
            motion = motions.get(a.anim) ?? 'jab',
            light = type === 'light',
            last = i === list.length - 1;
          return combatModule.finalizeMove({
            ...a,
            motion,
            startup: s / 60,
            active: ac / 60,
            recovery: r / 60,
            dmg: damage,
            range,
            stun: light ? (last ? 0.35 : 0.24 + i * 0.018) : 0.35 + i * 0.04,
            blockstun: (light ? 7 + i : 12 + i * 2) / 60,
            kb: light ? (last ? 4.7 : 0.4 + i * 0.12) : a.kb * 0.8,
            level: motion === 'sweep' ? 'low' : light && i < 2 ? 'high' : 'mid',
            guardDamage: light ? 7 + i * 2 : 19 + i * 4,
            drive:
              c.id === 'taopaipai'
                ? motion === 'rushPalm'
                  ? 8
                  : 4.3
                : c.id === 'piccolo'
                  ? 2.4
                  : c.id === 'yamcha'
                    ? 4.7
                    : 3.5,
            cancelRules: {
              hit: !last
                ? ['light', 'heavy', 'special', 'ult', 'dash', 'pursuit']
                : ['special', 'ult', 'dash', 'pursuit'],
              block: light && !last ? ['heavy'] : [],
              whiff: [],
            },
            chainType: type,
            chainIndex: i,
            terminal: last,
            armor: c.id === 'piccolo' && type === 'heavy' && i >= 2,
            launch: motion === 'uppercut' ? 5.8 : undefined,
          });
        });
    }
  };
  combatModule.finalizeMove = function finalizeMove(a) {
    const startup = a.startup ?? a.hitT ?? 0.12,
      active = a.active ?? 0.07,
      recovery = a.recovery ?? Math.max(0.08, (a.dur ?? 0.5) - startup - active);
    return {
      ...a,
      startup,
      hitT: startup,
      active,
      recovery,
      dur: startup + active + recovery,
      damage: a.dmg,
      hitstun: a.stun,
      blockstun: a.blockstun ?? 0.13,
      hitLevel: a.level ?? 'mid',
      level: a.level ?? 'mid',
      knockback: a.kb,
      kiCost: a.kiCost ?? 0,
      cancelRules: a.cancelRules ?? {
        hit: [],
        block: [],
        whiff: [],
      },
    };
  };
  return function initialize() {
    combatModule.inputEdges = [];
    combatModule.EDGE_KEYS = {
      KeyR: 'special',
      KeyJ: 'light',
      KeyK: 'heavy',
      KeyU: 'ult',
      KeyO: 'throw',
      KeyQ: 'evasion',
      KeyE: 'pursuit',
      ShiftLeft: 'dash',
      ShiftRight: 'dash',
      Space: 'jump',
    };
    combatModule.contactShadowTexture = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const ctx = c.getContext('2d'),
        g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
      g.addColorStop(0, 'rgba(26,36,29,.82)');
      g.addColorStop(0.35, 'rgba(26,36,29,.46)');
      g.addColorStop(1, 'rgba(26,36,29,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c);
      return t;
    })();
    combatModule.skyBackdrop = (() => {
      const c = document.createElement('canvas');
      c.width = 8;
      c.height = 512;
      const k = c.getContext('2d'),
        g = k.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, '#318cbb');
      g.addColorStop(0.6, '#a6d7df');
      g.addColorStop(1, '#e8ecd6');
      k.fillStyle = g;
      k.fillRect(0, 0, 8, 512);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
  };
}
