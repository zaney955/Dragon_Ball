import * as THREE from 'three';
// Final, authoritative roster for the childhood era. Values are base damage before scaling.
export const YOUTH_PROFILES = {
  goku: {
    stance: 'spring',
    light: [
      ['跃步直拳', 'jab'],
      ['交替快拳', 'cross'],
      ['腾身踢', 'heavyKick'],
      ['翻身后踢', 'spinKick'],
    ],
    heavy: [
      ['如意棒点刺', 'staffThrust'],
      ['低身横扫', 'staffSweep'],
      ['跃起下砸', 'staffSmash'],
    ],
    directions: ['如意挑击', '棒扫脚踝', '抱腰翻摔'],
    directionalMotions: ['staffThrust', 'staffSweep', 'doublePalm'],
    skills: [
      skill('如意延伸', 'staffThrust', 30, 3, { dmg: 14, range: 2.8 }),
      skill('大猩猩', 'transform', 50, 0, { ability: 'ape', startup: 1 }),
    ],
    ult: ultimate('龟派气功波', 'kamehameha', 120, 12, { shape: 'beam', width: 0.6 }),
  },
  roshi: {
    stance: 'relaxed',
    light: [
      ['拨掌', 'palmStrike'],
      ['贴身肘', 'elbow'],
      ['沉身扫腿', 'sweep'],
    ],
    heavy: [
      ['卸力反掌', 'palmStrike'],
      ['沉腰双掌', 'doublePalm'],
    ],
    directions: ['沉腰托掌', '扫腿', '扣腕借力摔'],
    directionalMotions: ['uppercut', 'sweep', 'doublePalm'],
    skills: [
      skill('残像反掌', 'doublePalm', 30, 5, {
        ability: 'counter',
        startup: 0.1,
        active: 0.36,
        recovery: 0.45,
      }),
      skill('肌肉强化', 'transform', 40, 12, { ability: 'muscle', startup: 0.6 }),
    ],
    ult: ultimate('魔封波', 'mafuba', 32, 6, {
      shape: 'beam',
      width: 0.5,
      control: 0.7,
      recovery: 0.9,
    }),
  },
  taopaipai: {
    stance: 'straight',
    light: [
      ['食指点喉', 'fingerJab'],
      ['短肘', 'elbow'],
      ['反手穿掌', 'backClaw'],
      ['踏步侧踢', 'heavyKick'],
    ],
    heavy: [
      ['进身膝撞', 'knee'],
      ['杀手一指贯穿', 'fingerThrust'],
    ],
    directions: ['上挑膝', '截腿', '扣肩转身摔'],
    directionalMotions: ['knee', 'sweep', 'doublePalm'],
    skills: [
      skill('洞洞波', 'dodonpa', 30, 3, { dmg: 12, range: 8, shape: 'beam', width: 0.12 }),
      skill('杀手后撤掌', 'palmStrike', 30, 4, { dmg: 10, range: 1.4, ability: 'retreat' }),
    ],
    ult: ultimate('蓄力洞洞波', 'dodonpa', 150, 10, { shape: 'beam', width: 0.12, startup: 0.7 }),
  },
  piccolo: {
    stance: 'tyrant',
    light: [
      ['利爪横划', 'claw'],
      ['反手爪', 'backClaw'],
      ['正蹬', 'heavyKick'],
    ],
    heavy: [
      ['俯身重拳', 'heavyPunch'],
      ['托举上击', 'uppercut'],
      ['双掌震击', 'doublePalm'],
    ],
    directions: ['大幅上勾拳', '低身横踢', '单手提起掷出'],
    directionalMotions: ['uppercut', 'sweep', 'claw'],
    skills: [
      skill('魔族吐卵', 'spawnEgg', 30, 10, { ability: 'demon', startup: 0.8 }),
      skill('魔王震掌', 'doublePalm', 40, 5, { dmg: 18, range: 2.2, limitedArmor: 'light' }),
    ],
    ult: ultimate('爆力魔波', 'bakuriki', 120, 7, { shape: 'beam', width: 0.8 }),
  },
  tien: {
    stance: 'crane',
    light: [
      ['直掌', 'palmStrike'],
      ['折肘', 'elbow'],
      ['截腿', 'heavyKick'],
      ['推掌', 'doublePalm'],
    ],
    heavy: [
      ['下托挑击', 'uppercut'],
      ['空中托举', 'doublePalm'],
      ['排球式扣杀', 'volleySpike'],
    ],
    directions: ['双掌下托', '鹤流扫腿', '架臂过肩摔'],
    directionalMotions: ['doublePalm', 'sweep', 'doublePalm'],
    skills: [
      skill('太阳拳', 'solarFlare', 30, 8, { ability: 'solar', range: 3, control: 0.45 }),
      skill('四妖拳', 'transform', 40, 12, { ability: 'fourArms', startup: 0.6 }),
    ],
    ult: ultimate('气功炮', 'kikoho', 120, 9, { shape: 'beam', width: 0.65, lifeCost: 0.06 }),
  },
  krillin: {
    stance: 'low',
    light: [
      ['低身腹拳', 'jab'],
      ['反掌', 'palmStrike'],
      ['跃步双踢', 'heavyKick'],
      ['转身短拳', 'heavyPunch'],
    ],
    heavy: [
      ['滑步扫腿', 'sweep'],
      ['蹬地上冲拳', 'uppercut'],
      ['翻身踢', 'spinKick'],
    ],
    directions: ['低身上冲拳', '滑步扫腿', '钻身背摔'],
    directionalMotions: ['uppercut', 'sweep', 'doublePalm'],
    skills: [
      skill('低身疾踢', 'sweep', 30, 3, { dmg: 10, range: 1.45, level: 'low', drive: 8 }),
      skill('蓄力龟派气功', 'kamehameha', 40, 5, {
        dmg: 16,
        range: 6,
        shape: 'beam',
        width: 0.25,
        startup: 0.6,
      }),
    ],
    ult: ultimate('龟派气功', 'kamehameha', 150, 8, { shape: 'beam', width: 0.28 }),
  },
  yamcha: {
    stance: 'wolf',
    light: [
      ['左狼爪', 'claw'],
      ['右狼爪', 'backClaw'],
      ['交错连爪', 'claw'],
      ['突进推掌', 'rushPalm'],
    ],
    heavy: [
      ['蓄势扑进', 'rushPalm'],
      ['双爪撕击', 'backClaw'],
      ['狼牙终掌', 'doublePalm'],
    ],
    directions: ['上挑狼爪', '低身扫踢', '侧身绊摔'],
    directionalMotions: ['claw', 'sweep', 'doublePalm'],
    skills: [
      skill('狼牙突爪', 'claw', 30, 3, {
        dmg: 5,
        range: 1.65,
        hits: [0, 0.13],
        active: 0.23,
        drive: 8,
        ability: 'wolf',
      }),
      skill('狼牙侧步', 'catStep', 30, 5, { ability: 'sidestep' }),
    ],
    ult: ultimate('狼牙风风拳', 'claw', 180, 1.8, {
      hits: [0, 0.12, 0.24, 0.36],
      active: 0.46,
      shape: 'wolf',
      drive: 8,
      kb: 0.35,
      stun: 0.24,
    }),
  },
  gyumao: {
    stance: 'axe',
    light: [
      ['斧柄顶撞', 'axeJab'],
      ['反手推撞', 'axeJab'],
    ],
    heavy: [
      ['横斧大扫', 'axeSweep'],
      ['双手举斧劈落', 'axeChop'],
    ],
    directions: ['斧柄挑击', '低位横斧', '双手提起掷出'],
    directionalMotions: ['axeJab', 'axeSweep', 'axeJab'],
    skills: [
      skill('巨斧横扫', 'axeSweep', 30, 4, {
        dmg: 18,
        range: 3.2,
        startup: 0.45,
        limitedArmor: 'ordinary',
      }),
      skill('巨斧震地', 'axeChop', 40, 6, { dmg: 20, range: 3.4, shape: 'ground', startup: 0.6 }),
    ],
    ult: ultimate('巨斧连环破', 'axeSweep', 160, 3.5, { hits: [0, 0.35], active: 0.45 }),
  },
  chichi: {
    stance: 'kicker',
    light: [
      ['快掌', 'girlPalm'],
      ['前踢', 'girlKick'],
      ['回身踢', 'spinKick'],
      ['落步推掌', 'girlPalm'],
    ],
    heavy: [
      ['头盔撞击', 'headbutt'],
      ['腾空踢', 'girlKick'],
      ['翻身落踢', 'spinKick'],
    ],
    directions: ['腾身上踢', '回身扫腿', '转身绊摔'],
    directionalMotions: ['girlKick', 'sweep', 'girlPalm'],
    skills: [
      skill('头盔飞刃', 'bladeCast', 30, 3, { ability: 'blade', range: 5, dmg: 7 }),
      skill('疾步踢', 'girlKick', 30, 4, { dmg: 10, range: 1.5, ability: 'retreat' }),
    ],
    ult: ultimate('头盔光束连击', 'girlKick', 130, 8, {
      ability: 'helmetCombo',
      active: 0.18,
      recovery: 1,
    }),
  },
  bulma: {
    stance: 'defensive',
    light: [
      ['慌张推掌', 'selfDefense'],
      ['手包挥击', 'bagSwing'],
      ['后退踢', 'girlKick'],
    ],
    heavy: [
      ['枪托敲击', 'selfDefense'],
      ['手包重挥', 'bagSwing'],
      ['脱身蹬踢', 'girlKick'],
    ],
    directions: ['枪托上挑', '低位蹬踢', '扣腕推倒'],
    directionalMotions: ['selfDefense', 'sweep', 'selfDefense'],
    skills: [
      skill('胶囊掩体', 'capsuleCast', 30, 6, { ability: 'cover', startup: 0.6 }),
      skill('烟幕胶囊', 'capsuleCast', 30, 8, { ability: 'smoke' }),
    ],
    ult: ultimate('胶囊武装齐射', 'capsuleCast', 120, 8, {
      ability: 'barrage',
      shape: 'ability',
      active: 0.46,
    }),
  },
  chiaotzu: {
    stance: 'float',
    light: [
      ['悬浮指击', 'psychicPoke'],
      ['反手触击', 'psychicPoke'],
      ['小幅踢击', 'girlKick'],
      ['念力推掌', 'psychicPush'],
    ],
    heavy: [
      ['念力托起', 'psychicLift'],
      ['念力压落', 'psychicPush'],
    ],
    directions: ['念力上托', '低位念力扫击', '念力短距抛出'],
    directionalMotions: ['psychicLift', 'psychicPush', 'psychicPush'],
    skills: [
      skill('念力束缚', 'psychicPush', 30, 6, {
        dmg: 2,
        range: 4.2,
        shape: 'beam',
        width: 0.3,
        control: 1.15,
        startup: 0.24,
        active: 0.16,
        kb: 0,
      }),
      skill('悬浮退避', 'catStep', 30, 5, { ability: 'floatRetreat', startup: 0.15, active: 0.5 }),
    ],
    ult: ultimate('念力洞洞波连击', 'psychicPush', 110, 4, {
      shape: 'beam',
      width: 0.25,
      control: 0.3,
      ability: 'psychicVolley',
      active: 0.18,
      recovery: 1,
    }),
  },
  oolong: {
    stance: 'wobble',
    light: [
      ['慌张拍掌', 'pigSlap'],
      ['反手拍掌', 'pigSlap'],
      ['短腿踢', 'girlKick'],
      ['肚皮顶撞', 'pigBelly'],
    ],
    heavy: [
      ['蓄力肚撞', 'pigBelly'],
      ['扑倒', 'pigBelly'],
    ],
    directions: ['肚皮上顶', '低身横撞', '扑抱滚摔'],
    directionalMotions: ['pigBelly', 'pigBelly', 'pigBelly'],
    skills: [
      skill('巨鬼变化', 'transform', 30, 0, { ability: 'ogre', startup: 0.32 }),
      skill('蝙蝠变化', 'transform', 30, 0, { ability: 'bat', startup: 0.32 }),
    ],
    ult: ultimate('变化奇袭', 'pigBelly', 140, 1.7, {
      hits: [0, 0.35, 0.7],
      active: 0.8,
      ability: 'shapeRush',
      drive: 5,
    }),
  },
  korin: {
    stance: 'cat',
    light: [
      ['猫爪点打', 'catClaw'],
      ['反爪', 'catClaw'],
      ['短杖轻敲', 'caneTap'],
      ['侧步反敲', 'caneTap'],
    ],
    heavy: [
      ['杖扫脚踝', 'caneTap'],
      ['杖头压击', 'caneTap'],
    ],
    directions: ['杖头上挑', '短杖扫踝', '勾脚杖绊'],
    directionalMotions: ['caneTap', 'caneTap', 'caneTap'],
    skills: [
      skill('卡林残像步', 'catStep', 30, 4, { ability: 'catStep', startup: 0.12 }),
      skill('仙豆储备', 'beanEat', 30, 0, { ability: 'heal', startup: 0.95, recovery: 0.4 }),
    ],
    ult: ultimate('夺水试炼', 'caneTap', 140, 1.65, {
      hits: [0, 0.12, 0.24, 0.36],
      active: 0.46,
      drive: 8,
      ability: 'trial',
    }),
  },
  pilaf: {
    stance: 'mech',
    light: [
      ['左机械拳', 'mechPunch'],
      ['右机械拳', 'mechPunch'],
      ['机甲肩撞', 'mechRam'],
    ],
    heavy: [
      ['液压重拳', 'mechPunch'],
      ['双臂砸落', 'mechRam'],
      ['推进撞击', 'mechRam'],
    ],
    directions: ['机械臂上挑', '低位机械横扫', '机械钳抱摔'],
    directionalMotions: ['mechPunch', 'mechRam', 'mechRam'],
    skills: [
      skill('机甲武装切换', 'mechArm', 30, 5, { ability: 'weapon', startup: 0.4 }),
      skill('装甲架势', 'mechArm', 40, 8, { ability: 'armor', startup: 0.35 }),
    ],
    ult: ultimate('三机合体突击', 'mechRam', 130, 2.7, {
      ability: 'combine',
      startup: 0.65,
      active: 1.55,
      recovery: 0.8,
      contactDelay: 1.45,
      drive: 0,
    }),
  },
};
function skill(name, motion, cost, cooldown, extra = {}) {
  return {
    name,
    motion,
    kiCost: cost,
    cooldown,
    startup: 0.3,
    active: 0.1,
    recovery: 0.4,
    dmg: 0,
    range: 1.5,
    stun: 0.3,
    kb: 2,
    guardDamage: 18,
    level: 'mid',
    ...extra,
  };
}
function ultimate(name, motion, dmg, range, extra = {}) {
  return {
    name,
    motion,
    dmg,
    range,
    kiCost: 100,
    startup: 0.65,
    active: 0.2,
    recovery: 0.8,
    stun: 0.4,
    kb: 3,
    guardDamage: 36,
    level: 'mid',
    ...extra,
  };
}

