import * as THREE from 'three';
export function register({
  ai: aiModule,
  animation: animationModule,
  characters: charactersModule,
  combat: combatModule,
  input: inputModule,
  match: matchModule,
  render: renderModule,
  ui: uiModule,
  world: worldModule,
}) {
  function v2Fixture(c = 7, foe = 0, dist = 0.9) {
    matchModule.game.manualTest = true;
    matchModule.game.muted = true;
    matchModule.game.keepPair = false;
    matchModule.game.difficulty = 'local';
    matchModule.game.matchRule = 'competitive';
    matchModule.game.selectedMap = 0;
    matchModule.game.lightPreset = 'day';
    matchModule.game.selectedChar = c;
    matchModule.game.opponent = foe;
    matchModule.game.ringOut = false;
    matchModule.game.showBoxes = false;
    matchModule.startFight();
    matchModule.game.ready = 0;
    matchModule.player.pos.set(0, 0, 0);
    matchModule.enemy.pos.set(dist, 0, 0);
    matchModule.player.previousPos.copy(matchModule.player.pos);
    matchModule.enemy.previousPos.copy(matchModule.enemy.pos);
    matchModule.player.facingAngle = Math.PI / 2;
    matchModule.enemy.facingAngle = -Math.PI / 2;
    matchModule.player.ki = matchModule.enemy.ki = 100;
    return [matchModule.player, matchModule.enemy];
  }
  function v2TestTicks(n, input = {}, other = {}) {
    for (let i = 0; i < n; i++) {
      window.__db.tick(
        i === 0
          ? input
          : {
              ...input,
              actions: [],
              light: false,
              heavy: false,
              special: false,
              ult: false,
              throw: false,
              jump: false,
              dash: false,
              evasion: false,
              pursuit: false,
            },
        typeof other === 'function' ? other(i) : other,
      );
      matchModule.game.hitStop = 0;
      if ((matchModule.player.hp <= 0 || matchModule.enemy.hp <= 0) && !matchModule.game.over)
        matchModule.endGame();
    }
  }
  function runV2CharacterTests(index = 7) {
    const results = [],
      saved = {
        ...matchModule.game,
      };
    const assert = (b, m = '断言失败') => {
      if (!b) throw Error(m);
    };
    const test = (name, fn) => {
      try {
        fn();
        results.push({
          name,
          pass: true,
        });
      } catch (e) {
        results.push({
          name,
          pass: false,
          error: e.message,
        });
      }
    };
    const def = charactersModule.CHARACTERS[index];
    if (!def)
      return {
        total: 0,
        failed: 1,
        error: '尚未启用角色',
      };
    try {
      test('独立模型、完整关节和真实肖像 ' + def.id, () => {
        const [p] = v2Fixture(index);
        assert(p.parts.head && p.parts.handR && p.parts.kneeL && p.parts.footR);
        assert(
          p.anatomy.kind ===
            {
              gyumao: 'giant',
              chichi: 'girl',
              bulma: 'technology',
              chiaotzu: 'psychic',
              oolong: 'pig',
              korin: 'cat',
              pilaf: 'mech',
            }[def.id],
        );
        assert(
          def.combos.light.length === def.youth.light.length &&
            def.combos.heavy.length === def.youth.heavy.length,
        );
        const image = document.querySelectorAll('.char-card')[index].querySelector('img');
        assert(image.src.startsWith('data:image/png'));
      });
      test('招式帧数据、恢复及终段不循环 ' + def.id, () => {
        for (const a of [...def.combos.light, ...def.combos.heavy])
          assert(
            a.startup > 0 &&
              a.active > 0 &&
              a.recovery > 0 &&
              Math.abs(a.dur - a.startup - a.active - a.recovery) < 1e-8 &&
              a.anim &&
              a.cancelRules.whiff.length === 0,
          );
      });
      test('行走、后退、闪身、跳跃与落地 ' + def.id, () => {
        const [p] = v2Fixture(index, 0, 5);
        v2TestTicks(20, {
          up: true,
          moveYaw: Math.PI / 2,
        });
        assert(p.pos.x > 0.3);
        p.vel.set(0, 0, 0);
        v2TestTicks(20, {
          down: true,
          moveYaw: Math.PI / 2,
        });
        v2TestTicks(1, {
          dash: true,
          right: true,
          moveYaw: Math.PI / 2,
        });
        assert(p.dashTime > 0 && p.invulnerable > 0);
        v2TestTicks(35);
        v2TestTicks(1, {
          jump: true,
        });
        assert(p.pos.y > 0);
        v2TestTicks(180);
        assert(p.pos.y === 0);
      });
      test('近身真实轻击接触七旧体型 ' + def.id, () => {
        for (let target = 0; target < 7; target++) {
          const [p, e] = v2Fixture(index, target, 0.85);
          p.startAttack('light');
          v2TestTicks(130);
          assert(e.hp < e.maxHp, def.id + ' -> ' + e.def.id + ' 首轻击漏判');
        }
      });
      test('射程外、背后及错误高度不可命中 ' + def.id, () => {
        for (const [x, y, z] of [
          [10, 0, 0],
          [-1, 0, 0],
          [0.9, 8, 0],
        ]) {
          const [p, e] = v2Fixture(index);
          e.pos.set(x, y, z);
          e.previousPos.copy(e.pos);
          p.startAttack('light');
          p.stateTimer = p.attack.hitT;
          combatModule.sampleCombatRig(p);
          combatModule.sampleCombatRig(e);
          assert(!combatModule.combatIntersects(p, e, p.attack));
        }
      });
      test('格挡和空挥遵循取消规则 ' + def.id, () => {
        const [p, e] = v2Fixture(index);
        e.guardHeld = 0.4;
        e.wasBlocking = true;
        p.startAttack('light');
        v2TestTicks(130, {}, () => ({
          block: true,
        }));
        assert(e.maxHp - e.hp < 3);
        const [p2] = v2Fixture(index, 0, 10);
        p2.startAttack('heavy');
        v2TestTicks(20);
        p2.enqueue('light');
        v2TestTicks(1);
        assert(p2.comboType === 'heavy');
      });
      test('投技及180ms拆投 ' + def.id, () => {
        const [p, e] = v2Fixture(index, 0, 0.7);
        p.startThrow();
        v2TestTicks(120);
        assert(e.hp < e.maxHp);
        const [x, y] = v2Fixture(index);
        x.startThrow();
        y.takeHit(x, x.attack);
        v2TestTicks(1, {}, () => ({
          throw: true,
        }));
        assert(y.hp === y.maxHp && !y.throwPending && !x.attack);
      });
      test('特殊技成本与实际能力事件 ' + def.id, () => {
        const [p] = v2Fixture(index, 0, 2);
        p.startSpecial();
        const a = p.attack;
        assert(a && p.ki === 70);
        v2TestTicks(150);
        assert(a.v2Released || a.shape === 'ground');
        assert(p.ki <= 100);
      });
      test('必杀生效扣气一次和状态恢复 ' + def.id, () => {
        const [p, e] = v2Fixture(index, 0, 1.2);
        // Keep the round active while checking every hit and the full recovery.
        e.hp = e.maxHp = 10000;
        p.startUlt();
        const a = p.attack;
        assert(a && p.ki === 0 && a.costCommitted);
        v2TestTicks(Math.ceil(a.dur / matchModule.STEP) + 10);
        if (a.ability === 'mimicUlt' && p.attack)
          v2TestTicks(Math.ceil(p.attack.dur / matchModule.STEP) + 10);
        assert(a.costCommitted);
        assert(
          combatModule.combatEvents.history.filter(
            (e) => e.type === 'kiSpent' && e.serial === a.serial,
          ).length === 1,
        );
        assert(p.state !== 'ult' && p.v2.controlTime === 0);
      });
      test('可见与逻辑关节同步 ' + def.id, () => {
        const [p] = v2Fixture(index);
        p.startAttack('heavy');
        p.stateTimer = p.attack.hitT;
        p.render(1, 1);
        p.root.updateMatrixWorld(true);
        const r = combatModule.sampleCombatRig(p);
        for (const k of ['handR', 'handL', 'head', 'footL', 'footR'])
          assert(
            p.parts[k]
              .getWorldPosition(new THREE.Vector3())
              .distanceTo(r.parts[k].getWorldPosition(new THREE.Vector3())) < 1e-6,
            k,
          );
      });
      if (def.id === 'gyumao') {
        test('巨斧可见刃口与Hitbox端点一致', () => {
          const [p] = v2Fixture(index);
          p.startAttack('heavy');
          p.stateTimer = p.attack.hitT;
          p.render(1, 1);
          p.root.updateMatrixWorld(true);
          const r = combatModule.sampleCombatRig(p),
            a = p.parts.axe.localToWorld(new THREE.Vector3(-0.56, 1.1, 0)),
            b = p.parts.axe.localToWorld(new THREE.Vector3(0.56, 1.1, 0));
          assert(a.distanceTo(r.hit[0].a) < 1e-6 && b.distanceTo(r.hit[0].b) < 1e-6);
        });
        test('横扫起手与有效期霸体、多次承伤及投技保护', () => {
          const [p, e] = v2Fixture(index);
          p.startSpecial();
          p.stateTimer = p.attack.hitT;
          const a = p.attack;
          e.startAttack('light');
          p.takeHit(e, {
            ...e.attack,
            level: 'mid',
          });
          assert(p.hp < p.maxHp && p.attack === a);
          p.invulnerable = 0;
          p.takeHit(e, { ...e.attack, level: 'mid' });
          assert(p.attack === a);
          p.takeHit(e, { ...e.attack, isThrow: true });
          assert(p.attack === a && !p.throwPending);
        });
      }
      if (def.id === 'chichi')
        test('飞刃离手、往返、限制和回收', () => {
          const [p] = v2Fixture(index, 0, 3);
          p.startSpecial();
          v2TestTicks(40);
          assert(p.v2.bladeOut && combatModule.v2Projectiles.some((x) => x.kind === 'blade'));
          p.attack = null;
          p.state = 'idle';
          p.v2.cooldown = 0;
          const ki = p.ki;
          p.startSpecial();
          assert(!p.attack && p.ki === ki);
          v2TestTicks(350);
          assert(!p.v2.bladeOut && !combatModule.v2Projectiles.some((x) => x.kind === 'blade'));
        });
      if (def.id === 'bulma') {
        test('随机胶囊付款、五种效果与期限清理', () => {
          const [p] = v2Fixture(index, 0, 5);
          p.startSpecial();
          assert(p.ki === 70);
          v2TestTicks(100);
          assert(['mech', 'tranquilizer', 'bomb', 'hoverboard', 'rpg'].includes(p.youth.capsule));
          v2TestTicks(1100);
          assert(!combatModule.youthEntities.length && !p.youth.form);
        });
        test('受击打断部署不产生装置', () => {
          const [p, e] = v2Fixture(index);
          p.startSpecial();
          e.startAttack('light');
          v2TestTicks(80);
          assert(combatModule.v2Devices.length === 0 && p.hp < p.maxHp);
        });
      }
      if (def.id === 'chiaotzu') {
        test('念力不能绕过防御、无敌、连续保护和脱身', () => {
          let [p, e] = v2Fixture(index, 0, 2);
          e.invulnerable = 2;
          p.startSpecial();
          v2TestTicks(110);
          assert(e.v2.controlChain === 0);
          [p, e] = v2Fixture(index, 0, 2);
          e.guardHeld = 0.4;
          e.wasBlocking = true;
          p.startSpecial();
          v2TestTicks(110, {}, () => ({
            block: true,
          }));
          assert(e.v2.controlChain === 0);
          [p, e] = v2Fixture(index, 0, 2);
          p.startSpecial();
          v2TestTicks(55);
          assert(e.youth.controlCount === 1);
          const grace = e.youth.controlGrace;
          assert(combatModule.applyControl(p, e, { control: 0.48 }));
          e.ki = 50;
          e.evade(p);
          assert(e.v2.controlTime === 0 && e.escapeCharges === e.escapeMax - 1 && grace > 0);
        });
        test('悬浮上限、消耗与落地', () => {
          const [p] = v2Fixture(index, 0, 6);
          v2TestTicks(280, {
            flight: true,
          });
          assert(p.pos.y <= 2 && p.ki < 100);
          v2TestTicks(270);
          assert(p.pos.y === 0 && !p.flightMode);
        });
      }
      if (def.id === 'oolong') {
        test('巨鬼蝙蝠模型、受击盒、速度、持续与恢复同步', () => {
          const [p] = v2Fixture(index, 0, 4);
          const kinds = new Set();
          for (const form of ['ogre', 'bat']) {
            combatModule.setYouthBody(p, form);
            p.youth.formTime = 0.1;
            kinds.add(p.anatomy.kind);
            combatModule.sampleCombatRig(p);
            assert(p.combatRig.hurt[1].r === p.anatomy.torsoR);
            v2TestTicks(20);
            assert(!p.youth.form && p.anatomy.kind === 'pig' && p.youth.cooldowns[0] > 0);
          }
          assert(kinds.size === 2);
        });
        test('变化受到重击中断且无免费生命', () => {
          const [p, e] = v2Fixture(index);
          const hp = p.hp;
          combatModule.setYouthBody(p, 'ogre');
          p.youth.formTime = 5;
          e.startAttack('heavy');
          p.takeHit(e, e.attack);
          assert(!p.youth.form && p.hp < hp && p.youth.cooldowns[0] > 0);
        });
      }
      if (def.id === 'korin') {
        test('仙豆开局储备一次、19.5%恢复、启动受击中断', () => {
          let [p, e] = v2Fixture(index, 0, 4);
          p.hp = p.maxHp * 0.4;
          p.startSpecial({
            down: true,
          });
          v2TestTicks(170);
          assert(p.v2.heals === 0 && Math.abs(p.v2.healTotal - p.maxHp * 0.195) < 1e-8);
          const hp = p.hp;
          p.v2.cooldown = 0;
          p.ki = 100;
          p.startSpecial({
            down: true,
          });
          v2TestTicks(170);
          assert(p.hp === hp);
          [p, e] = v2Fixture(index);
          p.hp = p.maxHp * 0.4;
          p.startSpecial({
            down: true,
          });
          e.startAttack('light');
          v2TestTicks(80);
          assert(p.v2.heals === 1 && p.v2.healTotal === 0);
        });
        test('武道直觉仅成功精准格挡触发且有时限', () => {
          const [p, e] = v2Fixture(index);
          p.state = 'block';
          p.guardHeld = 0.02;
          e.startAttack('light');
          p.takeHit(e, e.attack);
          assert(p.v2.intuition > 0 && p.hp === p.maxHp);
          v2TestTicks(200);
          assert(p.v2.intuition === 0);
        });
      }
      if (def.id === 'pilaf') {
        test('武装切换持续到下次切换且不恢复生命', () => {
          const [p] = v2Fixture(index, 0, 4);
          const hp = p.hp;
          p.startSpecial();
          v2TestTicks(100);
          assert(p.youth.weapon === 'flame' && p.hp === hp);
          v2TestTicks(650);
          assert(p.youth.weapon === 'flame');
          p.startSpecial();
          v2TestTicks(100);
          assert(p.youth.weapon === 'missile');
        });
        test('三机实际接合、限时冲撞与恢复', () => {
          const [p, e] = v2Fixture(index, 0, 4);
          e.hp = e.maxHp = 10000;
          p.startUlt();
          v2TestTicks(118);
          assert(p.youth.form === 'combined' && p.parts.combinedMechs.length === 2);
          assert(
            p.parts.combinedMechs.every(
              (m) => m.parent === p.parts.torsoGroup && m.userData.supportPilot,
            ),
          );
          v2TestTicks(300);
          assert(!p.youth.form && e.hp < e.maxHp);
        });
      }
      test('再战和切换清理全部特殊能力 ' + def.id, () => {
        v2Fixture(index);
        matchModule.player.startSpecial();
        v2TestTicks(150);
        matchModule.startFight();
        assert(
          combatModule.v2Projectiles.length === 0 &&
            combatModule.v2Devices.length === 0 &&
            combatModule.v2Supports.length === 0,
        );
        assert(
          matchModule.player.v2.form === 'pig' &&
            matchModule.player.v2.heals === 1 &&
            !matchModule.player.v2.bladeOut,
        );
        matchModule.backToMenu();
        assert(
          !matchModule.player &&
            !matchModule.enemy &&
            combatModule.v2Projectiles.length === 0 &&
            combatModule.v2Devices.length === 0,
        );
      });
    } finally {
      matchModule.backToMenu();
      Object.assign(matchModule.game, saved);
      matchModule.game.screen = 'menu';
      matchModule.game.manualTest = saved.manualTest;
      matchModule.game.over = false;
      uiModule.updateSelection();
    }
    return {
      character: def.id,
      passed: results.filter((x) => x.pass).length,
      failed: results.filter((x) => !x.pass).length,
      total: results.length,
      results,
    };
  }
  function runV2Matrix(row = 0) {
    const results = [],
      saved = {
        ...matchModule.game,
      };
    const assert = (b, m) => {
      if (!b) throw Error(m ?? '断言失败');
    };
    for (let target = 0; target < 14; target++) {
      const checks = [],
        aDef = charactersModule.CHARACTERS[row],
        bDef = charactersModule.CHARACTERS[target];
      const test = (name, fn) => {
        try {
          fn();
          checks.push({
            name,
            pass: true,
          });
        } catch (e) {
          checks.push({
            name,
            pass: false,
            error: e.message,
          });
        }
      };
      const fixture = (dist = 0.8) => v2Fixture(row, target, dist);
      test('初始化、移动、防御与释放', () => {
        const [p, e] = fixture(5);
        assert(
          p.def === aDef &&
            e.def === bDef &&
            p.root.parent === renderModule.scene &&
            e.root.parent === renderModule.scene,
        );
        v2TestTicks(
          20,
          {
            right: true,
            moveYaw: 0,
          },
          {
            left: true,
            moveYaw: 0,
          },
        );
        assert(p.pos.x !== 0 && e.pos.x !== 5);
        v2TestTicks(
          2,
          {
            block: true,
          },
          {
            block: true,
          },
        );
        assert(p.state === 'block' && e.state === 'block');
      });
      for (const type of ['light', 'heavy'])
        test('近身' + type + '真实命中、一次伤害和恢复', () => {
          const [p, e] = fixture(row === 7 && type === 'heavy' ? 2.2 : 0.7);
          p.startAttack(type);
          const a = p.attack;
          v2TestTicks(160);
          assert(e.hp < e.maxHp, a.name + ' 在合理近距未命中');
          const hp = e.hp;
          v2TestTicks(80);
          assert(e.hp === hp && !p.attack, '重复伤害或未收招');
        });
      test('射程外、背后、错误高度不命中', () => {
        for (const xyz of [
          [10, 0, 0],
          [-1.2, 0, 0],
          [0.9, 8, 0],
          [0, 0, 1.8],
        ]) {
          const [p, e] = fixture();
          e.pos.set(...xyz);
          e.previousPos.copy(e.pos);
          p.startAttack('light');
          p.stateTimer = p.attack.hitT;
          combatModule.sampleCombatRig(p);
          combatModule.sampleCombatRig(e);
          assert(!combatModule.combatIntersects(p, e, p.attack), xyz.join(','));
        }
      });
      test('格挡、空挥和反击窗口', () => {
        let [p, e] = fixture();
        e.guardHeld = 0.4;
        e.wasBlocking = true;
        p.startAttack('light');
        v2TestTicks(160, {}, () => ({
          block: true,
        }));
        assert(e.maxHp - e.hp < 3, '格挡承伤错误');
        [p, e] = fixture(10);
        p.startAttack('heavy');
        const a = p.attack;
        v2TestTicks(Math.ceil((a.startup + a.active + 0.02) / matchModule.STEP));
        assert(p.attack && p.stateTimer > a.hitT + a.active, '无空挥恢复窗口');
        assert(p.hitResult === null);
        p.enqueue('light');
        v2TestTicks(1);
        assert(p.comboType === 'heavy', '空挥取消');
        e.pos.copy(p.pos).add(new THREE.Vector3(0.7, 0, 0));
        e.previousPos.copy(e.pos);
        e.facingAngle = -Math.PI / 2;
        e.startAttack('light');
        v2TestTicks(150);
        assert(p.hp < p.maxHp, '收招不可惩罚');
      });
      test('投技和拆投', () => {
        let [p, e] = fixture(0.7);
        p.startThrow();
        v2TestTicks(140);
        assert(e.hp < e.maxHp, '投技漏判');
        [p, e] = fixture(0.7);
        p.startThrow();
        e.takeHit(p, p.attack);
        v2TestTicks(1, {}, () => ({
          throw: true,
        }));
        assert(!e.throwPending && e.hp === e.maxHp && !p.attack, '拆投失败');
      });
      test('特殊技按设计生效并支付资源', () => {
        const [p, e] = fixture(row === 0 ? 2 : row === 10 ? 2 : 0.9);
        if (row === 4) {
          e.pos.y = 1.2;
          e.previousPos.copy(e.pos);
        }
        p.startSpecial();
        const a = p.attack;
        assert(a && p.ki === 70, '特殊技未支付30');
        if (row === 4) e.jumpVel = 22 * (a.startup + matchModule.STEP);
        v2TestTicks(160);
        if (a.ability) assert(a.v2Released, '能力未执行');
        else assert(e.hp < e.maxHp, '特殊技 ' + a.name + ' 在设计区未命中');
        assert(Number.isFinite(p.ki) && p.ki >= 0 && p.ki <= 100);
      });
      test('必杀、一次扣气、命中或真实能力与恢复', () => {
        const distance = [6, 8, 11, 13].includes(row)
          ? 1.1
          : row === 7
            ? 2.2
            : row === 12
              ? 0.8
              : 2;
        const [p, e] = fixture(distance);
        p.startUlt();
        const a = p.attack;
        assert(a && a.isUlt);
        v2TestTicks(300);
        if (a.ability === 'mimicUlt' && p.attack)
          v2TestTicks(Math.ceil(p.attack.dur / matchModule.STEP) + 10);
        assert(a.costCommitted, '未扣必杀成本');
        assert(
          combatModule.combatEvents.history.filter(
            (x) => x.type === 'kiSpent' && x.serial === a.serial,
          ).length === 1,
          '资源重复结算',
        );
        if (a.ability) assert(a.v2Released, '必杀能力未执行');
        else assert(e.hp < e.maxHp, '必杀未命中');
        assert(p.state !== 'ult', '必杀未结束');
        assert(p.ki >= 0 && p.ki <= 100);
      });
      test('倒地、起身、胜负、回合状态清理', () => {
        const [p, e] = fixture();
        e.hp = 1;
        p.startThrow();
        v2TestTicks(150);
        assert(matchModule.game.over && e.hp === 0, '未结束回合');
        assert(
          combatModule.v2Projectiles.length === 0 &&
            combatModule.v2Devices.length === 0 &&
            combatModule.v2Supports.length === 0,
        );
        matchModule.startFight();
        assert(
          matchModule.player.hp === matchModule.player.maxHp &&
            matchModule.enemy.hp === matchModule.enemy.maxHp &&
            !matchModule.player.attack &&
            !matchModule.enemy.attack &&
            matchModule.player.v2.heals === 1,
        );
      });
      results.push({
        attacker: aDef.id,
        defender: bDef.id,
        passed: checks.filter((x) => x.pass).length,
        failed: checks.filter((x) => !x.pass).length,
        checks,
      });
    }
    matchModule.backToMenu();
    Object.assign(matchModule.game, saved);
    matchModule.game.screen = 'menu';
    matchModule.game.over = false;
    uiModule.updateSelection();
    return {
      row: charactersModule.CHARACTERS[row].id,
      combinations: 14,
      passed: results.filter((x) => x.failed === 0).length,
      failed: results.filter((x) => x.failed > 0).length,
      results,
    };
  }
  function runV2OldFourTests() {
    const results = [],
      saved = {
        ...matchModule.game,
      };
    const assert = (b, m) => {
      if (!b) throw Error(m ?? '断言失败');
    };
    const test = (name, fn) => {
      try {
        fn();
        results.push({
          name,
          pass: true,
        });
      } catch (e) {
        results.push({
          name,
          pass: false,
          error: e.message,
        });
      }
    };
    for (const index of [1, 4, 5, 6]) {
      const c = charactersModule.CHARACTERS[index];
      test(c.id + ' 最终连招段数与独立动作', () => {
        assert(
          c.combos.light.length === c.youth.light.length &&
            c.combos.heavy.length === c.youth.heavy.length,
        );
        assert(c.combos.light.slice(1).every((a) => a.anim !== animationModule.ANIM[a.motion]));
      });
      test(c.id + ' 后续八段真实接触', () => {
        for (const type of ['light', 'heavy'])
          for (let n = 0; n < c.combos[type].length; n++) {
            const [p, e] = v2Fixture(index, index, 0.65 * pScale(index));
            p.comboType = type;
            p.comboIdx = n - 1;
            p.comboTimer = n ? 1 : 0;
            p.hitResult = n ? 'hit' : null;
            p.startAttack(type);
            v2TestTicks(150);
            assert(e.hp < e.maxHp, type + n + ' 无接触');
          }
      });
      test(c.id + ' 取消入口、后撤和回收平滑', () => {
        const [p] = v2Fixture(index, index);
        p.startAttack('light');
        p.stateTimer = p.attack.hitT + 0.02;
        const before = animationModule.cloneCombatPose(combatModule.combatPose(p));
        p.startAttack('heavy');
        const after = combatModule.combatPose(p);
        for (const k of ['aR', 'aL', 't', 'h', 'lL', 'lR'])
          assert(
            before[k].every((v, i) => Math.abs(v - after[k][i]) < 1e-8),
            '入口跳变 ' + k,
          );
        p.stateTimer = p.attack.dur - 1e-6;
        const q = combatModule.combatPose(p),
          idle = combatModule.neutralCombatPose(p, true);
        assert(Math.abs(q.aR[0] - idle.aR[0]) < 0.001);
      });
      test(c.id + ' AI 延迟与未来输入隔离', () => {
        for (const difficulty of ['hard', 'normal']) {
          const outcomes = [];
          for (const future of ['heavy', 'evasion']) {
            const [p, e] = v2Fixture(0, index);
            matchModule.game.difficulty = difficulty;
            aiModule.setCombatSeed(4564);
            p.lastInput = {
              [future]: true,
            };
            let input;
            for (let i = 0; i < 90; i++) input = aiModule.aiThink(e, p, matchModule.STEP);
            assert(
              e.lastDecision.decisionTime - e.lastDecision.observedTime >=
                e.lastDecision.reactionDelay - 1e-9,
            );
            outcomes.push(
              JSON.stringify({
                input,
                decision: e.lastDecision,
              }),
            );
          }
          assert(outcomes[0] === outcomes[1]);
        }
      });
    }
    function pScale(i) {
      return i === 1 ? 1.04 : i === 4 ? 1.28 : i === 5 ? 0.79 : 1;
    }
    matchModule.backToMenu();
    Object.assign(matchModule.game, saved);
    matchModule.game.screen = 'menu';
    matchModule.game.over = false;
    return {
      passed: results.filter((x) => x.pass).length,
      failed: results.filter((x) => !x.pass).length,
      total: results.length,
      results,
    };
  }
  function runV2SystemTests() {
    const results = [],
      saved = {
        ...matchModule.game,
      };
    const assert = (b, m) => {
      if (!b) throw Error(m ?? '断言失败');
    };
    const test = (name, fn) => {
      try {
        fn();
        results.push({
          name,
          pass: true,
        });
      } catch (e) {
        results.push({
          name,
          pass: false,
          error: e.message,
        });
      }
    };
    for (let c = 0; c < 14; c++) {
      test(charactersModule.CHARACTERS[c].id + ' 30/60/144Hz全资源技能一致', () => {
        const states = [];
        for (const hz of [30, 60, 144]) {
          const [p, e] = v2Fixture(c, 0, 2);
          aiModule.setCombatSeed(91921);
          p.startUlt();
          for (let i = 0; i < hz * 3; i++)
            combatModule.advanceCombat(
              1 / hz,
              () => ({}),
              () => ({}),
            );
          p.attack = null;
          p.state = 'idle';
          p.ki = 100;
          p.startSpecial();
          for (let i = 0; i < hz * 7; i++)
            combatModule.advanceCombat(
              1 / hz,
              () => ({}),
              () => ({}),
            );
          states.push([
            p.hp,
            e.hp,
            p.ki,
            e.ki,
            p.pos.x,
            e.pos.x,
            matchModule.game.simTime,
            matchModule.game.timeLeft,
            p.v2.formTime,
            p.v2.cooldown,
            combatModule.v2Projectiles.length,
            combatModule.v2Devices.length,
            combatModule.v2Supports.length,
          ]);
        }
        for (const state of states.slice(1))
          assert(
            state.every((v, i) => Math.abs(v - states[0][i]) < 1e-7),
            '帧率结果不一致 ' + JSON.stringify(states),
          );
      });
      test(charactersModule.CHARACTERS[c].id + ' AI过去观察、质量与未来输入隔离', () => {
        for (const difficulty of ['normal', 'hard']) {
          const outcomes = [];
          for (const future of ['heavy', 'evasion']) {
            const [p, e] = v2Fixture(0, c, 2);
            matchModule.game.difficulty = difficulty;
            aiModule.setCombatSeed(16789);
            p.lastInput = {
              [future]: true,
            };
            let x;
            for (let i = 0; i < 100; i++) x = aiModule.aiThink(e, p, matchModule.STEP);
            assert(
              e.lastDecision &&
                e.lastDecision.decisionTime - e.lastDecision.observedTime >=
                  e.lastDecision.reactionDelay - 1e-9,
            );
            outcomes.push(JSON.stringify([x, e.lastDecision]));
          }
          assert(outcomes[0] === outcomes[1]);
        }
      });
      test(charactersModule.CHARACTERS[c].id + ' 三模式、仙豆竞技与同角色接入', () => {
        for (const mode of ['normal', 'hard', 'local', 'training'])
          for (const rule of ['competitive', 'senzu']) {
            v2Fixture(c, c, 2);
            matchModule.game.difficulty = mode;
            matchModule.game.matchRule = rule;
            matchModule.player.startAttack('light');
            v2TestTicks(50);
            assert(
              matchModule.player.def.id === charactersModule.CHARACTERS[c].id &&
                matchModule.enemy.def.id === charactersModule.CHARACTERS[c].id &&
                Number.isFinite(matchModule.player.hp),
            );
          }
      });
    }
    test('巨人对矮小四体型轻重、斧头轨迹和错误高度', () => {
      for (const c of [0, 5, 10, 12])
        for (const type of ['light', 'heavy']) {
          const [p, e] = v2Fixture(7, c, type === 'heavy' ? 2.2 : 0.9);
          p.startAttack(type);
          v2TestTicks(170);
          assert(e.hp < e.maxHp, '巨人漏判 ' + c + type);
          const [x, y] = v2Fixture(7, c, 0.9);
          y.pos.y = 8;
          y.previousPos.copy(y.pos);
          x.startAttack(type);
          x.stateTimer = x.attack.hitT;
          combatModule.sampleCombatRig(x);
          combatModule.sampleCombatRig(y);
          assert(!combatModule.combatIntersects(x, y, x.attack));
        }
    });
    test('乌龙变化的攻击限制、无无敌与恢复', () => {
      for (const form of ['ogre', 'bat']) {
        const [p] = v2Fixture(11, 12, 0.8);
        combatModule.setYouthBody(p, form);
        p.youth.formTime = 0.1;
        if (form === 'bat') assert(!p.startAttack('light') && !p.startThrow() && !p.startUlt());
        assert(p.invulnerable === 0);
        v2TestTicks(20);
        assert(!p.youth.form && p.youth.cooldowns[0] > 0);
      }
    });
    test('随机胶囊不同效果与清理', () => {
      const [p] = v2Fixture(9, 0, 5);
      const seen = new Set();
      for (let i = 0; i < 80; i++) {
        combatModule.releaseYouthAbility(p, p.def.skills[0]);
        seen.add(p.youth.capsule);
        combatModule.cleanupYouthEntities(p);
      }
      assert(seen.size === 5);
      combatModule.endYouthForm(p, false);
      assert(!combatModule.youthEntities.length);
    });
    test('麻醉枪和RPG胶囊产生实际投射物', () => {
      const [p] = v2Fixture(9, 0, 5);
      for (let i = 0; i < 80; i++) combatModule.releaseYouthAbility(p, p.def.skills[1]);
      assert(combatModule.v2Projectiles.some((b) => b.attack.equipment === 'tranquilizer'));
      assert(combatModule.v2Projectiles.some((b) => b.attack.equipment === 'rpg'));
    });
    test('饺子CPU只在实际念力射程内施放', () => {
      for (const dist of [2, 8]) {
        const [p, e] = v2Fixture(10, 0, dist);
        matchModule.game.difficulty = 'hard';
        aiModule.setCombatSeed(7129);
        let special = false;
        for (let n = 0; n < 180; n++) {
          const x = aiModule.aiThink(p, e, matchModule.STEP);
          special ||= x.actions?.some((a) => a.type === 'special');
        }
        assert(dist < 3.6 ? special : !special, '念力决策距离 ' + dist);
      }
    });
    test('七新增必杀真实载荷均可造成实际接触', () => {
      for (let c = 7; c < 14; c++) {
        const [p, e] = v2Fixture(
          c,
          0,
          c === 7 ? 2.2 : c === 8 || c === 9 || c === 13 ? 4 : c === 10 ? 3 : c === 12 ? 0.8 : 1.1,
        );
        p.startUlt();
        v2TestTicks(340);
        assert(e.hp < e.maxHp, '必杀载荷无接触 ' + c);
      }
    });
    test('科技、头盔和念力投射物实际射程与帧表一致', () => {
      for (const c of [8, 9, 10, 13]) {
        for (const dist of [4, 9]) {
          const [p, e] = v2Fixture(c, 0, dist);
          p.startKiBlast();
          v2TestTicks(210);
          assert(dist === 4 ? e.hp < e.maxHp : e.hp === e.maxHp, '投射物射程 ' + c + ' ' + dist);
          assert(combatModule.v2Projectiles.length === 0);
        }
      }
    });
    test('饺子CPU的念力决策保留观察延迟', () => {
      const [p, e] = v2Fixture(10, 0, 2);
      matchModule.game.difficulty = 'hard';
      for (let n = 0; n < 180; n++) aiModule.aiThink(p, e, matchModule.STEP);
      assert(
        p.lastDecision && p.lastDecision.decisionTime - p.lastDecision.observedTime >= 0.12 - 1e-9,
      );
    });
    test('胶囊技能变体在起手提交', () => {
      const [p] = v2Fixture(9, 0, 5);
      p.startSpecial({ down: true });
      p.lastInput = {};
      v2TestTicks(100);
      assert(p.youth.cooldowns[1] > 0 && p.youth.cooldowns[0] === 0 && p.youth.capsule);
    });
    test('念力三次控制衰减、免疫与脱身', () => {
      const [p, e] = v2Fixture(10, 0, 2);
      for (const duration of [0.48, 0.24, 0.12]) {
        e.invulnerable = 0;
        assert(combatModule.applyControl(p, e, { control: 0.48 }));
        assert(Math.abs(e.v2.controlTime - duration) < 1e-8);
      }
      assert(!combatModule.applyControl(p, e, { control: 0.48 }));
      e.ki = 50;
      e.evade(p);
      assert(e.v2.controlTime === 0 && e.escapeCharges === e.escapeMax - 1);
      v2TestTicks(500);
      assert(e.youth.controlCount === 0);
    });
    test('念力与独立洞洞波均需真实接触和资源', () => {
      const [p, e] = v2Fixture(10, 0, 2);
      p.startSpecial();
      v2TestTicks(120);
      const hp = e.hp;
      p.state = 'idle';
      p.attack = null;
      const ki = p.ki;
      assert(p.startKiBlast() && p.ki < ki);
      v2TestTicks(170);
      assert(
        e.hp < hp &&
          combatModule.combatEvents.history.some((x) => x.type === 'attack' && x.move === '洞洞波'),
      );
    });
    test('仙豆储备与地图仙豆叠加仍受生命上限限制', () => {
      const [p] = v2Fixture(12, 0, 5);
      matchModule.game.matchRule = 'senzu';
      p.hp = p.maxHp * 0.75;
      p.startSpecial({
        down: true,
      });
      v2TestTicks(170);
      assert(Math.abs(p.v2.healTotal - p.maxHp * 0.195) < 1e-8 && p.youth.heals === 0);
      const bean = worldModule.currentMap.senzus[0];
      bean.active = true;
      bean.x = p.pos.x;
      bean.z = p.pos.z;
      bean.expiresAt = Infinity;
      bean.group.visible = true;
      v2TestTicks(1);
      assert(p.youth.heals === 1 && !bean.active);
      p.attack = null;
      p.state = 'idle';
      p.ki = 100;
      p.startSpecial({ down: true });
      v2TestTicks(170);
      assert(p.hp === p.maxHp);
      p.ki = 100;
      p.youth.cooldowns[1] = 0;
      const previousAttack = p.attack;
      assert(!p.startSpecial({ down: true }));
      assert(p.attack === previousAttack && p.hp === p.maxHp);
    });
    test('十次再战与切换后实体和特殊状态无累积', () => {
      for (let i = 0; i < 10; i++) {
        v2Fixture([9, 11, 13, 12][i % 4], 0, 3);
        matchModule.player.startUlt();
        v2TestTicks(140);
        matchModule.startFight();
        assert(
          combatModule.v2Projectiles.length === 0 &&
            combatModule.v2Devices.length === 0 &&
            combatModule.v2Supports.length === 0 &&
            !matchModule.player.v2.formSequence,
        );
        assert(matchModule.player.v2.heals === 1 && matchModule.player.v2.controlTime === 0);
      }
    });
    test('有限霸体、连击脱身与无重复相位伤害', () => {
      const [p, e] = v2Fixture(3, 0, 0.8);
      p.startSpecial({ down: true });
      e.startThrow();
      p.takeHit(e, e.attack);
      assert(p.throwPending, '投技须克制比克的有限霸体');
      const [x, y] = v2Fixture(6, 0, 0.8);
      x.startUlt();
      v2TestTicks(230);
      const contacts = combatModule.combatEvents.history.filter(
        (z) => z.type === 'contact' && z.character === 'yamcha',
      );
      assert(contacts.length <= 4);
      const hp = y.hp;
      v2TestTicks(100);
      assert(y.hp === hp);
    });
    test('全部角色输入及方向组合保留1P/2P按键', () => {
      v2Fixture(11, 12);
      inputModule.keys.KeyW = true;
      inputModule.keys.KeyR = true;
      dispatchEvent(
        new KeyboardEvent('keydown', {
          code: 'KeyR',
          bubbles: true,
        }),
      );
      const a = inputModule.readPlayerInput().actions.find((x) => x.type === 'special');
      assert(a?.up);
      inputModule.keys.KeyW = false;
      inputModule.keys.KeyR = false;
      inputModule.keys.ArrowDown = true;
      dispatchEvent(
        new KeyboardEvent('keydown', {
          code: 'NumpadAdd',
          bubbles: true,
        }),
      );
      const b = inputModule.readPlayer2Input().actions.find((x) => x.type === 'special');
      assert(b?.down);
      inputModule.keys.ArrowDown = false;
    });
    matchModule.backToMenu();
    Object.assign(matchModule.game, saved);
    matchModule.game.screen = 'menu';
    matchModule.game.over = false;
    uiModule.updateSelection();
    return {
      passed: results.filter((x) => x.pass).length,
      failed: results.filter((x) => !x.pass).length,
      total: results.length,
      results,
    };
  }
  function runV2AIRounds(row = 0, seedIndex = 0, rule = 'competitive') {
    const saved = {
        ...matchModule.game,
      },
      rounds = [];
    for (let target = 0; target < 14; target++) {
      v2Fixture(row, target, 6);
      matchModule.game.difficulty = 'hard';
      matchModule.game.matchRule = rule;
      matchModule.game.collectTestStats = true;
      matchModule.game.wins = [0, 0];
      matchModule.player.isAI = true;
      matchModule.enemy.isAI = true;
      const seed = 314159 + row * 1777 + target * 97 + seedIndex * 104729;
      aiModule.setCombatSeed(seed);
      let frame = 0;
      while (!matchModule.game.over && frame++ < 6000) {
        combatModule.advanceCombat(
          1 / 30,
          () => aiModule.aiThink(matchModule.player, matchModule.enemy, matchModule.STEP),
          () => aiModule.aiThink(matchModule.enemy, matchModule.player, matchModule.STEP),
        );
        renderModule.updateEffects(1 / 30);
        renderModule.updateUltimateVisuals(1 / 30);
      }
      const diag = matchModule.combatDiagnostics.rounds.at(-1);
      rounds.push({
        attacker: matchModule.player.def.id,
        defender: matchModule.enemy.def.id,
        seed,
        rule,
        finished: matchModule.game.over,
        winner: matchModule.game.lastWinner,
        reason: matchModule.game.endReason,
        hp: [matchModule.player.hp, matchModule.enemy.hp],
        duration: 180 - matchModule.game.timeLeft,
        frames: frame,
        damage: diag?.damage,
        healed: diag?.healed,
        contacts: combatModule.combatEvents.history.filter((e) => e.type === 'contact').length,
        specials: combatModule.combatEvents.history
          .filter((e) => e.type === 'ability')
          .map((e) => e.ability),
      });
    }
    matchModule.backToMenu();
    Object.assign(matchModule.game, saved);
    matchModule.game.screen = 'menu';
    matchModule.game.over = false;
    matchModule.game.collectTestStats = false;
    return rounds;
  }
  return function initialize() {
    queueMicrotask(() => {
      if (window.__db)
        Object.assign(window.__db, {
          V2_VERSION: combatModule.V2_VERSION,
          runV2CharacterTests,
          v2Fixture,
          v2TestTicks,
          v2Projectiles: combatModule.v2Projectiles,
          v2Devices: combatModule.v2Devices,
          v2Supports: combatModule.v2Supports,
          updateV2Abilities: combatModule.updateV2Abilities,
          switchForm: combatModule.switchForm,
          applyControl: combatModule.applyControl,
          cleanupAbilities: combatModule.cleanupAbilities,
          stature: combatModule.stature,
          mobilitySpeed: combatModule.mobilitySpeed,
        });
    });
    queueMicrotask(() => {
      if (window.__db)
        Object.assign(window.__db, {
          runV2Matrix,
          runV2OldFourTests,
        });
    });
    queueMicrotask(() => {
      if (window.__db)
        Object.assign(window.__db, {
          runV2SystemTests,
          runV2AIRounds,
          deployDevice: combatModule.deployDevice,
        });
    });
  };
}
