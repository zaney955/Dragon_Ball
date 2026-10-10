export function register({ animation, combat, match }) {
  const stances = {
    spring: {
      t: [0.06, 0, 0],
      aR: [-0.55, 0, 0.32],
      aL: [-0.65, 0, -0.32],
      lL: [0.15, 0, 0.08],
      lR: [-0.12, 0, -0.08],
    },
    relaxed: {
      t: [0.1, 0, 0],
      aR: [-0.25, 0, 0.12],
      aL: [-0.38, 0, -0.12],
      lL: [0.15, 0, 0.04],
      lR: [-0.05, 0, -0.04],
    },
    straight: {
      t: [0, 0, 0],
      aR: [-0.45, 0, 0.12],
      aL: [-0.55, 0, -0.12],
      lL: [0.06, 0, 0.03],
      lR: [-0.12, 0, -0.03],
    },
    tyrant: {
      t: [0.08, 0, 0],
      aR: [-0.32, 0, 0.5],
      aL: [-0.32, 0, -0.5],
      lL: [0.1, 0, 0.16],
      lR: [-0.12, 0, -0.16],
    },
    crane: {
      t: [0.02, 0, 0],
      aR: [-0.75, 0, 0.32],
      aL: [-0.6, 0, -0.35],
      lL: [0.16, 0, 0.08],
      lR: [-0.16, 0, -0.08],
    },
    low: {
      t: [0.23, 0, 0],
      y: -0.1,
      aR: [-0.65, 0, 0.28],
      aL: [-0.6, 0, -0.28],
      lL: [0.28, 0, 0.08],
      lR: [0.12, 0, -0.08],
    },
    wolf: {
      t: [0.22, 0, 0],
      aR: [-0.95, 0, 0.6],
      aL: [-0.85, 0, -0.6],
      lL: [0.2, 0, 0.12],
      lR: [-0.25, 0, -0.12],
    },
    axe: {
      t: [0.1, 0, 0],
      aR: [-0.8, 0, -0.15],
      aL: [-1, 0, 0.25],
      lL: [0.15, 0, 0.2],
      lR: [-0.1, 0, -0.2],
    },
    kicker: {
      t: [0.05, 0, 0],
      aR: [-0.8, 0, 0.3],
      aL: [-0.8, 0, -0.3],
      lL: [0.2, 0, 0.05],
      lR: [-0.15, 0, -0.05],
    },
    defensive: {
      t: [-0.08, 0, 0],
      aR: [-0.4, 0, 0.2],
      aL: [-0.4, 0, -0.2],
      lL: [-0.12, 0, 0.04],
      lR: [0.2, 0, -0.04],
    },
    float: {
      t: [0, 0, 0],
      aR: [-0.32, 0, 0.35],
      aL: [-0.32, 0, -0.35],
      lL: [0.2, 0, 0.04],
      lR: [0.2, 0, -0.04],
    },
    wobble: {
      t: [0.15, 0, 0.05],
      aR: [-0.2, 0, 0.5],
      aL: [-0.3, 0, -0.4],
      lL: [0.08, 0, 0.12],
      lR: [-0.12, 0, -0.12],
    },
    cat: {
      t: [0.18, 0, 0],
      aR: [-0.5, 0, 0.2],
      aL: [-0.45, 0, -0.18],
      lL: [0.2, 0, 0.06],
      lR: [-0.15, 0, -0.06],
    },
    mech: {
      t: [0.02, 0, 0],
      aR: [-0.45, 0, 0.15],
      aL: [-0.45, 0, -0.15],
      lL: [0.06, 0, 0.12],
      lR: [-0.06, 0, -0.12],
    },
  };
  animation.youthEffector = (motion, index, id) =>
    /staff/i.test(motion)
      ? 'staff'
      : /^axe/.test(motion)
        ? 'axe'
        : motion === 'elbow'
          ? 'elbowR'
          : /^finger/.test(motion)
            ? 'finger'
            : motion === 'caneTap'
              ? 'cane'
              : /kick|sweep/i.test(motion)
                ? 'footR'
                : motion === 'knee'
                  ? 'kneeR'
                  : motion === 'headbutt'
                    ? 'head'
                    : /Belly|Ram/.test(motion)
                      ? 'torso'
                      : /doublePalm|psychic|volley/.test(motion)
                        ? 'both'
                        : motion === 'cross' ||
                            motion === 'backClaw' ||
                            (id === 'pilaf' && index === 0) ||
                            (id === 'yamcha' && index === 0)
                          ? 'handL'
                          : 'handR';
  animation.youthStance = (c) => ({
    ...animation.cloneCombatPose(animation.pz(stances[c.youth.stance])),
    eR: -1.05,
    eL: -1.1,
    kR: c.id === 'krillin' ? 0.45 : 0.17,
    kL: c.id === 'krillin' ? 0.5 : 0.15,
  });
  animation.authorYouthMove = function (c, a, index = 0) {
    const neutral = animation.youthStance(c),
      prep = animation.cloneCombatPose(neutral),
      contact = animation.cloneCombatPose(neutral),
      follow = animation.cloneCombatPose(neutral);
    const heavy = a.chainType === 'heavy',
      side = (a.effector ?? animation.youthEffector(a.motion, index, c.id)) === 'handL' ? 'L' : 'R',
      sign = side === 'R' ? 1 : -1;
    const twist = {
      goku: 0.34,
      roshi: 0.18,
      taopaipai: 0.1,
      piccolo: 0.4,
      tien: 0.2,
      krillin: 0.25,
      yamcha: 0.45,
      gyumao: 0.55,
      chichi: 0.32,
      bulma: 0.28,
      chiaotzu: 0.05,
      oolong: 0.42,
      korin: 0.15,
      pilaf: 0.12,
    }[c.id];
    prep.t[1] = -sign * twist;
    prep.y -= heavy ? 0.1 : 0.04;
    prep['a' + side] = [-0.3, 0, sign * 0.65];
    prep['e' + side] = -1.4;
    contact.t = [neutral.t[0] + (heavy ? 0.12 : 0.04), sign * twist * 0.7, 0];
    contact['a' + side] = [-1.45, 0, -sign * 0.6];
    contact['e' + side] = -0.04;
    contact.lL[0] += 0.14;
    contact.kL = 0.24;
    if (
      a.effector === 'both' ||
      /psychic|volley|doublePalm|kame|kikoho|mafuba|bakuriki/i.test(a.motion)
    ) {
      prep.aL = [-0.7, 0, -0.6];
      prep.aR = [-0.7, 0, 0.6];
      contact.aR = [-1.45, 0, -0.6];
      contact.aL = [-1.45, 0, 0.6];
      contact.eL = contact.eR = -0.05;
      contact.t[1] = 0;
    }
    if (/kick|sweep/i.test(a.motion) || a.effector === 'footR') {
      prep.lR = [0.35, 0, 0.12];
      prep.kR = 0.9;
      contact.lR = [a.level === 'low' ? -1.1 : -1.55, 0, -0.12];
      contact.kR = 0.02;
      contact.t[0] = a.level === 'low' ? 0.35 : -0.15;
      contact.y = a.level === 'low' ? -0.15 : neutral.y;
      contact.aL = [-0.7, 0, -0.75];
    }
    if (a.motion === 'spinKick') {
      prep.t[1] = -1;
      contact.t[1] = 0.25;
      contact.ry = 0.1;
    }
    if (a.motion === 'knee') {
      contact.lR = [-1.55, 0, 0];
      contact.kR = 1.6;
    }
    if (/uppercut|psychicLift/.test(a.motion) || a.launch) {
      prep.y = -0.14;
      contact['a' + side] = [-1.85, 0, -sign * 0.5];
      contact.ry = 0.08;
      contact.t[0] = -0.12;
    }
    if (a.motion === 'volleySpike') {
      prep.aR = [-2.7, 0, 0.25];
      prep.aL = [-2.7, 0, -0.25];
      contact.aR = [-1.85, 0, -0.6];
      contact.aL = [-1.85, 0, 0.6];
      contact.y = -0.2;
      contact.t[0] = 0.45;
      contact.ry = 0.2;
    }
    if (/^staff/.test(a.motion)) {
      prep.w = contact.w = 1;
      prep.aR = [-1.6, 0, 0.45];
      contact.aR = [-1.45, 0, -0.6];
      contact.eR = -0.05;
      contact.aL = [-0.6, 0, -0.4];
      if (a.motion === 'staffSmash') {
        prep.aR = [-2.8, 0, -0.45];
        contact.aR = [-1.4, 0, -0.6];
        contact.t[0] = 0.45;
        contact.ry = 0.12;
      }
      if (a.motion === 'staffSweep') {
        prep.t[1] = -0.6;
        contact.t[1] = 0.4;
        contact.y = -0.12;
      }
    }
    if (/^axe/.test(a.motion)) {
      prep.aR = [-2.5, 0, 0.3];
      prep.aL = [-1.7, 0, -0.2];
      contact.aR = [a.motion === 'axeChop' ? -1.2 : -1.4, 0, -0.5];
      contact.aL = [-1.3, 0, 0.4];
      contact.eR = contact.eL = -0.03;
      contact.t[0] = 0.3;
    }
    if (a.motion === 'caneTap') {
      prep.aR = [-2.15, 0, 0.25];
      contact.aR = [-1.4, 0, -0.55];
      contact.t[0] = 0.22;
      contact.eR = -0.02;
    }
    if (/Belly|Ram|headbutt/.test(a.motion)) {
      prep.t[0] = -0.12;
      contact.t[0] = a.motion === 'headbutt' ? 0.65 : 0.42;
      contact.aR = [-0.8, 0, 0.3];
      contact.aL = [-0.8, 0, -0.3];
    }
    if (a.motion === 'bagSwing') {
      prep.aR = [-0.3, 0, 1.15];
      contact.aR = [-1.25, 0, -0.9];
      contact.t[1] = 0.45;
    }
    if (a.motion === 'solarFlare') {
      prep.aR = [-1.8, 0, -0.4];
      prep.aL = [-1.8, 0, 0.4];
      contact.aR = [-2, 0, -0.35];
      contact.aL = [-2, 0, 0.35];
      contact.eR = contact.eL = -1.2;
    }
    if (a.motion === 'transform') {
      prep.aR = [-1.4, 0, 0.8];
      prep.aL = [-1.4, 0, -0.8];
      contact.aR = [-2.1, 0, 0.8];
      contact.aL = [-2.1, 0, -0.8];
      contact.t[0] = -0.12;
    }
    if (a.motion === 'spawnEgg') {
      prep.h[0] = 0.2;
      contact.h[0] = 0.5;
      contact.t[0] = 0.35;
      contact.aR = [-0.3, 0, 0.5];
      contact.aL = [-0.3, 0, -0.5];
    }
    if (a.motion === 'beanEat') {
      prep.aR = [-1.8, 0, -0.45];
      contact.aR = [-2, 0, -0.45];
      contact.eR = -1.2;
    }
    // Each fighter has a light and a heavy full-body grammar. Contact remains tied
    // to the limb/weapon that is sampled by the real collision rig.
    if (a.chainType) {
      switch (c.id) {
        case 'goku':
          prep.lR = heavy ? [0.38, 0, -0.15] : [-0.4, 0, -0.12];
          prep.kR = heavy ? 0.55 : 1;
          prep.t[0] = heavy ? 0.2 : 0.08;
          contact.ry = a.motion === 'staffSmash' ? 0.2 : a.motion === 'heavyKick' ? 0.14 : 0.04;
          contact.lL[0] += heavy ? 0.05 : 0.2;
          if (!heavy && index === 1) prep.aL = [-0.3, 0, -0.65];
          break;
        case 'roshi':
          prep.t = [heavy ? -0.2 : 0.16, heavy ? -0.38 : -0.12, 0];
          prep.aL = [-0.65, 0, -0.55];
          prep.eL = -0.35;
          contact.y -= heavy ? 0.1 : 0.04;
          contact.kL = heavy ? 0.6 : 0.32;
          contact.kR = heavy ? 0.55 : 0.24;
          contact.t[1] = heavy ? 0.28 : 0.08;
          if (a.motion === 'elbow') {
            contact.eR = -1.55;
            contact.aR = [-1.4, 0, -0.4];
          }
          break;
        case 'taopaipai':
          prep.t = [heavy ? -0.08 : 0, heavy ? -0.2 : -0.04, 0];
          if (side === 'R') {
            prep.aL = [-0.22, 0, -0.08];
            prep.eL = -0.2;
            contact.aL = [-0.18, 0, -0.1];
            contact.eL = -0.12;
          }
          contact.t[1] = heavy ? 0.12 : 0.02;
          contact.y = neutral.y;
          if (/^finger/.test(a.motion)) {
            prep.aR = [-1, 0, 0.05];
            prep.eR = -1.25;
            contact.aR = [-1.52, 0, -0.62];
            contact.eR = -0.015;
            contact.h[0] = -0.05;
          }
          break;
        case 'piccolo':
          prep.aL = [-0.4, 0, -0.95];
          prep.aR = heavy ? [-0.4, 0, 1] : [-1.2, 0, 0.95];
          prep.t = [heavy ? 0.28 : 0.16, -sign * (heavy ? 0.6 : 0.38), 0];
          contact.t[0] += heavy ? 0.1 : 0.04;
          contact.lL[2] = 0.23;
          contact.lR[2] = -0.23;
          break;
        case 'tien':
          prep.aL = heavy ? [-1.5, 0, -0.5] : [-1, 0, -0.15];
          prep.lR = [heavy ? -0.3 : -0.15, 0, -0.05];
          prep.kR = heavy ? 0.8 : 0.4;
          contact.t[1] = heavy ? 0 : 0.15 * sign;
          contact.ry =
            heavy && a.motion !== 'volleySpike' ? 0.12 : a.motion === 'volleySpike' ? 0.18 : 0;
          if (a.motion === 'elbow') contact.eR = -1.5;
          break;
        case 'krillin':
          prep.y = heavy ? -0.23 : -0.16;
          prep.kL = 0.8;
          prep.kR = 0.75;
          prep.t[0] = heavy ? 0.4 : 0.3;
          contact.y -= heavy && a.motion === 'sweep' ? 0.12 : 0.03;
          contact.ry = a.motion === 'uppercut' ? 0.16 : a.motion === 'heavyKick' ? 0.12 : 0;
          contact.aL = a.effector === 'both' ? contact.aL : [-0.85, 0, -0.32];
          break;
        case 'yamcha':
          prep.t = [heavy ? 0.4 : 0.3, -sign * (heavy ? 0.68 : 0.5), 0.08 * sign];
          prep.aL = [-1.1, 0, -0.9];
          prep.aR = [-1.1, 0, 0.9];
          prep.lR[0] = -0.4;
          contact.t[1] = sign * (heavy ? 0.42 : 0.3);
          contact.t[0] += 0.08;
          contact.lL[0] = 0.4;
          contact.lR[0] = -0.35;
          break;
        case 'gyumao':
          prep.lL = [0.24, 0, 0.3];
          prep.lR = [-0.1, 0, -0.3];
          prep.kL = prep.kR = heavy ? 0.6 : 0.25;
          if (!heavy) {
            prep.aR = [-0.7, 0, 0.35];
            prep.eR = -1.1;
            contact.t[0] = 0.2;
            contact.aL = [-1, 0, 0.3];
          } else if (a.motion === 'axeChop') {
            prep.aR = [-2.85, 0, 0.05];
            prep.aL = [-2.35, 0, -0.25];
            contact.aR = [-1.2, 0, -0.5];
            contact.y = -0.12;
            contact.kL = contact.kR = 0.55;
          } else {
            prep.t[1] = -0.8;
            contact.t[1] = 0.55;
          }
          break;
        case 'chichi':
          prep.lR = [-0.6, 0, -0.12];
          prep.kR = heavy ? 1.5 : 1.1;
          prep.aL = [-0.8, 0, -0.45];
          contact.ry = heavy ? 0.16 : a.motion === 'girlKick' ? 0.1 : 0;
          contact.aL = [-0.65, 0, -0.7];
          contact.t[1] += heavy ? 0.2 : 0.04;
          break;
        case 'bulma':
          prep.t = [-0.18, heavy ? -0.35 : -0.18, -0.08];
          prep.aL = [-1.1, 0, -0.1];
          prep.eL = -1.4;
          contact.aL = [-1.5, 0, -0.12];
          contact.eL = -1.4;
          if (a.effector !== 'footR') contact.lR[0] = -0.32;
          contact.h[0] = -0.12;
          if (a.motion === 'bagSwing') {
            prep.aR = [0.2, 0, 1.15];
            contact.t[1] = 0.5;
          }
          break;
        case 'chiaotzu':
          prep.t = [0, 0, 0];
          prep.aR = heavy ? [-1.2, 0, 0.65] : [-0.8, 0, 0.12];
          prep.aL = heavy ? [-1.2, 0, -0.65] : [-0.4, 0, -0.4];
          contact.ry = heavy ? 0.22 : 0.08;
          contact.lL = [0.35, 0, 0.1];
          if (a.effector !== 'footR') {
            contact.lR = [0.35, 0, -0.1];
            contact.kR = 0.45;
          }
          contact.kL = 0.45;
          contact.t[1] = 0;
          break;
        case 'oolong':
          prep.t = [heavy ? -0.28 : 0.08, -0.25 * sign, 0.12 * sign];
          prep.aL = [-0.15, 0, -0.95];
          prep.aR = [-0.15, 0, 0.95];
          contact.t[2] = 0.12 * sign;
          contact.kL = contact.kR = heavy ? 0.5 : 0.25;
          if (a.effector === 'torso') {
            contact.aL[2] = -1.2;
            contact.aR[2] = 1.2;
          }
          break;
        case 'korin':
          prep.y -= heavy ? 0.1 : 0.05;
          prep.aL = [-0.35, 0, -0.65];
          prep.t[1] = heavy ? -0.35 : -0.15;
          contact.ry = heavy ? 0.03 : 0.22;
          contact.lL[0] = 0.35;
          contact.kR = 0.45;
          if (heavy && index === 0) {
            contact.t[0] = 0.5;
            contact.y = -0.2;
          }
          if (heavy && index === 1) prep.aR = [-2.6, 0, 0.3];
          break;
        case 'pilaf':
          prep.t = [heavy ? -0.12 : 0.04, 0, 0];
          prep.eL = prep.eR = heavy ? -0.75 : -1.2;
          prep.aR = heavy ? [-1.75, 0, 0.3] : [-0.65, 0, 0.2];
          prep.aL = heavy ? [-1.75, 0, -0.3] : [-0.65, 0, -0.2];
          contact.t[1] = 0;
          contact.lL = [0.16, 0, 0.18];
          contact.lR = [-0.16, 0, -0.18];
          if (a.effector === 'torso') contact.t[0] = 0.5;
          break;
      }
    }
    Object.assign(follow, animation.cloneCombatPose(contact));
    follow.t[1] += sign * twist * 0.2;
    follow.eR += 0.08;
    if (a.motion === 'axeChop') follow.aR[0] = -0.6;
    follow.y -= 0.02;
    if (a.chainType) {
      if (c.id === 'goku') {
        follow.lR[0] += 0.2;
        follow.kR += 0.35;
      }
      if (c.id === 'roshi') {
        follow.aL = [-0.45, 0, -0.45];
        follow.t[0] -= 0.1;
      }
      if (c.id === 'taopaipai') {
        follow.t[1] = 0;
        follow.h[0] = 0;
      }
      if (c.id === 'piccolo') follow.t[1] += sign * 0.2;
      if (c.id === 'tien') follow.kL += 0.2;
      if (c.id === 'krillin') {
        follow.y -= 0.05;
        follow.kR += 0.2;
      }
      if (c.id === 'yamcha') {
        follow.aL[2] -= 0.25;
        follow.aR[2] += 0.25;
      }
      if (c.id === 'gyumao') follow.t[0] += heavy ? 0.12 : 0.03;
      if (c.id === 'chichi') {
        follow.lR[0] += 0.35;
        follow.kR += 0.35;
      }
      if (c.id === 'bulma') {
        follow.t[0] -= 0.12;
        follow.aR[0] += 0.2;
      }
      if (c.id === 'chiaotzu') follow.ry *= 0.6;
      if (c.id === 'oolong') follow.t[2] *= -1;
      if (c.id === 'korin') follow.t[1] += 0.2;
      if (c.id === 'pilaf') {
        follow.eR += 0.3;
        follow.eL += 0.3;
      }
    }
    return [
      [0, neutral],
      [0.22, prep],
      [0.48, contact],
      [0.58, follow],
      [0.83, animation.mixCombatPose(follow, neutral, 0.65)],
      [1, neutral],
    ];
  };
  return function initialize() {
    const neutralBase = combat.neutralCombatPose,
      poseBase = combat.combatPose;
    combat.neutralCombatPose = function (f, recovering = false) {
      if (!f.def.youth) return neutralBase(f, recovering);
      const q = neutralBase(f, recovering);
      if (['idle', 'walk', 'crouch'].includes(f.state) && !f.crouching) {
        const s = animation.youthStance(f.def);
        q.aR = s.aR;
        q.aL = s.aL;
        q.t = s.t;
        q.y += s.y;
        q.eR = s.eR;
        q.eL = s.eL;
        if (f.state === 'idle') {
          q.lL = s.lL;
          q.lR = s.lR;
        }
        if (f.def.id === 'goku') q.y += Math.abs(Math.sin(match.game.simTime * 5)) * 0.025;
        if (f.def.id === 'oolong') q.t[2] += Math.sin(match.game.simTime * 3) * 0.04;
      }
      return q;
    };
    combat.combatPose = function (f) {
      if (!f.attack?.authored) return poseBase(f);
      const a = f.attack,
        t = f.stateTimer;
      let phase =
        t < a.hitT
          ? (t / Math.max(0.001, a.hitT)) * 0.48
          : t < a.hitT + a.active
            ? 0.48 + ((t - a.hitT) / a.active) * 0.1
            : 0.58 + Math.min(1, (t - a.hitT - a.active) / a.recovery) * 0.42;
      if (a.hits && t >= a.hitT && t < a.hitT + a.active) {
        const local = t - a.hitT;
        const last = a.hits.filter((h) => h <= local).at(-1) ?? 0;
        phase = 0.48 + Math.sin(Math.min(1, (local - last) / 0.12) * Math.PI) * 0.1;
      }
      const q = animation.cloneCombatPose(animation.samplePose(a.anim, phase));
      // Fit only the committed target height, retaining the authored twist and joints.
      const reach = Math.exp(-(((t - a.hitT) / Math.max(0.08, a.active)) ** 2));
      if (a.chainType === 'light' && ['korin', 'oolong'].includes(f.def.id)) q.t[0] += 0.12 * reach;
      if (
        ['handL', 'handR', 'both', 'axe', 'cane', 'staff', 'finger', 'elbowR'].includes(
          a.effector,
        ) &&
        a.targetY != null
      ) {
        const shoulder = f.anatomy ? f.anatomy.hip + f.anatomy.armY : 1.71 * f.baseScale;
        const tilt = Math.max(
          -0.35,
          Math.min(1.35, Math.atan2(shoulder + f.pos.y - a.targetY, 0.7)),
        );
        const fit = a.effector === 'axe' && a.motion !== 'axeJab' ? 0 : tilt;
        q.aR[0] += fit * reach;
        q.aL[0] += fit * reach;
        const crouch =
          Math.max(
            0,
            Math.min(
              a.effector === 'elbowR' ? 0.95 : 0.65,
              (shoulder + f.pos.y - a.targetY - (a.effector === 'elbowR' ? 0.3 : 0.65)) *
                (a.effector === 'elbowR' ? 0.75 : 0.42),
            ),
          ) * reach;
        q.y -= crouch;
        q.kR += crouch * 0.8;
        q.kL += crouch * 0.8;
        if (a.effector === 'axe') q.aR[2] -= 0.35 * reach;
        if (a.launch && ['handR', 'handL', 'both'].includes(a.effector)) {
          const pitch = -Math.atan2(0.7, shoulder + f.pos.y - crouch - a.targetY) - q.t[0];
          q.aR[0] += (pitch - q.aR[0]) * reach;
          if (a.effector === 'both' || a.effector === 'handL') q.aL[0] += (pitch - q.aL[0]) * reach;
        }
      }
      if (a.effector === 'footR' && a.targetY != null) {
        const hip = f.pos.y + (q.ry ?? 0) + f.parts.legR.position.y * f.baseScale;
        const length =
          (f.parts.kneeR.position.length() + f.parts.footR.position.length()) * f.baseScale;
        const angle = -Math.acos(Math.max(-0.98, Math.min(0.98, (hip - a.targetY) / length)));
        q.lR[0] += (angle - q.lR[0]) * reach;
        q.kR += (0.02 - q.kR) * reach;
      }
      if (f.youth?.form === 'fourArms') {
        q.t[1] += Math.sin(t * 35) * 0.08;
      }
      let out = q;
      if (f.poseEntry && t < 0.045)
        out = animation.mixCombatPose(f.poseEntry, q, animation.smoothstep(t / 0.045));
      if (t > a.dur - 0.06)
        out = animation.mixCombatPose(
          out,
          combat.neutralCombatPose(f, true),
          animation.smoothstep(Math.max(0, (t - a.dur + 0.06) / 0.06)),
        );
      return out;
    };
  };
}
