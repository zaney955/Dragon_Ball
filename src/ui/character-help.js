// Player-facing explanations. Costs and cooldowns come from the live roster.
import { FLIGHT_RULES } from '../combat/flight.js';
export const CHARACTER_HELP = {
  goku: {
    summary: '用如意棒控制距离，命中后追击；濒危时可在满月夜变身。主动残像每回合3次。',
    tip: 'W + R 挑空；S + R 猜拳；满月夜低于50%总生命自动变巨猿。',
    skills: [
      '伸长如意棒下砸，控制前方距离。按住前进键再按主技能，改为如意挑空。',
      '消耗40能量，随机出剪刀、石头或布，每种约30基础伤害。满月夜总生命低于50%自动巨猿变身：持续10秒，移速60%，重击、两技能和大招慢速霸体；尾巴被三次不同攻击命中提前恢复。',
    ],
    ultimate: '向前发射龟派气功波；巨猿形态改为慢速霸体震地。',
    drill: [
      ['靠近对手，按 R，用如意延伸命中。', 'contactPrimary'],
      ['按 S + R，用随机猜拳命中。', 'contactSecondary'],
    ],
  },
  roshi: {
    summary: '抓住对手出招时机防反，再用肌肉强化提升火力。',
    tip: '攻击到来时防反；肌肉强化持续耗能。',
    skills: [
      '起手0.1秒后有0.36秒防反窗口：近战击飞、远程反弹。投技可破解，长按不会持续防反。',
      '地面发动，持续8秒，每秒消耗5能量；攻击与移速增加30%。能量耗尽时提前结束，恢复老年形态后虚弱2秒。',
    ],
    ultimate: '魔封波造成伤害并短暂束缚对手，可以格挡，不会直接判定获胜。',
    drill: [
      ['对手会定时轻击；在攻击到来时按 R 防反。', 'counter'],
      ['按 S + R 发动肌肉强化。', 'muscle'],
    ],
  },
  taopaipai: {
    summary: '用洞洞波牵制，用后撤掌拉开近身距离。背后攻击伤害增加50%。',
    tip: 'F 小型洞洞波；出手前先对准对手。',
    skills: [
      '向前发射洞洞波，发射后方向锁定；对手可以侧移躲避。',
      '短距掌击后向后退1.2米；没有无敌保护，打空后仍可能被追击。',
    ],
    ultimate: '起手蓄力0.7秒后发射强化洞洞波。按一次即可，不需要长按。',
    drill: [
      ['按 R，用洞洞波命中。', 'contactPrimary'],
      ['靠近对手，按 S + R，用后撤掌命中。', 'contactSecondary'],
    ],
  },
  piccolo: {
    summary:
      '召唤丹巴林干扰对手，自己用重掌和气功压制。致命伤时若有50能量，消耗50能量恢复10%总生命；整场仅一次，之后禁用大招、聚气速度减半。',
    tip: '丹巴林干扰；震掌可承受一次轻击，仍会受伤。',
    skills: [
      '召唤一名丹巴林，生命24、持续6秒；会主动扑击，可被攻击消灭。在场时不能重复召唤。',
      '近身震掌，出招有效期可承受一次轻击而不被打断，仍然受到伤害。',
    ],
    ultimate: '向前发射爆力魔波，覆盖较宽的射击区域。',
    drill: [
      ['按 R 召唤丹巴林。', 'demon'],
      ['靠近对手，按 S + R，用魔王震掌命中。', 'contactSecondary'],
    ],
  },
  tien: {
    summary: '太阳拳制造反向操作机会，四妖拳强化连招。第三只眼受击时3%概率自动残像，不扣主动次数。',
    tip: '太阳拳需正面相望；U 额外扣血。',
    skills: [
      '需3米内、正面相望且无遮挡。命中后短暂控制，前后左右与方向招式反向3秒，格挡和普通攻击按键不变；背向、掩体和格挡可防太阳拳。',
      '地面发动，持续10秒，攻击速度增加30%，连招伤害增强10%。',
    ],
    ultimate: '额外扣除最大生命的20%，生命不足会倒下。',
    drill: [
      ['双方正面相望时按 R，用太阳拳命中。', 'reverseDirections'],
      ['按 S + R 发动四妖拳。', 'fourArms'],
    ],
  },
  krillin: {
    summary: '低姿态疾踢切入，拉开距离后使用蓄力气功。完美防御后自动反击。',
    tip: 'F 发气弹；S + R 点按后自动蓄力。',
    skills: [
      '低身向前疾踢，属于下段攻击，可以避开实际高位攻击；对手可下蹲格挡。',
      '固定蓄力0.6秒后发射龟派气功；按一次即可，蓄力期间可被打断。',
    ],
    ultimate: '向前发射龟派气功，点按发动。',
    drill: [
      ['靠近对手，按 R，用低身疾踢命中。', 'contactPrimary'],
      ['按 S + R，等待蓄力气功发射并命中。', 'contactSecondary'],
    ],
  },
  yamcha: {
    summary:
      '狼牙突爪命中后追加终掌，侧步避开攻击后背袭。残像上限1次，用后10秒恢复；连续4次受击触发更远的击飞保护。',
    tip: 'R 命中后0.25秒内再按 R 追加终掌。',
    skills: [
      '狼爪命中后，0.25秒内再次按主技能可追加狼牙终掌，不额外消耗能量。被格挡时不能追加。',
      '起手0.1秒后有0.32秒闪避窗口。避开近战、投射物、光束或太阳拳后自动背袭。未避开攻击时只侧移，投技可破解。',
    ],
    ultimate: '向前突进，连续狼爪攻击；需要保持近身距离。',
    drill: [
      ['靠近对手按 R；命中后立即再按 R，用狼牙终掌命中。', 'wolfFinish'],
      ['先靠近对手；对手会定时轻击，按 S + R 成功闪避并背袭。', 'dodgeCounter'],
    ],
  },
  gyumao: {
    summary:
      '用巨斧控制中近距离，重击和技能带霸体。重击在地面留下5秒火区，站在火区每秒损失2生命；自身免疫火焰。',
    tip: '无远程；重击、技能与必杀在起手和有效期霸体；收招可打断。',
    skills: [
      '横扫前方，斧柄与斧刃都能命中；起手与挥斧霸体、承伤60%；收招无霸体，可被反击。',
      '巨斧砸地产生震波，只能命中地面目标；跳跃可以躲避；收招无霸体，可被反击。',
    ],
    ultimate:
      '起手0.95秒后举斧砸地，攻击前方3.5米地面区域；起手与砸地霸体，收招无霸体；空中目标可躲避。',
    drill: [
      ['靠近对手按 K，用重击命中。', 'heavy'],
      ['按 S + R，用巨斧震地命中地面上的对手。', 'contactSecondary'],
    ],
  },
  chichi: {
    summary: '飞刃往返牵制，疾步踢命中后拉开距离。F键气功类远程伤害减半，其他技能与大招不减免。',
    tip: 'F 头盔光束；飞刃回收后才能重发。',
    skills: [
      '投出头盔飞刃，去程和回程各能命中一次；遇障碍会提前回收，回收前不能重发。',
      '向前踢击后退步，即使打空也会后退，收招仍可被追击。',
    ],
    ultimate: '先踢击，再发射头盔光束；首踢落空时仍沿原方向射出光束。',
    drill: [
      ['按 R 投出飞刃，等它返回。', 'bladeReturn'],
      ['按 F，用头盔光束命中。', 'remote'],
    ],
  },
  bulma: {
    summary: '用手枪牵制，随机胶囊提供不同装备。',
    tip: 'F 开枪；每次胶囊随机抽取一种效果。',
    skills: [
      '随机获得机甲、麻醉枪、炸弹、浮空滑板或RPG。机甲减伤30%、持续8秒；滑板加速30%、持续8秒；其余装备立即射出。',
      '与主技能共享随机效果池，独立冷却。',
    ],
    ultimate: '连续进行四次装备射击，按一次自动完成。',
    drill: [
      ['按 R，释放随机胶囊。', 'capsule'],
      ['按 F，用手枪命中。', 'remote'],
      ['按 S + R，释放备用随机胶囊。', 'capsule'],
    ],
  },
  chiaotzu: {
    summary: '用念力束缚限制对手，再用悬浮退避拉开距离。念力束缚期间每秒吸取12能量，最多吸到100。',
    tip: '束缚命中生效；连续控制会递减。',
    skills: [
      '4.2米窄幅攻击，命中束缚1.15秒，任一方受击即解除。4秒内重复控制依次为100%、50%、25%，随后暂时免疫。',
      '升高0.8米并后退1.2米，不提供无敌保护。',
    ],
    ultimate: '念力攻击后连续发射三次洞洞波；控制同样受重复控制递减影响。',
    drill: [
      ['按 R，让念力束缚实际命中。', 'control'],
      ['按 S + R 发动悬浮退避。', 'floatRetreat'],
    ],
  },
  oolong: {
    summary: '巨鬼惊吓换取撤退空间，蝙蝠用于转移；变化不增加伤害。',
    tip: '再按对应技能恢复本体；蝙蝠形态不能攻击。',
    skills: [
      '地面变身，持续5秒；起势后推开正前方2.4米内未防御、未攻击的地面对手1.2米，对方可立即行动。格挡、抢招、跳跃或拉远都可应对。再按主技能免费恢复，受击也会解除。',
      '地面变身，持续3秒，速度提升30%，不能攻击。再按第二技能免费恢复，受击也会解除。',
    ],
    ultimate: '随机变成乌龙以外的一名角色，立即自动施放其大招；释放完毕恢复本体。',
    drill: [
      ['按 R 变成巨鬼。', 'ogre'],
      ['再次按 R，或等待形态结束，恢复本体。', 'normal'],
      ['按 S + R 变成蝙蝠。', 'bat'],
      ['再次按 S + R，或等待形态结束，恢复本体。', 'normal'],
    ],
  },
  korin: {
    summary: '残像步后接短杖反敲，保留仙豆恢复生命。',
    tip: 'R 后0.35秒内按 J 反敲；仙豆开局1颗，最多存2颗。',
    skills: [
      '侧移1.2米，闪避保护仅0.075秒；0.35秒内按轻击可用短杖反敲。',
      '地面使用，起手0.95秒后恢复最大生命的19.5%，满血不可用。被打断可重试，能量不返还；拾取场地仙豆存入储备，最多2颗。',
    ],
    ultimate: '近身连续短杖攻击，以夺水试炼压制对手。',
    drill: [
      ['按 S + R 吃仙豆，恢复生命。', 'selfHeal'],
      ['等吃豆动作结束后，按 R 侧移，再在0.35秒内按 J 发动短杖反敲。', 'catCounter'],
    ],
  },
  pilaf: {
    summary:
      '导弹打远处，喷火打近身；喷火持续2秒，期间可以移动和攻击。灼烧持续3秒，每秒5点伤害。始终每秒恢复3能量。',
    tip: 'R 切换武装，F 发射；能量不足时按住 I 聚气。',
    skills: [
      '切换导弹与喷火，武装保持到下次切换。动作结束后按 F 发射。',
      '持续3秒，可承受一次攻击而不被打断，仍会掉血。投技、必杀与投射物不受此保护。',
    ],
    ultimate: '三机合体后发动突击，同时发射两枚导弹；合体结束恢复单机。',
    drill: [
      ['按 F，用导弹命中对手。', 'missile'],
      ['按 R 切换为喷火。能量不足时按住 I 聚气。', 'flameMode'],
      ['等切换动作结束后，靠近对手按 F，用喷火命中。', 'flame'],
    ],
  },
};

