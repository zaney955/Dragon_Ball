import * as THREE from 'three';
export function register({
  art: artModule,
  characters: charactersModule,
  combat: combatModule,
  match: matchModule,
  render: renderModule,
  ui: uiModule,
  world: worldModule,
}) {
  combatModule.v2Sound = function v2Sound(f, kind) {
    if (matchModule.game.manualTest || matchModule.game.muted) return;
    const ids = charactersModule.CHARACTERS.map((c) => c.id),
      i = ids.indexOf(f.def.id),
      mechanical = ['bulma', 'pilaf'].includes(f.def.id);
    renderModule.ultTone(
      f,
      kind === 'ult' ? 90 + i * 27 : 180 + i * 39,
      kind === 'ult' ? 40 + i * 11 : 90 + i * 17,
      kind === 'ult' ? 0.25 : 0.09,
      0.016,
      mechanical ? 'square' : f.def.id === 'korin' ? 'sine' : 'triangle',
    );
  };
  combatModule.newProjectile = function newProjectile(owner, a, kind, options = {}) {
    const forward = options.direction ?? owner.forward(),
      pos =
        options.pos?.clone() ??
        owner.pos
          .clone()
          .add(
            new THREE.Vector3(
              0,
              owner.anatomy ? owner.anatomy.hip + owner.anatomy.armY : 1.3 * owner.baseScale,
              0,
            ),
          )
          .addScaledVector(forward, 0.35),
      mesh = new THREE.Group();
    if (!options.pos) pos.y += worldModule.groundHeight?.(pos.x, pos.z) ?? 0;
    const material = charactersModule.M(
      kind === 'blade'
        ? 0xe1e5dc
        : kind === 'missile'
          ? 0xd2d2c5
          : kind === 'bullet'
            ? 0xffce7b
            : kind === 'grenade'
              ? 0xd399b1
              : 0xdccaff,
    );
    if (kind === 'blade') {
      const blade = charactersModule.meshTo(
        mesh,
        new THREE.TorusGeometry(0.17, 0.035, 4, 12, Math.PI * 1.65),
        material,
      );
      blade.rotation.x = Math.PI / 2;
    } else if (kind === 'missile') {
      charactersModule.meshTo(
        mesh,
        new THREE.CylinderGeometry(0.07, 0.1, 0.35, 8),
        material,
      ).rotation.x = Math.PI / 2;
      charactersModule.box(mesh, charactersModule.M(0xb95542), 0, 0, -0.16, 0.22, 0.025, 0.1);
    } else if (kind === 'grenade') {
      charactersModule.ball(mesh, material, 0, 0, 0, 0.11);
      charactersModule.box(mesh, charactersModule.M(0xffffff), 0, 0.02, 0.1, 0.07, 0.1, 0.02);
    } else {
      charactersModule.ball(mesh, material, 0, 0, 0, options.radius ?? 0.075);
    }
    renderModule.scene.add(mesh);
    const q = {
      owner,
      attack: combatModule.finalizeMove({
        ...a,
        projectile: true,
        ki: 0,
        shape: undefined,
      }),
      source: a,
      kind,
      mesh,
      pos,
      previous: pos.clone(),
      direction: options.direction
        ? forward.clone().normalize()
        : a.targetY != null
          ? forward
              .clone()
              .multiplyScalar(a.targetDistance ?? Math.max(0.75, a.range * 0.5))
              .setY(
                a.targetY +
                  (worldModule.groundHeight?.(
                    pos.x + forward.x * (a.targetDistance ?? a.range),
                    pos.z + forward.z * (a.targetDistance ?? a.range),
                  ) ?? 0) -
                  pos.y,
              )
              .normalize()
          : forward.clone().normalize(),
      speed: options.speed ?? 12,
      life: options.life ?? 0.9,
      maxLife: options.life ?? 0.9,
      distance: 0,
      r: options.radius ?? 0.1,
      hits: new Set(),
      returning: false,
      ...options,
    };
    combatModule.v2Projectiles.push(q);
    return q;
  };
  combatModule.removeAbility = function removeAbility(list, item) {
    renderModule.scene.remove(item.mesh);
    worldModule.disposeGroup(item.mesh);
    const i = list.indexOf(item);
    if (i >= 0) list.splice(i, 1);
    if (item.kind === 'blade') item.owner.v2.bladeOut = false;
  };
  combatModule.cleanupAbilities = function cleanupAbilities(owner = null) {
    for (const list of [
      combatModule.v2Projectiles,
      combatModule.v2Devices,
      combatModule.v2Supports,
    ])
      for (const x of [...list])
        if (!owner || x.owner === owner) combatModule.removeAbility(list, x);
  };
  function deviceModel(kind) {
    const g = new THREE.Group(),
      metal = charactersModule.M(0x627e82);
    charactersModule.box(g, metal, 0, 0.2, 0, 0.45, 0.3, 0.45);
    for (const s of [-1, 1]) {
      charactersModule.box(g, charactersModule.M(0x34454d), s * 0.2, 0.08, 0, 0.08, 0.16, 0.52);
    }
    if (kind === 'turret') {
      charactersModule.ball(g, charactersModule.M(0x65beb5), 0, 0.44, 0, 0.18);
      charactersModule.box(g, charactersModule.M(0x384b5a), 0, 0.44, 0.22, 0.08, 0.09, 0.35);
    } else {
      charactersModule.meshTo(
        g,
        new THREE.CylinderGeometry(0.27, 0.29, 0.1, 12),
        charactersModule.M(0xcfad67),
        0,
        0.15,
        0,
      );
      charactersModule.ball(g, charactersModule.M(0xffd78b), 0, 0.28, 0, 0.08);
    }
    return g;
  }
  combatModule.deployDevice = function deployDevice(f, a, kind = 'turret', offset = 1.2) {
    const owned = combatModule.v2Devices.filter((x) => x.owner === f);
    if (owned.length >= 2) return false;
    const pos = f.pos.clone().addScaledVector(f.forward(), offset);
    pos.y = 0;
    if (worldModule.currentMap.playArea) {
      if (!worldModule.validPosition(pos.x, pos.z, 0.6, 0.4)) return false;
    }
    const b = worldModule.currentMap.bounds;
    pos.x = THREE.MathUtils.clamp(pos.x, -b.x + 0.4, b.x - 0.4);
    pos.z = THREE.MathUtils.clamp(pos.z, -b.z + 0.4, b.z - 0.4);
    if (
      worldModule.currentMap.destructibles.some((x) => {
        if (x.tile || x.broken) return false;
        const at = x.bounds
          ? x.bounds.getCenter(new THREE.Vector3())
          : x.mesh.getWorldPosition(new THREE.Vector3());
        return at.setY(0).distanceTo(pos) < 0.95;
      })
    )
      return false;
    const mesh = deviceModel(kind);
    mesh.position.copy(pos);
    renderModule.scene.add(mesh);
    combatModule.v2Devices.push({
      owner: f,
      mesh,
      pos,
      kind,
      hp: 18,
      life: 8,
      fire: 1.1,
      warning: 0,
      hits: new Set(),
      attack: combatModule.finalizeMove({
        id: 'device',
        name: '胶囊' + (kind === 'turret' ? '炮台' : '地雷'),
        dmg: kind === 'turret' ? 6 : 10,
        stun: 0.18,
        kb: 1,
        guardDamage: 9,
        projectile: true,
        level: kind === 'mine' ? 'low' : 'mid',
        ki: 0,
      }),
    });
    combatModule.emitCombatEvent('deploy', f, null, a, {
      kind,
    });
    return true;
  };
  combatModule.switchForm = function switchForm(f, form) {
    if (f.def.id !== 'oolong') return;
    renderModule.scene.remove(f.root);
    worldModule.disposeGroup(f.root);
    const b = charactersModule.buildOolong(form);
    f.root = b.root;
    f.parts = b.parts;
    f.anatomy = b.parts.anatomy;
    f.combatRig = null;
    f.kiVisual = null;
    f.materials = [];
    const mats = new Set();
    f.root.traverse((o) => {
      if (o.material?.isMeshToonMaterial) mats.add(o.material);
    });
    for (const m of mats)
      f.materials.push({
        m,
        em: m.emissive.clone(),
        intensity: m.emissiveIntensity,
      });
    renderModule.scene.add(f.root);
    f.v2.form = form;
    f.baseScale = 1;
    f.flightMode = false;
    f.airLocked = false;
    if (form === 'bat') {
      f.pos.y = Math.max(0.03, f.pos.y);
      f.jumpVel = 2;
    }
  };
  combatModule.applyControl = function applyControl(f, foe, a) {
    if (
      foe.invulnerable > 0 ||
      foe.v2.controlGrace > 0 ||
      foe.hp <= 0 ||
      ['block', 'blockstun', 'guardbreak', 'knockdown'].includes(foe.state) ||
      foe.lastHitText === '格挡'
    )
      return false;
    const duration = Math.min(0.55, (a.control ?? 0.48) * Math.pow(0.5, foe.v2.controlChain));
    if (duration < 0.12) return false;
    foe.v2.controlChain++;
    foe.v2.controlTime = duration;
    foe.v2.controlGrace = duration + 2.2;
    foe.state = 'hit';
    foe.stateTimer = 0;
    foe.stunTime = duration;
    foe.vel.set(0, 0, 0);
    combatModule.emitCombatEvent('control', f, foe, a, {
      duration,
    });
    return true;
  };
  combatModule.releaseV2Ability = function releaseV2Ability(f, a) {
    const foe = f === matchModule.player ? matchModule.enemy : matchModule.player,
      v = f.v2;
    if (!a.ability) return;
    if (a.ability === 'blade') {
      v.bladeOut = true;
      combatModule.newProjectile(
        f,
        {
          ...a,
          dmg: 7,
        },
        'blade',
        {
          speed: 10,
          life: 2.1,
          radius: 0.14,
        },
      );
    }
    if (a.ability === 'grenade')
      combatModule.newProjectile(f, a, 'grenade', {
        speed: 8,
        life: 0.65,
        radius: 0.17,
      });
    if (a.ability === 'device') combatModule.deployDevice(f, a, a.deviceKind ?? 'turret');
    if (a.ability === 'deviceChain') {
      for (const d of combatModule.v2Devices.filter((x) => x.owner === f))
        d.life = Math.max(d.life, 3);
      combatModule.deployDevice(f, a, 'turret', 1.0);
      combatModule.deployDevice(f, a, 'mine', 2.1);
      for (let i = 0; i < 3; i++)
        combatModule.newProjectile(
          f,
          {
            ...a,
            dmg: 8,
            stun: 0.24,
            kb: 1.4,
          },
          'grenade',
          {
            speed: 8 + i * 2,
            life: 1.1 + i * 0.08,
            radius: 0.18,
          },
        );
    }
    if (a.ability === 'transform') {
      if (v.form !== 'pig') {
        combatModule.switchForm(f, 'pig');
        v.formTime = 0;
        v.formCooldown = 2.0;
      } else {
        combatModule.switchForm(f, a.choice ?? 'bull');
        v.formTime = 5.0;
      }
      renderModule.spawnDust(f.pos, 7);
    }
    if (a.ability === 'transformRush') {
      v.formSequence = {
        time: 0,
        index: 0,
        next: 0,
        foe,
        serial: a.serial,
      };
      combatModule.switchForm(f, 'bull');
      v.formTime = 2.1;
    }
    if (a.ability === 'catStep') {
      f.vel.copy(f.forward()).multiplyScalar(-9);
      const side = f.lastInput?.left ? -1 : 1;
      f.vel.addScaledVector(
        new THREE.Vector3(-Math.cos(f.facingAngle), 0, Math.sin(f.facingAngle)),
        8 * side,
      );
      f.dashTime = 0.16;
      f.dashKind = 'evade';
      f.invulnerable = Math.max(f.invulnerable, 0.075);
      combatModule.spawnAfterimage(f);
    }
    if (a.ability === 'heal' && v.heals > 0) {
      const healed = Math.min(f.maxHp - f.hp, Math.floor(f.maxHp * 0.12));
      f.hp += healed;
      v.heals--;
      v.healTotal += healed;
      combatModule.emitCombatEvent('selfHeal', f, null, a, {
        healed,
      });
      uiModule.popDamage(f.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), healed, '#c6ff9f', true);
    }
    if (a.ability === 'armMode') {
      v.mode = v.mode === 'missile' ? 'flame' : 'missile';
      v.modeTime = 5;
      v.modeCooldown = 5;
    }
    if (a.ability === 'helmet') {
      combatModule.newProjectile(
        f,
        {
          ...a,
          dmg: 21,
          range: 7.2,
          kb: 4,
          stun: 0.42,
        },
        'helmet',
        {
          speed: 24,
          life: 0.3,
          radius: 0.12,
        },
      );
    }
    if (a.ability === 'psychicVolley') {
      for (let i = 0; i < 3; i++)
        combatModule.newProjectile(
          f,
          {
            ...a,
            control: 0,
            dmg: 8,
            stun: 0.24,
            kb: 0.6,
          },
          'psychic',
          {
            speed: 11,
            life: 1.0,
            radius: 0.1,
            delay: i * 0.18,
          },
        );
    }
    if (a.ability === 'trial') {
      f.vel.copy(f.forward()).multiplyScalar(9);
      combatModule.spawnAfterimage(f);
    }
    if (a.ability === 'combine') {
      for (const [i, who] of ['修', '舞'].entries()) {
        const mesh = artModule.buildV2SupportMech(who);
        mesh.scale.setScalar(0.7);
        mesh.rotation.y = f.facingAngle;
        const pos = f.pos.clone().add(new THREE.Vector3(0, 0, (i ? 1 : -1) * 1.3));
        mesh.position.copy(pos);
        renderModule.scene.add(mesh);
        combatModule.v2Supports.push({
          owner: f,
          mesh,
          pos,
          who,
          life: 1.5,
          fire: 0.35 + i * 0.25,
          fired: false,
          attack: combatModule.finalizeMove({
            id: 'support',
            name: who + '机甲支援',
            dmg: 13,
            stun: 0.27,
            kb: 1,
            guardDamage: 14,
            projectile: true,
            ki: 0,
          }),
        });
      }
      combatModule.newProjectile(
        f,
        {
          ...a,
          dmg: 18,
          stun: 0.35,
          kb: 4,
        },
        'missile',
        {
          speed: 10,
          life: 0.9,
          radius: 0.18,
        },
      );
    }
    combatModule.v2Sound(f, 'release');
    combatModule.emitCombatEvent('ability', f, foe, a, {
      ability: a.ability,
    });
  };
  return function initialize() {};
}
