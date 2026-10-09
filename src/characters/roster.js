export function register({ animation: animationModule, characters: charactersModule }) {
  return function initialize() {
    charactersModule.CHARACTERS = [
      {
        id: 'goku',
        name: '少年悟空',
        title: '龟仙流 · 少年篇',
        color: 0xff7a1c,
        accent: 0x3a78e0,
        ultColor: 0x7fe0ff,
        ultName: '龟派气功波',
        ultStyle: 'kamehameha',
        ultAnim: animationModule.ANIM.kamehameha,
        ultTiming: {
          windup: 0.72,
          fire: 0.99,
        },
        hp: 100,
        speed: 1.06,
        power: 1.0,
        buildBody: charactersModule.buildGoku,
        combos: {
          light: [
            charactersModule.mkAtk('l1', 'jab', 4, 2.15, 0.3, 0.09, 0.7, 0.16, 6),
            charactersModule.mkAtk('l2', 'cross', 5, 2.25, 0.32, 0.1, 0.9, 0.18, 7),
            charactersModule.mkAtk('l3', 'hook', 6, 2.2, 0.38, 0.12, 1.6, 0.24, 8),
            charactersModule.mkAtk('l4', 'spinKick', 9, 2.55, 0.52, 0.15, 3.8, 0.42, 11),
          ],
          heavy: [
            charactersModule.mkAtk('h1', 'heavyPunch', 9, 2.45, 0.52, 0.19, 2.6, 0.3, 11),
            charactersModule.mkAtk('h2', 'heavyKick', 12, 2.6, 0.58, 0.21, 3.4, 0.36, 13),
            charactersModule.mkAtk('h3', 'staffSweep', 15, 3.05, 0.68, 0.25, 4.8, 0.48, 16),
            charactersModule.mkAtk('h4', 'staffSmash', 24, 3.25, 0.9, 0.34, 8.0, 0.75, 20),
          ],
        },
      },
      {
        id: 'roshi',
        name: '龟仙人',
        title: '龟仙流 · 武天老师',
        color: 0xff8a34,
        accent: 0x66bb44,
        ultColor: 0x7fffc8,
        ultName: '魔封波',
        ultStyle: 'mafuba',
        ultAnim: animationModule.ANIM.mafuba,
        ultTiming: {
          windup: 0.72,
          fire: 0.99,
        },
        hp: 96,
        speed: 0.96,
        power: 1.08,
        buildBody: charactersModule.buildRoshi,
        combos: {
          light: [
            charactersModule.mkAtk('l1', 'palmStrike', 5, 2.2, 0.32, 0.1, 0.8, 0.17, 6),
            charactersModule.mkAtk('l2', 'elbow', 6, 2.1, 0.34, 0.11, 1.1, 0.2, 7),
            charactersModule.mkAtk('l3', 'sweep', 7, 2.5, 0.44, 0.14, 1.8, 0.28, 9),
            charactersModule.mkAtk('l4', 'spinKick', 10, 2.55, 0.52, 0.16, 4.0, 0.44, 12),
          ],
          heavy: [
            charactersModule.mkAtk('h1', 'heavyPunch', 10, 2.45, 0.54, 0.2, 2.8, 0.32, 12),
            charactersModule.mkAtk('h2', 'knee', 13, 2.3, 0.56, 0.2, 3.6, 0.38, 14),
            charactersModule.mkAtk('h3', 'doublePalm', 16, 3.0, 0.7, 0.26, 5.0, 0.5, 17),
            charactersModule.mkAtk('h4', 'magicFlash', 23, 3.3, 0.92, 0.34, 7.8, 0.72, 21),
          ],
        },
      },
      {
        id: 'taopaipai',
        name: '桃白白',
        title: '杀手桃白白',
        color: 0xc02a7a,
        accent: 0xffd166,
        ultColor: 0xff2d6f,
        ultName: '洞洞波',
        ultStyle: 'dodonpa',
        ultAnim: animationModule.ANIM.dodonpa,
        ultTiming: {
          windup: 0.72,
          fire: 0.99,
        },
        hp: 92,
        speed: 1.16,
        power: 1.02,
        buildBody: charactersModule.buildTaopaipai,
        combos: {
          light: [
            charactersModule.mkAtk('l1', 'jab', 4, 2.15, 0.26, 0.08, 0.6, 0.14, 6),
            charactersModule.mkAtk('l2', 'elbow', 5, 2.1, 0.3, 0.1, 1.0, 0.18, 7),
            charactersModule.mkAtk('l3', 'backClaw', 6, 2.25, 0.36, 0.12, 1.6, 0.24, 8),
            charactersModule.mkAtk('l4', 'spinKick', 10, 2.55, 0.5, 0.15, 3.9, 0.42, 12),
          ],
          heavy: [
            charactersModule.mkAtk('h1', 'heavyKick', 11, 2.55, 0.54, 0.19, 3.0, 0.32, 12),
            charactersModule.mkAtk('h2', 'rushPalm', 13, 2.6, 0.56, 0.2, 3.8, 0.36, 14),
            charactersModule.mkAtk('h3', 'knee', 16, 2.35, 0.6, 0.22, 5.0, 0.48, 17),
            charactersModule.mkAtk('h4', 'heavyPunch', 22, 3.1, 0.86, 0.32, 7.6, 0.7, 21),
          ],
        },
      },
      {
        id: 'piccolo',
        name: '比克大魔王',
        title: '魔族之王',
        color: 0x4fa04c,
        accent: 0xd43a86,
        ultColor: 0xc44aff,
        ultName: '爆力魔波',
        ultStyle: 'bakuriki',
        ultAnim: animationModule.ANIM.bakuriki,
        ultTiming: {
          windup: 0.72,
          fire: 0.99,
        },
        hp: 108,
        speed: 0.9,
        power: 1.2,
        buildBody: charactersModule.buildPiccolo,
        combos: {
          light: [
            charactersModule.mkAtk('l1', 'claw', 5, 2.25, 0.32, 0.1, 0.8, 0.17, 7),
            charactersModule.mkAtk('l2', 'backClaw', 6, 2.25, 0.34, 0.11, 1.1, 0.19, 8),
            charactersModule.mkAtk('l3', 'heavyKick', 8, 2.5, 0.44, 0.14, 2.2, 0.3, 9),
            charactersModule.mkAtk('l4', 'uppercut', 11, 2.35, 0.5, 0.15, 4.2, 0.44, 13),
          ],
          heavy: [
            charactersModule.mkAtk('h1', 'claw', 11, 2.5, 0.54, 0.19, 3.0, 0.32, 12),
            charactersModule.mkAtk('h2', 'knee', 14, 2.35, 0.58, 0.21, 3.9, 0.4, 15),
            charactersModule.mkAtk('h3', 'magicFlash', 18, 3.05, 0.72, 0.26, 5.4, 0.52, 18),
            charactersModule.mkAtk('h4', 'doublePalm', 26, 3.35, 0.94, 0.36, 8.2, 0.76, 22),
          ],
        },
      },
      {
        id: 'tien',
        name: '天津饭',
        title: '鹤仙流 · 三目武道家',
        color: 0x62c46a,
        accent: 0xffffff,
        ultColor: 0xffd166,
        ultName: '气功炮',
        ultStyle: 'kikoho',
        ultAnim: animationModule.ANIM.kikoho,
        ultTiming: {
          windup: 0.72,
          fire: 0.99,
        },
        hp: 104,
        speed: 1.0,
        power: 1.12,
        buildBody: charactersModule.buildTien,
        combos: {
          light: [
            charactersModule.mkAtk('l1', 'jab', 4, 2.15, 0.3, 0.09, 0.7, 0.15, 6),
            charactersModule.mkAtk('l2', 'cross', 6, 2.25, 0.32, 0.1, 1.0, 0.18, 8),
            charactersModule.mkAtk('l3', 'elbow', 7, 2.15, 0.36, 0.12, 1.5, 0.24, 9),
            charactersModule.mkAtk('l4', 'spinKick', 10, 2.55, 0.52, 0.15, 4.0, 0.43, 12),
          ],
          heavy: [
            charactersModule.mkAtk('h1', 'heavyPunch', 10, 2.45, 0.52, 0.19, 2.8, 0.31, 12),
            charactersModule.mkAtk('h2', 'heavyKick', 13, 2.6, 0.58, 0.21, 3.7, 0.38, 14),
            charactersModule.mkAtk('h3', 'solarFlare', 16, 3.1, 0.66, 0.24, 5.2, 0.62, 17),
            charactersModule.mkAtk('h4', 'magicFlash', 25, 3.3, 0.92, 0.34, 8.0, 0.74, 22),
          ],
        },
      },
    ];
    charactersModule.CHARACTERS.push(
      {
        id: 'krillin',
        name: '小林',
        title: '龟仙流 · 少年同门',
        color: 0xe85128,
        accent: 0x243b70,
        ultColor: 0x8fe3ff,
        ultName: '龟派气功',
        ultStyle: 'kamehameha',
        ultAnim: animationModule.ANIM.kamehameha,
        ultTiming: {
          windup: 0.72,
          fire: 0.99,
        },
        hp: 96,
        speed: 1.15,
        power: 0.96,
        buildBody: charactersModule.buildKrillin,
        combos: {
          light: charactersModule.CHARACTERS[0].combos.light.map((a) => ({
            ...a,
          })),
          heavy: [
            charactersModule.mkAtk('h1', 'heavyKick', 9, 2.4, 0.5, 0.16, 2.6, 0.3, 11),
            charactersModule.mkAtk('h2', 'knee', 12, 2.3, 0.56, 0.2, 3.2, 0.36, 13),
            charactersModule.mkAtk('h3', 'doublePalm', 15, 2.7, 0.65, 0.24, 4.7, 0.44, 15),
          ],
        },
      },
      {
        id: 'yamcha',
        name: '雅木茶',
        title: '荒野盗贼 · 狼牙风风拳',
        color: 0x448954,
        accent: 0xc44235,
        ultColor: 0xffdc9a,
        ultName: '狼牙风风拳',
        ultStyle: 'wolf',
        ultAnim: animationModule.ANIM.bakuriki,
        ultTiming: {
          windup: 0.72,
          fire: 0.99,
        },
        hp: 100,
        speed: 1.1,
        power: 1.03,
        buildBody: charactersModule.buildYamcha,
        combos: {
          light: [
            charactersModule.mkAtk('l1', 'claw', 4, 2.2, 0.28, 0.08, 0.6, 0.18, 6),
            charactersModule.mkAtk('l2', 'backClaw', 5, 2.2, 0.3, 0.09, 0.8, 0.2, 7),
            charactersModule.mkAtk('l3', 'elbow', 6, 2.3, 0.34, 0.1, 1.2, 0.22, 8),
            charactersModule.mkAtk('l4', 'spinKick', 10, 2.5, 0.48, 0.14, 3.8, 0.4, 11),
          ],
          heavy: charactersModule.CHARACTERS[2].combos.heavy.map((a) => ({
            ...a,
          })),
        },
      },
    );
    for (const c of charactersModule.CHARACTERS) {
      const body = c.buildBody;
      c.buildBody = () => charactersModule.finishBody(body());
    }
    charactersModule.ULT_ATK = {
      id: 'ult',
      anim: null,
      dmg: 32,
      range: 8.5,
      dur: 1.6,
      hitT: 0.98,
      kb: 8.5,
      stun: 0.95,
      ki: 0,
      isUlt: true,
    };
  };
}