export const INPUT_LABELS = {
  one: {
    move: 'WASD',
    light: 'J',
    heavy: 'K',
    block: 'L',
    charge: 'I',
    remote: 'F',
    primary: 'R',
    secondary: 'S + R',
    ultimate: 'U',
    jump: 'Space',
    crouch: 'C',
    dash: 'Shift',
    throw: 'O',
    evasion: 'Q',
    pursuit: 'E',
    backflip: 'S + E',
    burst: 'L + Shift',
    forward: 'W',
  },
  two: {
    move: '方向键',
    light: '小键盘 1',
    heavy: '小键盘 2',
    block: '小键盘 4',
    charge: '小键盘 5',
    remote: '小键盘 −',
    primary: '小键盘 +',
    secondary: '↓ + 小键盘 +',
    ultimate: '小键盘 3',
    jump: '小键盘 0',
    crouch: '小键盘 .',
    dash: '小键盘 6',
    throw: '小键盘 7',
    evasion: '小键盘 8',
    pursuit: '小键盘 9',
    backflip: '↓ + 小键盘 9',
    burst: '小键盘 4 + 6',
    forward: '↑',
  },
  touch: {
    move: '方向按钮',
    light: '轻击',
    heavy: '重击',
    block: '格挡',
    charge: '聚气',
    remote: '远程按钮',
    primary: '主技能按钮',
    secondary: '第二技能按钮',
    ultimate: '必杀按钮',
    jump: '跳跃按钮',
    crouch: '下蹲',
    dash: '闪身',
    throw: '投技',
    evasion: '残像',
    pursuit: '爆冲',
    backflip: '↓ + 爆冲',
    burst: '格挡 + 闪身',
    forward: '↑',
  },
};

