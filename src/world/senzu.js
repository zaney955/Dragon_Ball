import * as THREE from 'three';
export function register({
  ai: aiModule,
  characters: charactersModule,
  combat: combatModule,
  match: matchModule,
  render: renderModule,
  training: trainingModule,
  ui: uiModule,
  world: worldModule,
}) {
  worldModule.resetSenzu = function resetSenzu() {
    if (!worldModule.currentMap) return;
    const map = worldModule.currentMap;
    for (const item of map.senzus ?? []) {
      map.group.remove(item.group);
      worldModule.disposeGroup(item.group);
    }
    map.senzuPickups = [];
    map.senzuEvents = [];
    map.senzus = [];
    map.senzuTime = 0;
    map.senzuSpawnCount = 0;
    map.senzuNextSpawn = worldModule.SENZU_RULES.firstSpawn;
    map.senzuLastSpawn = null;
    for (const [i, x, z] of [
      [0, -5, 3],
      [1, 5, -3],
    ]) {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      map.group.add(group);
      const bean = charactersModule.ball(
        group,
        charactersModule.M(0x86d747),
        0,
        0.42,
        0,
        0.19,
        [1.2, 0.7, 0.76],
      );
      charactersModule.tube(
        group,
        charactersModule.M(0xe7e7a9),
        [
          [-0.02, 0.42, 0.14],
          [0.04, 0.44, 0.14],
        ],
        0.013,
      );
      const ring = charactersModule.meshTo(
        group,
        new THREE.TorusGeometry(0.43, 0.024, 6, 32),
        renderModule.energyMat(0x9fff8c, 0.6),
        0,
        0.035,
        0,
      );
      ring.rotation.x = Math.PI / 2;
      const light = charactersModule.meshTo(
        group,
        new THREE.CylinderGeometry(0.055, 0.15, 0.6, 12, 1, true),
        renderModule.energyMat(0x99f97a, 0.18),
        0,
        0.32,
        0,
      );
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 80;
      const ctx = canvas.getContext('2d');
      ctx.font = 'bold 38px Microsoft YaHei';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#143c28';
      ctx.lineWidth = 6;
      ctx.strokeText('仙豆', 128, 52);
      ctx.fillStyle = '#e6ffd2';
      ctx.fillText('仙豆', 128, 52);
      const tx = new THREE.CanvasTexture(canvas),
        label = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: tx,
            transparent: true,
            depthWrite: false,
            depthTest: false,
          }),
        );
      label.position.set(0, 1.03, 0);
      label.scale.set(1.12, 0.35, 1);
      label.renderOrder = 12;
      group.add(label);
      group.visible = false;
      map.senzus.push({
        group,
        bean,
        ring,
        light,
        x,
        z,
        active: false,
        timer: worldModule.SENZU_RULES.firstSpawn,
        index: i,
        spawns: 0,
        expiresAt: Infinity,
      });
    }
  };
  worldModule.validSenzuPosition = function validSenzuPosition(x, z) {
    const map = worldModule.currentMap;
    if (!map || Math.abs(x) > map.bounds.x - 1.4 || Math.abs(z) > map.bounds.z - 1.2) return false;
    for (const prop of map.destructibles ?? [])
      if (
        !prop.tile &&
        !prop.broken &&
        Math.hypot(x - prop.mesh.position.x, z - prop.mesh.position.z) < 1.35
      )
        return false;
    for (const b of map.walkObstacles ?? [])
      if (x > b.min.x - 0.7 && x < b.max.x + 0.7 && z > b.min.z - 0.7 && z < b.max.z + 0.7)
        return false;
    return true;
  };
  worldModule.placeSenzu = function placeSenzu(item) {
    const positions = [
        [-5, 3],
        [5, -3],
        [-3, -3],
        [3, 3],
        [-7, 1],
        [7, -1],
      ],
      offset = Math.floor(aiModule.combatRandom() * positions.length);
    let chosen = null,
      best = -Infinity;
    for (let i = 0; i < positions.length; i++) {
      const p = positions[(i + offset) % positions.length];
      if (!worldModule.validSenzuPosition(...p)) continue;
      const a = matchModule.player
          ? Math.hypot(matchModule.player.pos.x - p[0], matchModule.player.pos.z - p[1])
          : 5,
        b = matchModule.enemy
          ? Math.hypot(matchModule.enemy.pos.x - p[0], matchModule.enemy.pos.z - p[1])
          : 5;
      if (Math.min(a, b) < 1.65) continue;
      const score =
        Math.min(a, b) -
        Math.abs(a - b) * 0.65 -
        (worldModule.currentMap.senzuLastSpawn &&
        Math.hypot(
          p[0] - worldModule.currentMap.senzuLastSpawn.x,
          p[1] - worldModule.currentMap.senzuLastSpawn.z,
        ) < 2
          ? 3
          : 0);
      if (score > best) {
        chosen = p;
        best = score;
      }
    }
    if (!chosen) return false;
    item.x = chosen[0];
    item.z = chosen[1];
    item.group.position.set(item.x, 0, item.z);
    return true;
  };
  worldModule.updateSenzu = function updateSenzu(dt) {
    if (matchModule.game.matchRule === 'competitive') return;
    const map = worldModule.currentMap;
    if (
      !map?.senzus ||
      matchModule.game.over ||
      matchModule.game.paused ||
      matchModule.game.screen !== 'fight' ||
      matchModule.game.ready > 0 ||
      matchModule.player?.hp <= 0 ||
      matchModule.enemy?.hp <= 0
    )
      return;
    map.senzuTime += dt;
    for (const item of map.senzus)
      if (item.active && map.senzuTime + 1e-9 >= item.expiresAt) {
        item.active = false;
        item.group.visible = false;
        map.senzuEvents.push({
          type: 'expire',
          time: map.senzuTime,
          index: item.index,
        });
      }
    if (
      map.senzuSpawnCount < worldModule.SENZU_RULES.maxSpawns &&
      map.senzuTime + 1e-9 >= map.senzuNextSpawn &&
      !map.senzus.some((x) => x.active)
    ) {
      const item = map.senzus[map.senzuSpawnCount % map.senzus.length];
      if (worldModule.placeSenzu(item)) {
        item.spawns++;
        item.active = true;
        item.group.visible = true;
        item.expiresAt = map.senzuTime + worldModule.SENZU_RULES.lifetime;
        map.senzuSpawnCount++;
        map.senzuLastSpawn = {
          x: item.x,
          z: item.z,
        };
        map.senzuNextSpawn =
          map.senzuSpawnCount < worldModule.SENZU_RULES.maxSpawns
            ? worldModule.SENZU_RULES.firstSpawn +
              map.senzuSpawnCount * worldModule.SENZU_RULES.interval
            : Infinity;
        map.senzuEvents.push({
          type: 'spawn',
          time: map.senzuTime,
          index: item.index,
          x: item.x,
          z: item.z,
        });
        renderModule.spawnShockRing(new THREE.Vector3(item.x, 0.15, item.z), 0x9bff86, 0.65);
        matchModule.notify('仙豆出现', 0.9);
      }
    }
    for (const item of map.senzus) {
      item.timer =
        map.senzuSpawnCount < worldModule.SENZU_RULES.maxSpawns
          ? Math.max(0, map.senzuNextSpawn - map.senzuTime)
          : 0;
      if (!item.active) continue;
      item.bean.position.y = 0.42 + Math.sin(map.senzuTime * 3 + item.index) * 0.08;
      item.bean.rotation.y += dt;
      item.ring.rotation.z += dt * 0.6;
      let chosen = null,
        best = Infinity,
        tie = false;
      for (const f of [matchModule.player, matchModule.enemy]) {
        if (
          !f ||
          f.hp <= 0 ||
          f.hp >= f.maxHp - 0.1 ||
          f.pos.y > 0.001 ||
          ['hit', 'blockstun', 'knockdown', 'grabbed', 'guardbreak', 'dead', 'landing'].includes(
            f.state,
          )
        )
          continue;
        const d = Math.hypot(f.pos.x - item.x, f.pos.z - item.z);
        if (d >= 1.05) continue;
        if (Math.abs(d - best) < 0.001) {
          tie = true;
          continue;
        }
        if (d < best) {
          chosen = f;
          best = d;
          tie = false;
        }
      }
      if (chosen && !tie) {
        const f = chosen,
          other = f === matchModule.player ? matchModule.enemy : matchModule.player,
          behindBefore = f.hp / f.maxHp < other.hp / other.maxHp,
          amount = Math.min(
            f.maxHp - f.hp,
            Math.floor(f.maxHp * worldModule.SENZU_RULES.healRatio),
          );
        f.hp += amount;
        item.active = false;
        item.group.visible = false;
        map.senzuPickups.push({
          player: f === matchModule.player ? 1 : 2,
          name: f.def.name,
          heal: amount,
          time: map.senzuTime,
          behindBefore,
        });
        matchModule.notify(
          (matchModule.game.difficulty === 'local'
            ? (f === matchModule.player ? '1P' : '2P') + ' '
            : '') +
            '仙豆 +' +
            amount,
          0.75,
        );
        const at = f.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
        uiModule.popDamage(at, amount, '#c6ff9f', true);
        combatModule.emitCombatEvent('pickup', f, null, null, {
          feedback: 'pickup',
          healed: amount,
        });
      }
    }
  };
  worldModule.updateSenzuHUD = function updateSenzuHUD() {
    const el = document.getElementById('senzuStatus'),
      map = worldModule.currentMap;
    el.hidden = matchModule.game.screen === 'menu' || !map?.senzus;
    if (el.hidden) return;
    const active = map.senzus.find((x) => x.active);
    if (matchModule.game.matchRule === 'competitive') {
      el.textContent = '标准竞技 · 仙豆关闭';
      return;
    }
    if (active) {
      const left = Math.max(0, Math.ceil(active.expiresAt - map.senzuTime - 1e-9));
      el.textContent =
        '仙豆 · ' +
        (matchModule.game.difficulty === 'local'
          ? '已出现'
          : trainingModule.senzuHint(matchModule.player, renderModule.shoulderStates[0])) +
        ' · +15% 生命 · ' +
        left +
        '秒';
    } else if (map.senzuSpawnCount >= worldModule.SENZU_RULES.maxSpawns)
      el.textContent = '本回合仙豆已结束';
    else
      el.textContent =
        '仙豆 ' + Math.max(0, Math.ceil(map.senzuNextSpawn - map.senzuTime - 1e-9)) + '秒后出现';
  };
  return function initialize() {
    worldModule.SENZU_RULES = Object.freeze({
      healRatio: 0.15,
      firstSpawn: 25,
      interval: 35,
      maxSpawns: 2,
      lifetime: 12,
      maxActive: 1,
    });
  };
}
