import * as THREE from 'three';
export function register({
  ai: aiModule,
  animation: animationModule,
  characters: charactersModule,
  combat: combatModule,
  match: matchModule,
  render: renderModule,
  testing: testingModule,
  training: trainingModule,
  ui: uiModule,
  world: worldModule,
}) {
  function runV1Tests() {
    const results = [],
      saved = {
        ...matchModule.game,
        manualTest: matchModule.game.manualTest,
        collectTestStats: matchModule.game.collectTestStats,
      },
      savedStats = trainingModule.drillSystem.stats;
    matchModule.game.manualTest = true;
    matchModule.game.muted = true;
    trainingModule.drillSystem.stats = {};
    const assert = (v, message = '断言失败') => {
      if (!v) throw Error(message);
    };
    const test = (name, fn) => {
      try {
        fn();
        results.push({
          stage: 'V1',
          name,
          pass: true,
        });
      } catch (e) {
        results.push({
          stage: 'V1',
          name,
          pass: false,
          error: e.message,
        });
      }
    };
    const fresh = (c = 0, foe = c, distance = 0.8) => {
      matchModule.game.keepPair = false;
      matchModule.game.difficulty = 'local';
      matchModule.game.matchRule = 'senzu';
      matchModule.game.trainingDummy = 'idle';
      matchModule.game.selectedChar = c;
      matchModule.game.opponent = foe;
      matchModule.game.selectedMap = 0;
      matchModule.game.ringOut = false;
      matchModule.startFight();
      matchModule.game.ready = 0;
      matchModule.game.paused = false;
      matchModule.player.pos.set(0, 0, 0);
      matchModule.enemy.pos.set(distance, 0, 0);
      matchModule.player.previousPos.copy(matchModule.player.pos);
      matchModule.enemy.previousPos.copy(matchModule.enemy.pos);
      matchModule.player.ki = 80;
      matchModule.enemy.ki = 80;
      matchModule.player.vel.set(0, 0, 0);
      matchModule.enemy.vel.set(0, 0, 0);
      renderModule.resetShoulderCameras();
      return [matchModule.player, matchModule.enemy];
    };
    const step = (n, p = {}, e = {}) => {
      for (let i = 0; i < n; i++) {
        window.__db.tick(
          typeof p === 'function'
            ? p(i)
            : i === 0
              ? p
              : {
                  ...p,
                  actions: [],
                  light: false,
                  heavy: false,
                  special: false,
                  ult: false,
                  pursuit: false,
                  dash: false,
                },
          typeof e === 'function' ? e(i) : e,
        );
        matchModule.game.hitStop = 0;
      }
    };
    const events = (type) => combatModule.combatEvents.history.filter((e) => e.type === type);
    try {
      test('并发必杀扣气按真实生效阶段执行且仅扣一次', () => {
        for (let c = 0; c < 7; c++) {
          const [p] = fresh(c, c, 4);
          p.ki = 100;
          p.startUlt();
          const a = p.attack;
          if (a.shape === 'wolf') {
            assert(p.ki === 0 && a.costCommitted);
          } else {
            assert(p.ki === 100 && !a.costCommitted);
            step(Math.floor(a.hitT / matchModule.STEP) - 1);
            assert(p.ki === 100 && !a.costCommitted);
          }
          step(160);
          assert(
            a.costCommitted && events('kiSpent').filter((e) => e.serial === a.serial).length === 1,
          );
        }
      });
      test('必杀发射前被真实轻击打断不扣气且无发射事件', () => {
        const [p, e] = fresh(0, 0, 0.8);
        p.ki = 100;
        p.startUlt();
        e.startAttack('light');
        step(40);
        assert(p.hp < p.maxHp && p.ki === 100 && !p.attack);
        assert(events('kiSpent').filter((x) => x.side === 0).length === 0);
      });
      test('气弹真实启动仅结算一次投射物伤害而非手部命中', () => {
        const [p, e] = fresh(0, 0, 0.8);
        p.ki = 30;
        p.startKiBlast(0);
        const a = p.attack;
        assert(a.isKiBlast && !combatModule.combatIntersects(p, e, a));
        step(90);
        assert(
          e.maxHp - e.hp === a.dmg && events('contact').filter((x) => x.side === 0).length === 1,
        );
        assert(events('kiSpent').filter((x) => x.side === 0).length === 1);
      });
      test('七角色气弹发射和后续必杀结束无手部光球残留', () => {
        for (let c = 0; c < 7; c++) {
          const [p] = fresh(c, 0, 4);
          p.ki = 100;
          step(80, {
            blastHeld: true,
          });
          p.render(matchModule.STEP, 1);
          assert(p.kiVisual.hand.visible === true);
          step(1);
          step(20);
          p.render(matchModule.STEP, 1);
          assert(p.kiVisual.hand.visible === false);
          step(120);
          p.render(matchModule.STEP, 1);
          assert(!p.attack && p.kiVisual.hand.visible === false);
          p.ki = 100;
          p.startUlt();
          step(260);
          p.render(matchModule.STEP, 1);
          assert(!p.attack && p.kiVisual.hand.visible === false);
        }
      });
      test('双人镜头独立渲染且同帧阴影仅更新一次', () => {
        fresh();
        matchModule.game.difficulty = 'local';
        const calls = [],
          render = renderModule.renderer.render,
          original = renderModule.renderer.shadowMap.autoUpdate;
        renderModule.renderer.render = (scene, cam) =>
          calls.push([cam, renderModule.renderer.shadowMap.autoUpdate]);
        try {
          renderModule.renderer.shadowMap.autoUpdate = true;
          renderModule.renderGameViews();
          assert(
            calls.length === 2 &&
              calls[0][0] === renderModule.camera &&
              calls[1][0] === renderModule.camera2,
          );
          assert(
            calls[0][1] === true &&
              calls[1][1] === false &&
              renderModule.renderer.shadowMap.autoUpdate === true,
          );
        } finally {
          renderModule.renderer.render = render;
          renderModule.renderer.shadowMap.autoUpdate = original;
        }
      });
      test('七乘七通用挑空近身站立真实命中而非越过头顶', () => {
        for (let c = 0; c < 7; c++)
          for (let foe = 0; foe < 7; foe++) {
            const [p, e] = fresh(c, foe, 0.9);
            step(110, {
              heavy: true,
              up: true,
            });
            assert(
              e.hp < e.maxHp && events('contact').some((x) => x.side === 0),
              p.def.id + ' 对 ' + e.def.id,
            );
          }
      });
      test('三角色跨七对手确认挑空和12气追击具有真实接触', () => {
        for (const c of [0, 2, 3])
          for (let foe = 0; foe < 7; foe++) {
            const [p, e] = fresh(c, foe, 0.8);
            let links = 0,
              seen = new Set(),
              hit = false;
            step(
              220,
              (i) => {
                if (i === 0)
                  return {
                    light: true,
                  };
                if (p.attack && p.hitResult === 'hit' && !seen.has(p.attack)) {
                  seen.add(p.attack);
                  if (links === 0) {
                    links++;
                    return {
                      heavy: true,
                      up: true,
                    };
                  }
                  if (links === 1) {
                    links++;
                    return {
                      pursuit: true,
                    };
                  }
                }
                if (links === 2 && !p.attack && p.dashTime <= 0) {
                  links++;
                  return {
                    light: true,
                  };
                }
                return {};
              },
              () => {
                hit = hit || e.receivedCombo > 0;
                return {
                  block: hit,
                };
              },
            );
            assert(
              events('contact').filter((x) => x.side === 0 && !x.blocked).length >= 3,
              p.def.id + ' 对 ' + e.def.id,
            );
            assert(events('pursuit').some((x) => x.cost === 12));
          }
      });
      test('挑空不会背后侧面射程外误判且保留闪避无敌', () => {
        for (const [x, z, invincible] of [
          [-0.9, 0, false],
          [0, 0.9, false],
          [5, 0, false],
          [0.9, 0, true],
        ]) {
          const [p, e] = fresh(3, 5, 0.9);
          e.pos.set(x, 0, z);
          e.previousPos.copy(e.pos);
          p.facingAngle = Math.PI / 2;
          p.face = Math.PI / 2;
          if (invincible) e.invulnerable = 2;
          p.startAttack('heavy', {
            up: true,
          });
          step(110);
          assert(e.hp === e.maxHp && events('contact').length === 0, x + ',' + z);
        }
      });
      test('帧表与当前招式保留精确60FPS换算且空闲清除旧数据', () => {
        const [p] = fresh();
        matchModule.game.difficulty = 'training';
        p.startSpecial();
        trainingModule.updateTrainingHUD();
        assert(document.getElementById('frameReadout').title.includes('14.4 / 6 / 22.2 F'));
        trainingModule.refreshMoveTable();
        assert([...trainingModule.table.querySelectorAll('tr')].at(-1).title.includes('14.4'));
        p.attack = null;
        trainingModule.updateTrainingHUD();
        assert(document.getElementById('frameReadout').title === '');
        assert(
          trainingModule
            .preciseFrames({
              startup: matchModule.STEP,
              active: 2 * matchModule.STEP,
              recovery: 3 * matchModule.STEP,
            })
            .includes('0.5 / 1 / 1.5 F'),
        );
      });
      test('反馈按招式类别而非伤害阈值分类', () => {
        assert(
          combatModule.impactKind({
            chainType: 'heavy',
            dmg: 1,
          }) === 'heavy',
        );
        assert(
          combatModule.impactKind({
            chainType: 'light',
            dmg: 24,
          }) === 'light',
        );
        assert(
          combatModule.impactKind({
            isUlt: true,
            dmg: 1,
          }) === 'ultimate',
        );
        assert(
          combatModule.impactKind({
            id: 'special',
            dmg: 2,
          }) === 'special',
        );
      });
      test('真实轻击、重击、特殊技与必杀事件独立', () => {
        for (const [action, kind] of [
          ['light', 'light'],
          ['heavy', 'heavy'],
          ['special', 'special'],
          ['ult', 'ultimate'],
        ]) {
          const [p] = fresh();
          if (action === 'ult') p.ki = 100;
          step(220, {
            [action]: true,
          });
          assert(
            events('contact').some((e) => e.feedback === kind),
            '未记录 ' + kind,
          );
          assert(events('swing').length === 1, '重复挥动');
        }
      });
      test('空挥只有动作和挥动事件，没有接触反馈', () => {
        fresh(0, 0, 4);
        step(90, {
          heavy: true,
        });
        assert(
          events('attack').length === 1 &&
            events('active').length === 1 &&
            events('whiff').length === 1,
        );
        assert(events('contact').length === 0);
      });
      test('普通格挡与精准格挡通过真实接触区分', () => {
        let [p, e] = fresh();
        e.guardHeld = 0.4;
        e.wasBlocking = true;
        step(
          70,
          {
            light: true,
          },
          () => ({
            block: true,
          }),
        );
        assert(
          events('contact').some((x) => x.feedback === 'block') && events('parry').length === 0,
        );
        [p, e] = fresh();
        step(
          70,
          {
            light: true,
          },
          () => ({
            block: !!p.attack && p.stateTimer >= p.attack.hitT - 4 * matchModule.STEP,
          }),
        );
        assert(events('parry').length === 1 && e.hp === e.maxHp);
      });
      test('破防使用独立反馈且实际损失生命', () => {
        const [, e] = fresh();
        e.guard = 5;
        e.guardHeld = 0.4;
        e.wasBlocking = true;
        step(
          90,
          {
            heavy: true,
          },
          () => ({
            block: true,
          }),
        );
        assert(events('contact').some((x) => x.feedback === 'guardbreak') && e.hp < e.maxHp);
      });
      test('轻重停顿和粒子层级克制且有差别', () => {
        assert(
          combatModule.FEEDBACK_PROFILES.light.stop < combatModule.FEEDBACK_PROFILES.heavy.stop,
        );
        assert(
          combatModule.FEEDBACK_PROFILES.block.count < combatModule.FEEDBACK_PROFILES.light.count,
        );
        assert(
          combatModule.FEEDBACK_PROFILES.ultimate.stop <= 0.11 &&
            combatModule.FEEDBACK_PROFILES.ultimate.count <= 24,
        );
      });
      test('拆投、残像与爆气保留独立离线音效配置', () => {
        for (const kind of ['tech', 'evade', 'breaker'])
          assert(
            combatModule.FEEDBACK_PROFILES[kind].volume > 0 &&
              combatModule.FEEDBACK_PROFILES[kind].stop === 0,
          );
      });
      test('事件追踪有界，读取不改变资源和随机数', () => {
        const [p] = fresh();
        const ki = p.ki,
          seed = aiModule.tacticalSeed;
        for (let i = 0; i < 600; i++) combatModule.emitCombatEvent('diagnostic', p, null, null);
        assert(
          combatModule.combatEvents.history.length === 512 &&
            p.ki === ki &&
            aiModule.tacticalSeed === seed,
        );
      });
      test('三角色有效区间保持 V0 攻击姿态', () => {
        for (const c of [0, 2, 3])
          for (const type of ['light', 'heavy', 'special']) {
            const [p] = fresh(c);
            p.startAttack(type === 'special' ? 'light' : type);
            if (type === 'special') p.startSpecial();
            for (const u of [0, 0.25, 0.5, 0.75, 1]) {
              p.stateTimer = p.attack.hitT + p.attack.active * u;
              assert(
                JSON.stringify(combatModule.combatPose(p)) ===
                  JSON.stringify(animationModule.v0AttackPose(p)),
                p.def.id + ' ' + type,
              );
            }
          }
      });
      test('三角色真实取消时入口姿态连续', () => {
        for (const c of [0, 2, 3]) {
          const [p] = fresh(c);
          step(50, (i) =>
            i === 0
              ? {
                  light: true,
                }
              : p.hitResult === 'hit'
                ? {
                    light: true,
                  }
                : {},
          );
          assert(events('attack').length >= 2);
          p.stateTimer = p.attack.hitT + 0.02;
          const before = animationModule.cloneCombatPose(combatModule.combatPose(p));
          p.startAttack('heavy');
          const after = combatModule.combatPose(p);
          for (const k of ['aR', 'aL', 't', 'h', 'lL', 'lR'])
            assert(before[k].every((v, i) => Math.abs(v - after[k][i]) < 1e-9));
        }
      });
      test('低空与落地姿态平滑且不修改高度或资源', () => {
        const [p] = fresh();
        p.flightMode = true;
        p.pos.y = 0.08;
        const hp = p.hp,
          ki = p.ki;
        const low = combatModule.neutralCombatPose(p);
        p.pos.y = 0.16;
        const air = combatModule.neutralCombatPose(p);
        assert(low.kL !== air.kL && p.hp === hp && p.ki === ki);
        p.pos.y = 0;
        p.flightMode = false;
        p.state = 'landing';
        p.stateTimer = 0;
        const a = combatModule.neutralCombatPose(p);
        p.stateTimer = 0.12;
        const b = combatModule.neutralCombatPose(p);
        assert(a.y < b.y && a.kL > b.kL && p.pos.y === 0);
      });
      test('三角色可见活动关节与逻辑骨架同步', () => {
        for (const c of [0, 2, 3]) {
          const [p] = fresh(c);
          p.startAttack('heavy');
          p.stateTimer = p.attack.hitT + 0.025;
          p.render(1 / 60, 1);
          p.root.updateMatrixWorld(true);
          const r = combatModule.sampleCombatRig(p);
          for (const k of ['handR', 'handL', 'head', 'footR', 'footL'])
            assert(
              p.parts[k]
                .getWorldPosition(new THREE.Vector3())
                .distanceTo(r.parts[k].getWorldPosition(new THREE.Vector3())) < 1e-6,
              k,
            );
        }
      });
      test('回收结束平滑接入空闲姿态', () => {
        for (const c of [0, 2, 3]) {
          const [p] = fresh(c);
          p.startAttack('heavy');
          p.stateTimer = p.attack.dur - 1e-6;
          const q = combatModule.combatPose(p),
            neutral = combatModule.neutralCombatPose(p, true);
          assert(
            Math.abs(q.t[0] - neutral.t[0]) < 0.001 && Math.abs(q.aR[0] - neutral.aR[0]) < 0.001,
          );
        }
      });
      test('受击姿态随方向和招式力度变化', () => {
        const [p] = fresh(3);
        p.state = 'hit';
        p.stateTimer = 0.08;
        p.hitSide = 1;
        p.hitWeight = 1;
        const a = combatModule.neutralCombatPose(p);
        p.hitSide = -1;
        const b = combatModule.neutralCombatPose(p);
        assert(a.t[2] !== b.t[2]);
        p.hitWeight = 1.35;
        assert(Math.abs(combatModule.neutralCombatPose(p).t[0]) > Math.abs(b.t[0]));
      });
      test('实际位移推进步幅，贴墙停步不空踩', () => {
        const [p] = fresh();
        p.pos.x = worldModule.currentMap.bounds.x;
        p.previousPos.copy(p.pos);
        const phase = p.walkPhase;
        p.update(matchModule.STEP, matchModule.enemy, {
          up: true,
          moveYaw: Math.PI / 2,
        });
        assert(Math.abs(p.walkPhase - phase) < 1e-10);
      });
      test('三角色无资源四段连招对恢复后防御成立', () => {
        for (const c of [0, 2, 3]) {
          const [p, e] = fresh(c);
          let seen = new Set(),
            links = 0,
            hit = false;
          step(
            190,
            (i) => {
              if (i === 0)
                return {
                  light: true,
                };
              if (p.hitResult === 'hit' && p.attack && !seen.has(p.attack) && links < 3) {
                seen.add(p.attack);
                links++;
                return {
                  light: true,
                };
              }
              return {};
            },
            () => {
              hit = hit || e.receivedCombo > 0;
              return {
                block: hit,
              };
            },
          );
          assert(events('contact').filter((x) => !x.blocked).length >= 4, p.def.id);
        }
      });
      test('三角色挑空追击资源路线发生真实三次接触', () => {
        for (const c of [0, 2, 3]) {
          const [p, e] = fresh(c);
          let links = 0,
            seen = new Set(),
            hit = false;
          step(
            200,
            (i) => {
              if (i === 0)
                return {
                  light: true,
                };
              if (p.attack && p.hitResult === 'hit' && !seen.has(p.attack)) {
                seen.add(p.attack);
                if (links === 0) {
                  links++;
                  return {
                    heavy: true,
                    up: true,
                  };
                }
                if (links === 1) {
                  links++;
                  return {
                    pursuit: true,
                  };
                }
              }
              if (links === 2 && !p.attack && p.dashTime <= 0) {
                links++;
                return {
                  light: true,
                };
              }
              return {};
            },
            () => {
              hit = hit || e.receivedCombo > 0;
              return {
                block: hit,
              };
            },
          );
          assert(events('contact').filter((x) => !x.blocked).length >= 3, p.def.id);
          assert(events('pursuit').some((x) => x.cost === 12));
        }
      });
      test('桃白白突掌真连，悟空比克特殊技衔接有间隙', () => {
        for (const c of [0, 2, 3]) {
          const [p, e] = fresh(c);
          let sent = false,
            hit = false;
          step(
            180,
            (i) => {
              if (i === 0)
                return {
                  light: true,
                };
              if (p.hitResult === 'hit' && p.attack && !sent) {
                sent = true;
                return {
                  special: true,
                };
              }
              return {};
            },
            () => {
              hit = hit || e.receivedCombo > 0;
              return {
                block: hit,
              };
            },
          );
          const special = events('contact').find(
            (x) => x.move === combatModule.SPECIAL_MOVES[p.def.id].name,
          );
          assert(!!special && special.blocked === (c !== 2), p.def.id);
        }
      });
      test('三角色真实重击空挥可被近身轻击惩罚', () => {
        for (const c of [0, 2, 3]) {
          const [p, e] = fresh(c, c, 2.3);
          p.startAttack('heavy');
          let moved = false;
          step(160, {}, () => {
            if (!moved && p.attack && p.stateTimer > p.attack.hitT + p.attack.active + 0.02) {
              e.pos.copy(p.pos).add(new THREE.Vector3(0.8, 0, 0));
              e.previousPos.copy(e.pos);
              moved = true;
              return {
                light: true,
              };
            }
            return {};
          });
          assert(events('whiff').some((x) => x.side === 0));
          assert(
            events('contact').some((x) => x.side === 1 && x.punish),
            p.def.id,
          );
        }
      });
      test('三角色格挡后确反具有可执行窗口', () => {
        for (const c of [0, 2, 3]) {
          fresh(c);
          matchModule.game.difficulty = 'training';
          trainingModule.startDrill('guard');
          let sent = false;
          step(
            240,
            () => {
              const d = trainingModule.drillSystem.current;
              if (d.phase !== 'window')
                return {
                  block: true,
                };
              if (
                matchModule.player.state === 'blockstun' &&
                matchModule.player.stateTimer < matchModule.player.stunTime - 2 * matchModule.STEP
              )
                return {
                  block: true,
                };
              if (!sent) {
                sent = true;
                return {
                  light: true,
                };
              }
              return {};
            },
            () => trainingModule.drillInput(matchModule.enemy, matchModule.player) ?? {},
          );
          assert(
            trainingModule.drillSystem.current.success === true,
            matchModule.player.def.id + ' ' + trainingModule.drillSystem.current.message,
          );
        }
      });
      test('精准格挡后实际反击可命中，非无条件伤害', () => {
        const [p] = fresh();
        let counter = false;
        step(
          100,
          (i) =>
            i === 0
              ? {
                  light: true,
                }
              : {},
          () => {
            if (events('parry').length && !counter) {
              counter = true;
              return {
                light: true,
              };
            }
            return {
              block: !!p.attack && p.stateTimer >= p.attack.hitT - 4 * matchModule.STEP,
            };
          },
        );
        assert(
          events('parry').length === 1 && events('contact').some((x) => x.side === 1 && !x.blocked),
        );
      });
      test('闪身取消事件标记8气，普通闪身标记5气', () => {
        const [p] = fresh();
        let sent = false;
        step(70, (i) => {
          if (i === 0)
            return {
              light: true,
            };
          if (p.hitResult === 'hit' && !sent) {
            sent = true;
            return {
              dash: true,
            };
          }
          return {};
        });
        assert(events('dash').some((x) => x.cost === 8));
        fresh();
        step(3, {
          dash: true,
        });
        assert(events('dash').some((x) => x.cost === 5));
      });
      test('残像脱离事件消耗15气及一次储存', () => {
        const [p] = fresh();
        const charges = p.escapeCharges;
        step(3, {
          evasion: true,
        });
        assert(events('evasion').some((x) => x.cost === 15) && p.escapeCharges === charges - 1);
      });
      test('比克霸体显示窗口与一次承伤标记一致', () => {
        const [p] = fresh(3);
        p.comboType = 'heavy';
        p.comboIdx = 1;
        p.comboTimer = 1;
        p.startAttack('heavy');
        assert(aiModule.armorWindow(p));
        p.armorSpent = true;
        assert(!aiModule.armorWindow(p));
        p.armorSpent = false;
        p.stateTimer = p.attack.hitT;
        assert(!aiModule.armorWindow(p));
      });
      test('标准竞技关闭生成与拾取，规则切换重置', () => {
        fresh();
        matchModule.game.matchRule = 'competitive';
        matchModule.startFight();
        matchModule.game.ready = 0;
        worldModule.updateSenzu(99);
        assert(
          worldModule.currentMap.senzuSpawnCount === 0 &&
            !worldModule.currentMap.senzus.some((x) => x.active),
        );
        matchModule.game.matchRule = 'senzu';
        matchModule.startFight();
        matchModule.game.ready = 0;
        worldModule.updateSenzu(25);
        assert(worldModule.currentMap.senzuSpawnCount === 1);
      });
      test('仙豆规则与全部招式伤害/气力参数不变', () => {
        assert(
          worldModule.SENZU_RULES.healRatio === 0.15 &&
            worldModule.SENZU_RULES.firstSpawn === 25 &&
            worldModule.SENZU_RULES.interval === 35 &&
            worldModule.SENZU_RULES.maxSpawns === 2,
        );
        for (const c of charactersModule.CHARACTERS) {
          fresh(charactersModule.CHARACTERS.indexOf(c));
          const before = matchModule.player.ki;
          matchModule.player.startSpecial();
          assert(Math.abs(matchModule.player.ki - (before - 30)) < 1e-9);
        }
      });
      test('拾豆前落后最终获胜的逆转统计可核验', () => {
        const [p, e] = fresh();
        matchModule.game.difficulty = 'local';
        p.hp = p.maxHp * 0.45;
        e.hp = e.maxHp * 0.55;
        worldModule.updateSenzu(25);
        const b = worldModule.currentMap.senzus.find((x) => x.active);
        p.pos.set(b.x, 0, b.z);
        worldModule.updateSenzu(matchModule.STEP);
        assert(worldModule.currentMap.senzuPickups.at(-1).behindBefore);
        const count = matchModule.combatDiagnostics.rounds.length;
        matchModule.game.collectTestStats = true;
        matchModule.endGame('TIME UP');
        assert(matchModule.combatDiagnostics.rounds.at(-1).comeback === true);
        matchModule.combatDiagnostics.rounds.splice(count);
      });
      test('CPU保留120/240ms观察延迟且决策仅用过去快照', () => {
        for (const difficulty of ['hard', 'normal']) {
          const [p, e] = fresh();
          matchModule.game.difficulty = difficulty;
          for (let i = 0; i < 90; i++) aiModule.aiThink(e, p, matchModule.STEP);
          assert(
            e.lastDecision &&
              e.lastDecision.decisionTime - e.lastDecision.observedTime >=
                e.lastDecision.reactionDelay - 1e-9,
          );
          assert(e.lastDecision.reactionDelay === (difficulty === 'hard' ? 0.12 : 0.24));
        }
      });
      test('CPU不读取对手输入，未来输入不会改变决策', () => {
        const outcomes = [];
        for (const future of ['heavy', 'evasion']) {
          const [p, e] = fresh();
          matchModule.game.difficulty = 'hard';
          aiModule.setCombatSeed(4381);
          p.lastInput = {
            [future]: true,
            actions: [
              {
                type: future,
              },
            ],
          };
          let input;
          for (let i = 0; i < 70; i++) input = aiModule.aiThink(e, p, matchModule.STEP);
          outcomes.push(
            JSON.stringify({
              input,
              decision: e.lastDecision,
              memory: e.tacticalMemory,
            }),
          );
        }
        assert(outcomes[0] === outcomes[1]);
      });
      test('CPU三角色目标距离不同且短手不会站得过远', () => {
        const x = [];
        for (const c of [0, 2, 3]) {
          const [p, e] = fresh(c);
          x.push(
            aiModule.cpuDistance(p, {
              scale: e.baseScale,
            }),
          );
        }
        assert(new Set(x).size === 3);
        const [p] = fresh(3, 5);
        assert(
          aiModule.cpuDistance(p, {
            scale: 0.79,
          }) <= 0.9,
        );
      });
      test('CPU近六次行为记忆与24个观察有界', () => {
        const [p, e] = fresh();
        matchModule.game.difficulty = 'hard';
        for (let i = 0; i < 300; i++) {
          p.attack = {
            ...charactersModule.CHARACTERS[0].combos.heavy[0],
            serial: i,
            motion: 'heavyPunch',
          };
          p.stateTimer = 0.4;
          aiModule.aiThink(e, p, matchModule.STEP);
        }
        assert(e.observations.length <= 24 && e.tacticalMemory.samples.length <= 6);
      });
      test('CPU能选择明显收招窗口的轻击惩罚', () => {
        const [p, e] = fresh(3, 0, 0.9);
        matchModule.game.difficulty = 'hard';
        p.startAttack('heavy');
        p.stateTimer = p.attack.hitT + p.attack.active + 0.02;
        let found = false;
        aiModule.setCombatSeed(4201);
        for (let i = 0; i < 80; i++) {
          const x = aiModule.aiThink(e, p, matchModule.STEP);
          if (e.aiIntent === 'punish' && x.actions?.some((x) => x.type === 'light')) found = true;
        }
        assert(found);
      });
      test('命中确认训练只以真实第二次连续接触成功', () => {
        fresh();
        matchModule.game.difficulty = 'training';
        trainingModule.startDrill('confirm');
        trainingModule.drillSystem.current.defend = false;
        matchModule.enemy.guardHeld = 0;
        matchModule.enemy.wasBlocking = false;
        let second = false;
        step(
          180,
          (i) => {
            if (i === 0)
              return {
                light: true,
              };
            if (trainingModule.drillSystem.current.phase === 'hit' && !second) {
              second = true;
              return {
                light: true,
              };
            }
            return {};
          },
          () => trainingModule.drillInput(matchModule.enemy, matchModule.player) ?? {},
        );
        assert(
          trainingModule.drillSystem.current.success === true &&
            events('contact').filter((e) => !e.blocked).length >= 2,
        );
      });
      test('被挡后停止才算确认成功，盲目接重会失败', () => {
        for (const continueAttack of [false, true]) {
          fresh(2);
          matchModule.game.difficulty = 'training';
          trainingModule.startDrill('confirm');
          trainingModule.drillSystem.current.defend = true;
          matchModule.enemy.guardHeld = 0.4;
          matchModule.enemy.wasBlocking = true;
          let sent = false;
          step(
            180,
            (i) => {
              if (i === 0)
                return {
                  light: true,
                };
              if (
                continueAttack &&
                trainingModule.drillSystem.current.phase === 'blocked' &&
                !sent
              ) {
                sent = true;
                return {
                  heavy: true,
                };
              }
              return {};
            },
            () => trainingModule.drillInput(matchModule.enemy, matchModule.player) ?? {},
          );
          assert(trainingModule.drillSystem.current.success === !continueAttack);
        }
      });
      test('三角色通过距离移动完成真实空挥惩罚专项', () => {
        for (const c of [0, 2, 3]) {
          fresh(c);
          matchModule.game.difficulty = 'training';
          trainingModule.startDrill('whiff');
          let sent = false;
          step(
            280,
            () => {
              const d = trainingModule.drillSystem.current,
                dist = matchModule.player.pos.distanceTo(matchModule.enemy.pos);
              if (d.phase === 'attacking' && dist < 2.1)
                return {
                  down: true,
                  moveYaw: Math.PI / 2,
                };
              if (d.phase === 'window') {
                if (dist > 0.9)
                  return {
                    up: true,
                    moveYaw: Math.PI / 2,
                  };
                if (!sent) {
                  sent = true;
                  return {
                    light: true,
                  };
                }
              }
              return {};
            },
            () => trainingModule.drillInput(matchModule.enemy, matchModule.player) ?? {},
          );
          assert(
            trainingModule.drillSystem.current.success === true,
            matchModule.player.def.id + ' ' + trainingModule.drillSystem.current.message,
          );
        }
      });
      test('格挡专项不反击、空挥专项不追近均不能成功', () => {
        for (const kind of ['guard', 'whiff']) {
          fresh();
          matchModule.game.difficulty = 'training';
          trainingModule.startDrill(kind);
          step(
            260,
            () =>
              kind === 'guard'
                ? {
                    block: true,
                  }
                : trainingModule.drillSystem.current.phase === 'attacking'
                  ? {
                      down: true,
                      moveYaw: Math.PI / 2,
                    }
                  : {},
            () => trainingModule.drillInput(matchModule.enemy, matchModule.player) ?? {},
          );
          assert(
            trainingModule.drillSystem.current.finished &&
              !trainingModule.drillSystem.current.success,
          );
        }
      });
      test('专项重试、超时失败和成功率记录一致', () => {
        trainingModule.drillSystem.stats = {};
        fresh();
        matchModule.game.difficulty = 'training';
        trainingModule.startDrill('confirm');
        const key = trainingModule.drillSystem.current.key;
        trainingModule.startDrill('confirm');
        assert(
          trainingModule.drillSystem.stats[key].attempts === 1 &&
            trainingModule.drillSystem.stats[key].successes === 0,
        );
        step(970, {}, () => trainingModule.drillInput(matchModule.enemy, matchModule.player) ?? {});
        assert(
          trainingModule.drillSystem.current.finished &&
            trainingModule.drillSystem.stats[key].attempts === 2,
        );
      });
      test('暂停不会让专项计时误判结束', () => {
        fresh();
        matchModule.game.difficulty = 'training';
        trainingModule.startDrill('confirm');
        matchModule.game.paused = true;
        matchModule.game.simTime = 20;
        trainingModule.updateDrill();
        assert(!trainingModule.drillSystem.current.finished);
        matchModule.game.paused = false;
      });
      test('30/60/144Hz含差异Hitstop的战斗结果一致', () => {
        const outcomes = [];
        for (const hz of [30, 60, 144]) {
          const [p, e] = fresh();
          let issued = 0;
          const provider = () => {
            const times = [0, 0.145, 0.33];
            if (issued < times.length && matchModule.game.simTime >= times[issued]) {
              issued++;
              return {
                actions: [
                  {
                    type: 'light',
                  },
                ],
              };
            }
            return {};
          };
          for (let i = 0; i < hz * 2; i++) combatModule.advanceCombat(1 / hz, provider, () => ({}));
          outcomes.push(
            JSON.stringify({
              hp: [p.hp, e.hp],
              ki: [p.ki, e.ki],
              pos: [p.pos.toArray(), e.pos.toArray()],
              state: [p.state, e.state],
              simTime: matchModule.game.simTime,
              contacts: events('contact').map((e) => [e.time, e.feedback, e.damage]),
            }),
          );
        }
        assert(outcomes.every((x) => x === outcomes[0]));
      });
    } finally {
      trainingModule.drillSystem.current = null;
      trainingModule.drillSystem.stats = savedStats;
      matchModule.backToMenu();
      Object.assign(matchModule.game, saved);
      matchModule.game.manualTest = saved.manualTest;
      matchModule.game.screen = 'menu';
      matchModule.game.paused = false;
      matchModule.game.over = false;
      matchModule.game.keepPair = false;
      uiModule.updateSelection();
    }
    return {
      passed: results.filter((x) => x.pass).length,
      failed: results.filter((x) => !x.pass).length,
      total: results.length,
      results,
    };
  }
  function runAllCombatTests(group = 'all') {
    if (group === 'V1') return runV1Tests();
    const base = testingModule.runCombatTests(group);
    if (group !== 'all') return base;
    const next = runV1Tests();
    return {
      passed: base.passed + next.passed,
      failed: base.failed + next.failed,
      total: base.total + next.total,
      baselineTotal: base.total,
      v1Total: next.total,
      results: [...base.results, ...next.results],
    };
  }
  return function initialize() {
    queueMicrotask(() => {
      if (location.search.includes('test=1'))
        Object.assign(window.__db, {
          runTests: runAllCombatTests,
          runV1Tests,
        });
    });
  };
}