export function inputCopy(text, keys = INPUT_LABELS.one) {
  return text
    .replaceAll('S + R', keys.secondary)
    .replaceAll('W + R', `${keys.forward} + ${keys.primary}`)
    .replace(
      /\b[FRUJKI]\b/g,
      (key) =>
        keys[
          { F: 'remote', R: 'primary', U: 'ultimate', J: 'light', K: 'heavy', I: 'charge' }[key]
        ],
    );
}

export function remoteAction(id, weapon = 'missile') {
  if (['gyumao', 'oolong', 'korin'].includes(id)) return { name: '无远程', cost: 0, range: 0 };
  if (id === 'pilaf')
    return weapon === 'flame'
      ? { name: '喷火', cost: 12, range: 2.5 }
      : { name: '导弹', cost: 10, range: 8 };
  if (id === 'bulma') return { name: '手枪', cost: 5, range: 8 };
  if (id === 'chichi') return { name: '头盔光束', cost: 8, range: 8 };
  return {
    name: ['taopaipai', 'tien', 'chiaotzu'].includes(id) ? '洞洞波' : '气弹',
    cost: 5,
    range: 8,
  };
}

export function jumpAction(id) {
  return FLIGHT_RULES[id]?.name ?? '跳跃';
}

export function skillReason(info, fighter) {
  if (info.reason === '资源不足') return `能量不足，还差${Math.ceil(info.cost - fighter.ki)}`;
  if (info.reason === '等待行动恢复') return fighter.hp <= 0 ? '已倒下' : '等待动作结束';
  if (info.reason === '本回合已变身' && !fighter.youth.tailIntact) return '尾巴已断';
  return info.reason.replace(/s$/, '秒').replace('可发动', '就绪');
}

