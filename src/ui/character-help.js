// Player-facing explanations. Costs and cooldowns come from the live roster.
export const CHARACTER_HELP = {
  goku: {
    summary: '用如意棒控制距离，命中后追击；濒危时可在满月夜变身。',
    tip: 'F 发气弹；R 延长如意棒；W + R 挑空。大猩猩需要满月和低生命。',
    skills: [
      '伸长如意棒下砸，控制前方距离。按住前进键再按主技能，改为如意挑空。',
      '仅满月夜、生命不高于25%、站在地面、尾巴完整时可用，每回合成功一次。变身10秒，移动速度降至60%；不能使用棒术、筋斗云、远程和必杀。尾巴被三次不同攻击命中会提前恢复。',
    ],
    ultimate: '向前发射龟派气功波。大猩猩形态不能使用。',
    caution: '变身起手可被打断；恢复后不会免费回血。',
    drill: [
      ['靠近对手，按 R，用如意延伸命中。', 'contactPrimary'],
      ['按 S + R 变成大猩猩。本练习已设为满月夜和25%生命。', 'ape'],
    ],
  },
  roshi: {
    summary: '抓住对手出招时机防反，再用肌肉强化提升火力。',
    tip: 'R 迎击来袭攻击；S + R 强化8秒，期间持续消耗能量。',
    skills: [
      '起手0.1秒后进入0.36秒防反窗口：近战命中窗口会被击飞，远程会被反弹。投技可以破解，不能一直按住防反。',
      '在地面发动，强化8秒；每秒消耗5能量，重击和远程增强15%，移动速度降至85%。能量耗尽或时间结束恢复。',
    ],
    ultimate: '魔封波造成伤害并短暂束缚对手，可以格挡，不会直接判定获胜。',
    caution: '防反与普通格挡不同，必须在攻击到来时发动。',
    drill: [
      ['对手会定时轻击；在攻击到来时按 R 防反。', 'counter'],
      ['按 S + R 发动肌肉强化。', 'muscle'],
    ],
  },
  taopaipai: {
    summary: '用洞洞波牵制，用后撤掌拉开近身距离。',
    tip: 'F 发射小型洞洞波；R 发射技能光束；S + R 掌击后退。',
    skills: [
      '向前发射洞洞波，发射后方向锁定；对手可以侧移躲避。',
      '短距掌击后向后退1.2米；没有无敌保护，打空后仍可能被追击。',
    ],
    ultimate: '起手蓄力0.7秒后发射强化洞洞波。按一次即可，不需要长按。',
    caution: '洞洞波不是自动追踪，出手前先对准对手。',
    drill: [
      ['按 R，用洞洞波命中。', 'contactPrimary'],
      ['靠近对手，按 S + R，用后撤掌命中。', 'contactSecondary'],
    ],
  },
  piccolo: {
    summary: '召唤丹巴林干扰对手，自己用重掌和气功压制。',
    tip: 'R 召唤一名丹巴林；S + R 震掌只有一次轻击承伤保护。',
    skills: [
      '召唤一名丹巴林，生命24、持续6秒；会主动扑击，可被攻击消灭。在场时不能重复召唤。',
      '近身震掌，出招有效期可承受一次轻击而不被打断，仍然受到伤害。',
    ],
    ultimate: '向前发射爆力魔波，覆盖较宽的射击区域。',
    caution: '丹巴林不会永久存在，魔王震掌也不是无敌。',
    drill: [
      ['按 R 召唤丹巴林。', 'demon'],
      ['靠近对手，按 S + R，用魔王震掌命中。', 'contactSecondary'],
    ],
  },
  tien: {
    summary: '太阳拳制造反向操作机会，四妖拳强化连招。',
    tip: 'R 太阳拳需要双方正面相望；S + R 持续耗能；U 另扣生命。',
    skills: [
      '需在3米内、双方正面相望且没有掩体阻挡。命中后短暂控制，并让对手方向键反向3秒；可以被格挡。',
      '在地面发动四妖拳，持续8秒，每秒消耗4能量；连招伤害增强10%。能量耗尽或时间结束恢复。',
    ],
    ultimate: '气功炮消耗100能量，并额外扣除最大生命的6%，至少保留1生命。',
    caution: '对手背对你、距离太远或有掩体时，太阳拳不会生效。',
    drill: [
      ['双方正面相望时按 R，用太阳拳命中。', 'reverseDirections'],
      ['按 S + R 发动四妖拳。', 'fourArms'],
    ],
  },
  krillin: {
    summary: '低姿态疾踢切入，拉开距离后使用蓄力气功。',
    tip: 'F 点按发气弹；S + R 才是蓄力龟派气功，按一次自动蓄力。',
    skills: [
      '低身向前疾踢，属于下段攻击，可以避开实际高位攻击；对手可下蹲格挡。',
      '固定蓄力0.6秒后发射龟派气功；按一次即可，蓄力期间可被打断。',
    ],
    ultimate: '发射龟派气功；与第二技能分别使用，不需要长按远程键。',
    caution: 'F 不提供长按蓄力。',
    drill: [
      ['靠近对手，按 R，用低身疾踢命中。', 'contactPrimary'],
      ['按 S + R，等待蓄力气功发射并命中。', 'contactSecondary'],
    ],
  },
  yamcha: {
    summary: '狼牙突爪命中后追加终掌，侧步避开攻击后背袭。',
    tip: 'R 命中后0.25秒内再按 R 追加；S + R 成功闪避后自动背袭。',
    skills: [
      '狼爪命中后，0.25秒内再次按主技能可追加狼牙终掌，不额外消耗能量。被格挡时不能追加。',
      '起手0.1秒后有0.32秒闪避窗口。成功避开近战、投射物、光束或太阳拳后，闪到对手背后反掌击飞。未触发时只侧移，投技可以破解。',
    ],
    ultimate: '向前突进，连续狼爪攻击；需要保持近身距离。',
    caution: '远处挥空不能触发侧步背袭。',
    drill: [
      ['靠近对手按 R；命中后立即再按 R，用狼牙终掌命中。', 'wolfFinish'],
      ['先靠近对手；对手会定时轻击，按 S + R 成功闪避并背袭。', 'dodgeCounter'],
    ],
  },
  gyumao: {
    summary: '用巨斧控制中近距离，重击和技能带霸体。',
    tip: '没有远程攻击。重击、技能、必杀不会被打断，但仍承受60%伤害。',
    skills: [
      '横扫前方，斧柄与斧刃都能命中；全程霸体，仍承受60%伤害。',
      '巨斧砸地产生震波，只能命中地面目标；跳跃可以躲避，全程霸体。',
    ],
    ultimate: '起手0.95秒后举斧砸地，攻击前方3.5米地面区域；全程霸体，空中目标可躲避。',
    caution: '轻击和待机没有同样的霸体保护；F 无远程攻击。',
    drill: [
      ['靠近对手按 K，用重击命中。', 'heavy'],
      ['按 S + R，用巨斧震地命中地面上的对手。', 'contactSecondary'],
    ],
  },
  chichi: {
    summary: '飞刃往返牵制，疾步踢命中后拉开距离。',
    tip: 'F 发射头盔光束；R 投出飞刃，回收前不能再次投出。',
    skills: [
      '投出头盔飞刃，去程和回程各能命中一次；遇障碍会提前回收，回收前不能重发。',
      '向前踢击后退步，即使打空也会后退，收招仍可被追击。',
    ],
    ultimate: '先踢击，再发射头盔光束；首踢落空时仍沿原方向射出光束。',
    caution: '飞刃与F光束是两种独立攻击。',
    drill: [
      ['按 R 投出飞刃，等它返回。', 'bladeReturn'],
      ['按 F，用头盔光束命中。', 'remote'],
    ],
  },
  bulma: {
    summary: '用手枪牵制，通过掩体和烟幕改变交战位置。',
    tip: 'F 开枪；R 放掩体；S + R 放烟幕。掩体和烟幕也影响自己。',
    skills: [
      '在身前1.2米放置一座掩体，生命30、持续8秒；双方移动和非穿透射击都会被阻挡，最多一座。',
      '在前方放出烟幕，半径1.8米、持续3秒；冻结双方辅助瞄准和电脑观察，不是单方面隐身。',
    ],
    ultimate: '连续进行四次装备射击，按一次自动完成。',
    caution: '先绕过自己的掩体再射击，避免子弹被挡。',
    drill: [
      ['按 R 放置掩体。', 'cover'],
      ['绕过掩体，按 F，用手枪命中。', 'remote'],
      ['按 S + R 放出烟幕。', 'smoke'],
    ],
  },
  chiaotzu: {
    summary: '用念力束缚限制对手，再用悬浮退避拉开距离。',
    tip: 'R 束缚需实际命中；S + R 升高后退，没有无敌保护。',
    skills: [
      '发出窄幅念力攻击，范围4.2米；实际命中后束缚1.15秒，施术者或目标受击会解除。4秒内重复控制依次为100%、50%、25%，随后暂时免疫。',
      '升高0.8米并后退1.2米，没有无敌保护；可以在移动后继续调整站位。',
    ],
    ultimate: '念力攻击后连续发射三次洞洞波；控制同样受重复控制递减影响。',
    caution: '连续束缚不会一直保持完整控制时间。',
    drill: [
      ['按 R，让念力束缚实际命中。', 'control'],
      ['按 S + R 发动悬浮退避。', 'floatRetreat'],
    ],
  },
  oolong: {
    summary: '通过变化调整外形和移动；巨鬼并不增加伤害。',
    tip: 'R 变巨鬼，S + R 变蝙蝠；再次按对应技能恢复本体。',
    skills: [
      '在地面变成巨鬼，持续5秒，只改变外形，不增加伤害或生命。再次按主技能可免费恢复，受伤也会解除。',
      '在地面变成蝙蝠，持续3秒，速度提升30%，不能攻击。再次按第二技能可免费恢复，受伤也会解除。',
    ],
    ultimate: '以变化形态进行连续近身奇袭，随后恢复本体。',
    caution: '两种变化都在恢复本体后冷却3秒；F 无远程攻击。',
    drill: [
      ['按 R 变成巨鬼。', 'ogre'],
      ['再次按 R，或等待形态结束，恢复本体。', 'normal'],
      ['按 S + R 变成蝙蝠。', 'bat'],
      ['再次按 S + R，或等待形态结束，恢复本体。', 'normal'],
    ],
  },
  korin: {
    summary: '残像步后接短杖反敲，保留仙豆恢复生命。',
    tip: 'R 残像步后0.35秒内按 J 反敲；S + R 每回合吃一次仙豆。',
    skills: [
      '侧移1.2米，闪避保护仅0.075秒；0.35秒内按轻击可用短杖反敲。',
      '在地面使用，起手0.95秒后恢复最大生命的12%，每回合成功一次，满血不可用。被打断可重试，但已消耗的能量不返还。',
    ],
    ultimate: '近身连续短杖攻击，以夺水试炼压制对手。',
    caution: '自己的仙豆储备与场地刷新的仙豆分别计算；F 无远程攻击。',
    drill: [
      ['按 S + R 吃仙豆，恢复生命。', 'selfHeal'],
      ['等吃豆动作结束后，按 R 侧移，再在0.35秒内按 J 发动短杖反敲。', 'catCounter'],
    ],
  },
  pilaf: {
    summary: '导弹打远处，喷火打近身；切换武装后另按发射。',
    tip: 'F 发射当前武装；R 切换；切换后能量不足就按住 I 聚气。',
    skills: [
      '切换导弹与喷火，武装保持到下次切换。切换本身不会开火，动作结束后再按远程键发射。',
      '装甲持续3秒，可让你承受一次攻击而不被打断，仍会掉血；投技、必杀和投射物不受这项保护。保护用掉后不再抵挡打断。',
    ],
    ultimate: '三机合体后发动突击，同时发射两枚导弹；合体结束恢复单机。',
    caution: '切换前留出发射所需能量。',
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
  return id === 'goku' ? '筋斗云' : ['tien', 'chiaotzu', 'piccolo'].includes(id) ? '舞空' : '跳跃';
}

export function skillReason(info, fighter) {
  if (info.reason === '资源不足') return `能量不足，还差${Math.ceil(info.cost - fighter.ki)}`;
  if (info.reason === '等待行动恢复') return fighter.hp <= 0 ? '已倒下' : '等待动作结束';
  if (info.reason === '本回合已变身' && !fighter.youth.tailIntact) return '尾巴已断';
  return info.reason.replace(/s$/, '秒').replace('可发动', '就绪');
}

export function skillCost(skill) {
  const cooldown = ['ape', 'heal'].includes(skill.ability)
    ? '每回合1次'
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
  if (['ape', 'bat', 'combined'].includes(fighter.youth?.form)) return '当前形态不可用';
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