export function register({ characters, animation, combat, ai }) {
  return function initialize() {
    for (const c of characters.CHARACTERS) {
      const p = YOUTH_PROFILES[c.id];
      c.youth = p;
      if (c.id === 'taopaipai') {
        const build = c.buildBody;
        c.buildBody = () => {
          const body = build();
          body.parts.finger = characters.meshTo(
            body.parts.handR,
            new THREE.CapsuleGeometry(0.037, 0.23, 4, 8),
            characters.M(0xf2bc8e),
            0,
            -0.2,
            0,
          );
          body.parts.finger.visible = false;
          return body;
        };
      }
      c.name = c.id === 'krillin' ? '克林' : c.name;
      c.resource ??= '气';
      c.role ??= c.title;
      for (const type of ['light', 'heavy']) {
        const old = c.combos[type];
        c.combos[type] = p[type].map(([name, motion], i, list) => {
          const index =
            list.length === 4
              ? i
              : list.length === 3
                ? [0, 1, old.length - 1][i]
                : [0, old.length - 1][i];
          const base = old[index];
          const last = i === list.length - 1;
          const a = combat.finalizeMove({
            ...base,
            id: (type === 'light' ? 'l' : 'h') + (i + 1),
            name,
            motion,
            hits: undefined,
            ability: undefined,
            shape: undefined,
            armor: false,
            chainType: type,
            chainIndex: i,
            terminal: last,
            level: /sweep|Sweep/.test(motion) || name.includes('脚踝') ? 'low' : 'mid',
            cancelRules: {
              hit: last
                ? ['special', 'ult', 'pursuit']
                : type === 'light'
                  ? ['light', 'heavy', 'special', 'ult', 'dash', 'pursuit']
                  : ['heavy', 'pursuit'],
              block: type === 'light' && !last ? ['light'] : [],
              whiff: [],
            },
          });
          if (c.id === 'tien' && type === 'heavy') {
            a.launch = last ? undefined : 5.8;
            a.knockdown = last;
            a.kb = last ? 4 : 0.3;
            a.stun = last ? 0.5 : 0.65;
          }
          if (c.id === 'chiaotzu' && type === 'heavy') {
            a.shape = 'beam';
            a.width = 0.28;
            a.control = 0.25;
            a.launch = last ? undefined : 4;
            a.knockdown = last;
          }
          if (c.id === 'gyumao' && type === 'heavy' && last) a.groundImpact = true;
          a.effector = animation.youthEffector(motion, i, c.id);
          a.authored = true;
          a.anim = animation.authorYouthMove(c, a, i);
          return a;
        });
      }
      c.skills = p.skills.map((s, i) => {
        const a = combat.finalizeMove({
          ...s,
          id: 'special',
          variant: i,
          shape: s.ability && s.ability !== 'retreat' && s.ability !== 'wolf' ? 'ability' : s.shape,
          isYouth: true,
          authored: true,
          cancelRules: { hit: ['ult'], block: [], whiff: [] },
        });
        a.effector = animation.youthEffector(a.motion, 0, c.id);
        a.anim = animation.authorYouthMove(c, a, i);
        return a;
      });
      c.ult = combat.finalizeMove({
        ...p.ult,
        id: 'ult',
        isUlt: true,
        isYouth: true,
        authored: true,
        costCommitted: true,
        cancelRules: { hit: [], block: [], whiff: [] },
      });
      c.ult.effector = c.id === 'yamcha' ? 'both' : animation.youthEffector(c.ult.motion, 0, c.id);
      c.ult.anim = animation.authorYouthMove(c, c.ult, 0);
      c.ultName = c.ult.name;
      c.ultStyle = p.ult.motion;
      c.ultAnim = c.ult.anim;
      c.ultTiming = { windup: c.ult.startup, fire: c.ult.startup };
      combat.SPECIAL_MOVES[c.id] = c.skills[0];
      characters.LEGACY_ULT_PROFILES[c.id] = c.ult;
      c.tactics ??= { distance: 0.95, plan: c.role };
      ai.TACTICS[c.id] ??= { near: c.tactics.distance, control: 2 };
      c.tactics.basic = c.combos.light.map((a) => a.name).join(' → ');
      c.tactics.resource =
        c.skills
          .map(
            (s, i) =>
              `${i ? 'S+R' : 'R'} ${s.name}：${s.kiCost} ${c.resource}，冷却${s.cooldown}秒${s.ability === 'ogre' || s.ability === 'bat' ? '（恢复本体后3秒）' : ''}`,
          )
          .join('；') + `；U ${c.ultName}：100 ${c.resource}`;
      c.tactics.mechanic = {
        goku: '满月夜、生命≤25%、50气、在地面且尾巴完整，才能变大猩猩；每回合成功一次，持续10秒。白天不可用。',
        roshi:
          '残像反掌防反窗口0.36秒，远程攻击反弹、近战直接击飞，投技可破解；肌肉强化持续8秒，每秒耗5气，重击及远程增强15%，移动减慢。',
        taopaipai: '洞洞波释放后方向锁定；后撤掌无无敌，可追击其收招。',
        piccolo: '吐卵召唤一名丹巴林，生命24、持续6秒；魔王震掌有效期可承受一次轻击但仍受伤。',
        tien: '太阳拳须正面目视且无掩体；四妖拳持续8秒，每秒耗4气，连招增强10%；气功炮另扣最大生命6%。',
        krillin: '低身疾踢避开实际高位攻击；第二技能固定蓄力0.6秒；大招为龟派气功。',
        yamcha: '狼牙突爪命中后0.25秒内再按R追加6伤害终掌，或用第二技能侧移；格挡不开追击窗口。',
        gyumao: '巨斧横扫可承受一次普通打击；巨斧震地只能打地面，跳跃可躲。',
        chichi: '头盔飞刃往返各命中一次，回收前不可重发；疾步踢打空也退步，可追击。',
        bulma:
          '掩体生命30、持续8秒，双方均不可穿射；烟幕半径1.8、持续3秒，双方瞄准与AI观察均受遮挡。',
        chiaotzu:
          '念力束缚实际命中后控制1.15秒，受击会解除；4秒内控制按100%、50%、25%衰减，随后暂时免疫。',
        oolong:
          '巨鬼变化5秒，体型变大但伤害不增加；蝙蝠3秒、移速×1.3且无法攻击；再按对应按钮恢复，受伤会解除。',
        korin:
          '残像步闪避仅0.075秒，0.35秒内轻击可反敲；仙豆前摇0.95秒，成功恢复12%生命，每回合一次。',
        pilaf:
          '导弹与喷火武装持续到下次切换；装甲架势持续3秒，仅一次承伤保护；大招修、舞两机实际接合。',
      }[c.id];
      c.tactics.weak = '技能前摇可打断，打空后可反击；特殊能力的条件与冷却见招式指南。';
      ai.V2_TACTICS[c.id] = c.tactics;
      ai.TACTICS[c.id].notes = c.tactics.basic + '\n' + c.tactics.resource + '\n' + c.tactics.weak;
      c.directionMoves = p.directionalMotions.slice(0, 2).map((motion, i) => {
        const f = {
          def: c,
          baseScale:
            {
              goku: 0.95,
              roshi: 1.04,
              taopaipai: 1.16,
              piccolo: 1.48,
              tien: 1.28,
              krillin: 0.79,
              yamcha: 1,
            }[c.id] ?? 1,
        };
        const a =
          characters.CHARACTERS.indexOf(c) < 7
            ? characters.legacyDirectionMove(f, c.combos.heavy[0], { up: !i, down: !!i })
            : combat.v2DirectionalMove(f, c.combos.heavy[0], { up: !i, down: !!i });
        Object.assign(a, {
          name: p.directions[i],
          motion,
          authored: true,
          effector: animation.youthEffector(motion, 0, c.id),
        });
        a.anim = animation.authorYouthMove(c, a, i);
        return a;
      });
      const throwBase =
        characters.CHARACTERS.indexOf(c) < 7
          ? combat.finalizeMove({
              id: 'throw',
              isThrow: true,
              unblockable: true,
              dmg: 12,
              startup: 0.15,
              active: 0.045,
              recovery: 0.505,
              stun: 0.65,
              kb: 5.8,
              range: 1.36,
              ki: 8,
            })
          : combat.v2ThrowMove({ def: c });
      c.throwMove = {
        ...throwBase,
        name: p.directions[2],
        motion: p.directionalMotions[2],
        authored: true,
        effector: 'both',
      };
      c.throwMove.anim = animation.authorYouthMove(c, c.throwMove, 0);
    }
  };
}