export function skillCost(skill) {
  const cooldown = ['ape', 'heal'].includes(skill.ability)
    ? skill.ability === 'heal'
      ? '消耗1颗储备仙豆（最多2颗）'
      : '每回合1次'
    : ['ogre', 'bat'].includes(skill.ability)
      ? '恢复本体后冷却3秒'
      : skill.cooldown
        ? `冷却${skill.cooldown}秒`
        : '无冷却';
  return `${skill.kiCost} 能量 · ${cooldown}`;
}

export function actionAvailability(fighter, cost, game, unavailable = '') {
  if (unavailable) return unavailable;
  if (game.over || fighter.hp <= 0) return '回合结束';
  if (game.paused) return '已暂停';
  if (game.ready > 0) return '开场准备';
  if (
    ['bat', 'combined'].includes(fighter.youth?.form) ||
    fighter.youth?.form?.startsWith('mimic:')
  )
    return '当前形态不可用';
  if (
    fighter.attack ||
    ['hit', 'blockstun', 'guardbreak', 'knockdown', 'grabbed', 'dead', 'landing', 'block'].includes(
      fighter.state,
    )
  )
    return '等待动作结束';
  if (fighter.ki < cost) return `能量不足，还差${Math.ceil(cost - fighter.ki)}`;
  return '就绪';
}
