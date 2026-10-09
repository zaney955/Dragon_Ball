export function register({
  ai: aiModule,
  characters: charactersModule,
  combat: combatModule,
  match: matchModule,
}) {
  let v1AI;
  return function initialize() {
    aiModule.V2_TACTICS = {
      goku: {
        distance: 0.91,
        plan: '机动控制',
        basic: 'J → J → J → J',
        resource: 'J → W+K → E（12）→ 空中J；R（30）控距',
        weak: '如意棒空挥收招；远程必杀前摇可侧闪。',
        mechanic: '如意棒实体轨迹；筋斗云有限升空',
      },
      roshi: {
        distance: 0.88,
        plan: '防守反击',
        basic: '掌 → 肘 → 扫腿 → 回旋踢',
        resource: '精准L → R（30）反掌；满气U魔封波',
        weak: '慢速移动；魔封波48F起手与失误成本。',
        mechanic: '反掌一次预判承伤；魔封波命中短控制，防御/残像可反制',
      },
      taopaipai: {
        distance: 0.84,
        plan: '快攻刺杀',
        basic: 'J → J → J → J',
        resource: 'J命中 → R（30）→ U（100）',
        weak: '突掌空挥24F完整收招；洞洞波承诺后不自动追踪。',
        mechanic: '突掌定向突进；高速窄直线洞洞波',
      },
      piccolo: {
        distance: 1,
        plan: '重型边缘压制',
        basic: '爪击 → 反爪 → 踢击 → 挑拳',
        resource: 'J → W+K → E（12）→ J；R（30）压盾',
        weak: '慢启动；下段、投技与连续攻击破一次霸体。',
        mechanic: '重击有限霸体，承伤仍扣生命；魔波宽度与收招风险',
      },
      tien: {
        distance: 0.95,
        plan: '反空与空间控制',
        basic: 'J → J → J → J',
        resource: '空中目标R（30）→ E（12）→ J；U额外8%HP',
        weak: '挑掌对地面少年可空挥；生命代价与重型收招。',
        mechanic: '反空挑掌；三次空中受击保护',
      },
      krillin: {
        distance: 0.72,
        plan: '低身变向连续进攻',
        basic: '短掌 → 反掌 → 连踢 → 回旋踢',
        resource: 'J → R（30）低踢；S+U（100）快速龟派气功；U保留V1气元斩',
        weak: '短手、低爆发；站位后撤可截断近身连段。',
        mechanic: '低姿态疾踢；快速龟派气功与高风险气元斩选择',
      },
      yamcha: {
        distance: 0.86,
        plan: '侧向近身狼牙多段',
        basic: '狼爪 → 反爪 → 肘 → 回旋踢',
        resource: 'J → R（30）两段狼爪 → U（100）四段狼牙',
        weak: '多段受格挡、残像与爆气反制；突进超过范围会空挥。',
        mechanic: '命中确认多段；终段不可循环',
      },
      gyumao: {
        distance: 2.15,
        plan: '巨斧重击空间',
        basic: 'J → J → J → J（斧柄、低斧、推斧）',
        resource: '重击确认 → R（30）震地 → U（100）三斧',
        weak: '大型受击区；慢启动和长空挥；霸体被下段/投技破。',
        mechanic: '真实巨斧刃轨迹；一次承伤霸体；地面范围震地',
      },
      chichi: {
        distance: 0.75,
        plan: '往返牵制后快踢近身',
        basic: '快掌 → 双掌 → 前踢 → 回旋踢',
        resource: 'R（30）飞刃牵制 → J确认 → U（100）踢击＋光束',
        weak: '飞刃离手期间不能重投，速度94%；侧闪与回收时进攻。',
        mechanic: '飞刃可去回各接触一次；头盔光束为装备能力',
      },
      bulma: {
        distance: 3.5,
        plan: '机关部署与自卫撤离',
        basic: '自卫推击 → 手包 → 踢击 → 逃脱推击',
        resource: 'R（30）炮台；S+R（30）地雷；U（100）连锁机关',
        weak: '部署33F起手可打断；18耐久可用下段或侧位攻击打坏；8秒寿命与4.5秒冷却。',
        mechanic: '最多两装置，有足迹碰撞；F（5）小型科技弹；I整理装备',
      },
      chiaotzu: {
        distance: 3.15,
        plan: '念力干扰与悬浮',
        basic: '指击 → 连指 → 悬浮踢 → 念力推掌',
        resource: 'R（30）束缚 → F（5）洞洞波；U（100）控制＋念力连击',
        weak: '束缚前摇、距离及6秒冷却；格挡、侧闪、Q脱身均有效。',
        mechanic: '束缚≤.55秒，连续衰减与2.2秒保护；悬浮≤2米/2秒',
      },
      oolong: {
        distance: 0.8,
        plan: '按危险选择形态',
        basic: '拍击 → 连拍 → 短踢 → 肚皮顶击',
        resource: 'R（30）牛；W+R蝙蝠；S+R机器人；形态中R提早退出',
        weak: '形态5秒后2秒恢复；重击打断；蝙蝠攻击仅2点且无无敌。',
        mechanic: '牛冲撞、蝙蝠脱离、机器人重拳假动作；U三形态物理奇袭',
      },
      korin: {
        distance: 0.67,
        plan: '猫步预判与短杖防反',
        basic: '猫爪 → 双爪 → 杖点 → 反杖',
        resource: '精准L/成功闪避 → J；R（30）残像步；S+R（30）一次仙豆',
        weak: '202HP与短射程；治疗57F起手可打断，回复12%且一次。',
        mechanic: '武道直觉1.25秒收招×.88；U高速残像短杖四击',
      },
      pilaf: {
        distance: 3.4,
        plan: '机甲距离与武装切换',
        basic: '机械拳 → 反拳 → 肩撞 → 双臂压击',
        resource: 'R（30）切换5秒喷火；F导弹10/火焰12；U（100）三机协同',
        weak: '大型受击区；导弹慢且有收招；支援可躲且1.5秒退出。',
        mechanic: '300生命即机甲耐久，同一条血；驾驶舱、装甲、腿部区域',
      },
    };
    for (const c of charactersModule.CHARACTERS) {
      const t = aiModule.V2_TACTICS[c.id];
      c.tactics = t;
      c.resource ??= '气';
      c.type ??= 'martial';
      aiModule.TACTICS[c.id] ??= {
        near: t.distance,
        control: t.distance,
      };
      aiModule.TACTICS[c.id].notes = t.basic + '\n' + t.resource + '\n' + t.weak;
    }
    v1AI = aiModule.aiThink;
    aiModule.aiThink = function (ai, foe, dt) {
      const previous = ai.lastDecision?.decisionTime,
        input = v1AI(ai, foe, dt);
      if (
        matchModule.game.difficulty === 'training' ||
        (!ai.anatomy && ['goku', 'taopaipai', 'piccolo'].includes(ai.def.id))
      )
        return input;
      if (
        ai.def.id === 'chiaotzu' &&
        ai.brainTime >= (matchModule.game.difficulty === 'hard' ? 0.12 : 0.24) &&
        ai.attack?.id === 'special' &&
        ai.hitResult === 'hit' &&
        matchModule.game.simTime - (ai.lastContactTime ?? matchModule.game.simTime) >=
          (matchModule.game.difficulty === 'hard' ? 0.065 : 0.1) &&
        ai.ki >= 5 &&
        ai.v2.confirmSerial !== ai.attack.serial
      ) {
        ai.v2.confirmSerial = ai.attack.serial;
        return {
          ...input,
          actions: [
            {
              type: 'blast',
            },
          ],
        };
      }
      const seen = (ai.observations ?? []).find((o) => o.time === ai.lastDecision?.observedTime);
      if (!seen) return input;
      const dist = Math.hypot(seen.x - ai.pos.x, seen.z - ai.pos.z),
        hard = matchModule.game.difficulty === 'hard',
        quality = hard ? 0.87 : 0.58,
        id = ai.def.id;
      const tactics = aiModule.V2_TACTICS[id],
        newDecision = previous !== ai.lastDecision?.decisionTime,
        defensive = ai.aiIntent === 'defend';
      if (
        newDecision &&
        !defensive &&
        !ai.attack &&
        !['hit', 'knockdown', 'blockstun', 'guardbreak', 'grabbed'].includes(ai.state)
      ) {
        const roll = aiModule.combatRandom(),
          own = ai.v2;
        let action = null,
          context = {};
        if (roll < quality) {
          if (id === 'gyumao' && dist < 2.85) {
            action =
              dist < 1.25
                ? own.cooldown <= 0 && ai.ki >= 30
                  ? 'special'
                  : 'light'
                : ai.ki >= 100 && dist > 1.7
                  ? 'ult'
                  : 'heavy';
          }
          if (id === 'chichi') {
            if (dist > 1.4 && dist < 5 && own.cooldown <= 0 && !own.bladeOut && ai.ki >= 30)
              action = 'special';
            else if (dist < 1.1) action = ai.ki >= 100 ? 'ult' : 'light';
          }
          if (id === 'bulma') {
            if (
              dist > 2.6 &&
              (!seen.attack || seen.attack.phase > seen.attack.hitT + seen.attack.active) &&
              combatModule.v2Devices.filter((x) => x.owner === ai).length < 2 &&
              own.cooldown <= 0 &&
              ai.ki >= 30
            )
              action = 'special';
            else if (dist > 2 && dist < 6) action = ai.ki >= 100 ? 'ult' : 'blast';
            else if (dist < 1.2 && ai.ki >= 5) action = 'dash';
          }
          if (id === 'chiaotzu') {
            if (
              ai.ki >= 100 &&
              dist < 4 &&
              (seen.state === 'hit' ||
                (seen.attack &&
                  seen.attack.phase > seen.attack.hitT + seen.attack.active &&
                  seen.attack.dur - seen.attack.phase > 0.65))
            )
              action = 'ult';
            else if (
              dist >= 3.1 &&
              dist < 3.6 &&
              ai.ki >= 30 &&
              own.cooldown <= 0 &&
              seen.state !== 'block'
            )
              action = 'special';
            else if (dist < 7 && dist > 1.4) action = 'blast';
          }
          if (id === 'oolong') {
            if (own.form === 'pig' && ai.ki >= 30 && own.cooldown <= 0 && own.formCooldown <= 0) {
              action = 'special';
              context =
                ai.hp / ai.maxHp < 0.28 && dist < 1.8
                  ? {
                      up: true,
                    }
                  : seen.state === 'block' || (seen.attack && dist > 1.7)
                    ? {
                        down: true,
                      }
                    : {};
            } else if (own.form === 'bull' && dist < 2) action = 'heavy';
            else if (own.form === 'robot' && dist < 1.6) action = 'heavy';
            else if (own.form === 'pig' && dist < 1.1) action = 'light';
            if (ai.ki >= 100 && dist < 1.6) action = 'ult';
          }
          if (id === 'korin') {
            if (
              ai.hp / ai.maxHp < 0.55 &&
              own.heals > 0 &&
              dist > 3.5 &&
              !seen.attack &&
              own.cooldown <= 0 &&
              ai.ki >= 30
            ) {
              action = 'special';
              context = {
                down: true,
              };
            } else if (seen.attack && dist < 2 && own.cooldown <= 0 && ai.ki >= 30)
              action = 'special';
            else if (dist < 1.0)
              action = own.intuition > 0 ? 'heavy' : ai.ki >= 100 ? 'ult' : 'light';
          }
          if (id === 'pilaf') {
            if (
              dist > 1.6 &&
              dist < 3.0 &&
              own.mode === 'missile' &&
              own.cooldown <= 0 &&
              ai.ki >= 30 &&
              seen.state === 'block'
            )
              action = 'special';
            else if (
              dist > (own.mode === 'flame' ? 1.3 : 2) &&
              dist < (own.mode === 'flame' ? 2.6 : 6)
            )
              action = ai.ki >= 100 ? 'ult' : 'blast';
            else if (dist < 2.3) action = dist < 1.2 ? 'light' : 'heavy';
          }
          if (id === 'roshi' && seen.attack && dist < 1.2 && ai.ki >= 30) action = 'special';
          if (id === 'tien' && seen.y > ai.pos.y + 0.55 && dist < 1.8 && ai.ki >= 30)
            action = 'special';
          if (id === 'krillin' && dist < 1.1 && ai.ki >= 30) action = 'special';
          if (id === 'yamcha' && dist < 1.2 && ai.ki >= 30)
            action = ai.ki >= 100 ? 'ult' : 'special';
        }
        if (action) {
          input.actions = [
            {
              type: action,
              ...context,
            },
          ];
          input.charge = false;
          ai.aiIntent = action === 'special' ? 'mechanism' : 'attack';
        }
      }
      if (
        id === 'bulma' &&
        combatModule.v2Devices.some((d) => d.owner === ai) &&
        dist < 2.55 &&
        !ai.attack &&
        !['hit', 'blockstun', 'knockdown', 'guardbreak', 'grabbed'].includes(ai.state) &&
        !input.actions?.some((a) => ['throw', 'evasion', 'dash'].includes(a.type))
      ) {
        input.block = true;
        input.crouch = seen.attack?.level === 'low';
        input.actions = [];
        input.charge = false;
      }
      if (id === 'oolong' && ai.v2.form !== 'pig' && input.actions)
        input.actions = input.actions.filter((a) => !['special', 'blast'].includes(a.type));
      if (
        ['bulma', 'chiaotzu', 'pilaf'].includes(id) &&
        !ai.attack &&
        !['hit', 'blockstun', 'knockdown', 'guardbreak', 'grabbed'].includes(ai.state)
      ) {
        const v = ai.v2;
        if (ai.ki < (id === 'pilaf' ? 25 : 15) && dist > 2.5 && !seen.attack) v.reloading = true;
        if (ai.ki >= 65 || (seen.attack && dist < 3) || dist < 2.2) v.reloading = false;
        if (v.reloading) {
          input.charge = true;
          input.actions = [];
          input.right = input.left = input.up = input.down = false;
          return input;
        }
      }
      if (ai.anatomy && newDecision) {
        const prior = (ai.observations ?? []).filter((o) => o.time < seen.time).at(-1);
        if (prior) {
          const span = seen.time - prior.time,
            travel = Math.min(0.45, 0.12 + 0.17 + dist / 16);
          ai.v2.shotTarget = {
            x: seen.x + ((seen.x - prior.x) / span) * travel,
            z: seen.z + ((seen.z - prior.z) / span) * travel,
            time: ai.brainTime,
          };
        }
      }
      if (
        ai.anatomy &&
        !defensive &&
        !input.block &&
        !ai.attack &&
        !['hit', 'knockdown', 'blockstun', 'guardbreak', 'grabbed'].includes(ai.state) &&
        !ai.beanGoal
      ) {
        const desired =
            ai.v2.form === 'bat'
              ? 3.2
              : id === 'pilaf' && ai.v2.mode === 'flame'
                ? 2.05
                : id === 'oolong' && ai.v2.form === 'bull'
                  ? 1.25
                  : id === 'oolong' && ai.v2.form === 'robot'
                    ? 1.05
                    : tactics.distance,
          dx = seen.x - ai.pos.x,
          dz = seen.z - ai.pos.z;
        let tx = 0,
          tz = 0;
        if (dist > desired + 0.2) {
          tx = dx;
          tz = dz;
        } else if (dist < desired - 0.2) {
          tx = -dx;
          tz = -dz;
        } else if (hard) {
          tx = dz * ai.aiStrafe;
          tz = -dx * ai.aiStrafe;
        }
        input.right = tx > 0.1;
        input.left = tx < -0.1;
        input.down = tz > 0.1;
        input.up = tz < -0.1;
        if (input.actions?.some((a) => a.type === 'dash') && id === 'bulma') {
          input.right = dx < 0;
          input.left = dx >= 0;
          input.down = dz < 0;
          input.up = dz >= 0;
        }
        if (ai.ki < 32 && dist > 4.8 && !seen.attack) {
          input.charge = true;
          input.right = input.left = input.up = input.down = false;
        }
        if (id === 'chiaotzu' && seen.attack && dist < 2 && hard) input.flight = true;
      }
      return input;
    };
    // Legacy first-contact trajectories stay fixed; later routes gain authored identities.
  };
}
