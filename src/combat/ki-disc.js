import * as THREE from 'three';
export function register({
  animation: animationModule,
  characters: charactersModule,
  combat: combatModule,
  match: matchModule,
  render: renderModule,
  training: trainingModule,
  world: worldModule,
}) {
  let krillinDef;
  function buildKiDisc() {
    const g = new THREE.Group();
    const edge = renderModule.energyMat(0xffd547, 0.95),
      core = renderModule.energyMat(0xffffe4, 0.85);
    charactersModule.meshTo(g, new THREE.CylinderGeometry(0.53, 0.53, 0.028, 64), core);
    const rim = charactersModule.meshTo(g, new THREE.TorusGeometry(0.54, 0.025, 8, 64), edge);
    rim.rotation.x = Math.PI / 2;
    for (let i = 0; i < 8; i++) {
      const line = charactersModule.meshTo(
        g,
        new THREE.TorusGeometry(0.13 + i * 0.046, 0.005, 3, 40, Math.PI * 1.4),
        renderModule.energyMat(0xffec82, 0.6),
      );
      line.rotation.set(Math.PI / 2, i * 0.25, 0);
    }
    g.traverse((o) => {
      o.castShadow = o.receiveShadow = false;
    });
    return g;
  }
  combatModule.castKiDiscVisual = function castKiDiscVisual(f) {
    const rig = buildKiDisc();
    renderModule.scene.add(rig);
    renderModule.ultimateVisuals.push({
      f,
      attack: f.attack,
      rig,
      isDisc: true,
      elapsed: 0,
    });
  };
  combatModule.fireKiDisc = function fireKiDisc(f, a) {
    const mesh = buildKiDisc(),
      direction = f.forward();
    const pos = f.pos
      .clone()
      .add(new THREE.Vector3(0, 1.4 * f.baseScale, 0))
      .addScaledVector(direction, 0.6);
    mesh.position.copy(pos);
    renderModule.scene.add(mesh);
    combatModule.kiDiscs.push({
      mesh,
      owner: f,
      attack: {
        ...a,
        projectile: true,
        level: 'mid',
        guardDamage: 70,
        unblockable: false,
      },
      direction,
      pos,
      previous: pos.clone(),
      life: 1.1,
      distance: 0,
      speed: 16.5,
      hit: false,
      stageNext: 1.4,
    });
  };
  combatModule.updateKiDiscs = function updateKiDiscs(dt) {
    for (let i = combatModule.kiDiscs.length - 1; i >= 0; i--) {
      const d = combatModule.kiDiscs[i];
      d.previous.copy(d.pos);
      d.pos.addScaledVector(d.direction, d.speed * dt);
      d.distance += d.speed * dt;
      d.life -= dt;
      d.mesh.position.copy(d.pos);
      d.mesh.rotation.y += dt * 28;
      if (d.distance >= d.stageNext && d.pos.y < 2.5) {
        d.stageNext += 1.4;
        worldModule.damageStage(
          d.owner,
          {
            ...d.attack,
            isUlt: false,
            dmg: 36,
          },
          d.pos,
        );
      }
      const foe = d.owner === matchModule.player ? matchModule.enemy : matchModule.player;
      if (foe && foe.hp > 0 && !d.hit && !matchModule.game.over) {
        const target = d.pos;
        if (trainingModule.discIntersects(d, foe) && foe.invulnerable <= 0) {
          d.hit = true;
          foe.takeHit(d.owner, d.attack);
          worldModule.damageStage(
            d.owner,
            {
              ...d.attack,
              isUlt: false,
              dmg: 36,
            },
            foe.pos,
          );
          d.life = 0;
          renderModule.spawnSpark(target, 0xffe48d, 14, 0.8);
        }
      }
      if (d.life <= 0 || d.distance > 18) {
        renderModule.scene.remove(d.mesh);
        worldModule.disposeGroup(d.mesh);
        combatModule.kiDiscs.splice(i, 1);
      }
    }
  };
  combatModule.clearKiDiscs = function clearKiDiscs() {
    for (const d of combatModule.kiDiscs) {
      renderModule.scene.remove(d.mesh);
      worldModule.disposeGroup(d.mesh);
    }
    combatModule.kiDiscs.length = 0;
  };
  combatModule.updateDiscCharge = function updateDiscCharge(v) {
    const f = v.f,
      t = f.stateTimer;
    f.parts.handR.getWorldPosition(v.rig.position);
    v.rig.position.y += 0.11;
    v.rig.visible = t < v.attack.hitT;
    v.rig.rotation.y = t * 24;
    v.rig.scale.setScalar(0.1 + Math.min(1, t / v.attack.hitT) * 0.95);
  };
  return function initialize() {
    krillinDef = charactersModule.CHARACTERS.find((c) => c.id === 'krillin');
    Object.assign(krillinDef, {
      name: '小林',
      ultName: '气元斩',
      ultStyle: 'kienzan',
      ultColor: 0xffed73,
    });
    animationModule.ANIM.kienzan = [
      [0, animationModule.IDLE_POSE],
      [
        0.16,
        animationModule.pz({
          aR: [-2.85, 0, 0.08],
          aL: [-0.65, 0, -0.32],
          t: [0.04, -0.16, 0],
          h: [-0.1, 0, 0],
          lL: [0.1, 0, 0.04],
          lR: [-0.1, 0, -0.04],
        }),
      ],
      [
        0.44,
        animationModule.pz({
          aR: [-3.0, 0, 0.1],
          aL: [-0.6, 0, -0.28],
          t: [0.06, -0.22, 0],
          h: [-0.13, 0, 0],
          lL: [0.16, 0, 0.04],
          lR: [-0.17, 0, -0.04],
        }),
      ],
      [
        0.66,
        animationModule.pz({
          aR: [-1.48, 0.12, 0.05],
          aL: [-0.75, 0, -0.4],
          t: [0.1, 0.12, 0],
          h: [0.02, 0, 0],
          lL: [0.14, 0, 0.04],
          lR: [-0.16, 0, -0.04],
        }),
      ],
      [
        1,
        animationModule.pz({
          aR: [-1.25, 0, 0.2],
          aL: [-0.55, 0, -0.3],
          t: [0.04, 0, 0],
        }),
      ],
    ];
    krillinDef.ultAnim = animationModule.ANIM.kienzan;
    combatModule.kiDiscs = [];
  };
}
