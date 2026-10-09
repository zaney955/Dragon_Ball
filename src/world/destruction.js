import * as THREE from 'three';
export function register({
  characters: charactersModule,
  combat: combatModule,
  input: inputModule,
  render: renderModule,
  world: worldModule,
}) {
  worldModule.enrichDestruction = function enrichDestruction(map, id) {
    map.damageEvents = 0;
    map.brokenTiles = 0;
    map.destroyedProps = 0;
    map.destructibles = [];
    map.scars = [];
    if (id === 'budokai')
      map.group.traverse((o) => {
        if (o.geometry?.type === 'BoxGeometry' && o.geometry.parameters.height === 0.07)
          map.destructibles.push({
            mesh: o,
            tile: true,
            hp: 1,
            broken: false,
          });
      });
    if (id === 'budokai') return map;
    const rockColor = id === 'kame' ? 0xc4b086 : 0x9e9878;
    for (const [x, z] of [
      [-10, -3],
      [10, 3],
      [-8, 5],
      [9, -5],
    ]) {
      const prop = charactersModule.meshTo(
        map.group,
        new THREE.DodecahedronGeometry(0.62, 0),
        charactersModule.M(rockColor),
        x,
        0.4,
        z,
        [1, 0.85, 1.15],
      );
      map.destructibles.push({
        mesh: prop,
        hp: 2,
        broken: false,
      });
    }
    return map;
  };
  function stageDebris(pos, color, n = 9) {
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(
        new THREE.TetrahedronGeometry(0.09 + Math.random() * 0.09),
        charactersModule.M(color),
      );
      mesh.position.copy(pos);
      mesh.castShadow = true;
      renderModule.scene.add(mesh);
      renderModule.effects.push({
        mesh,
        type: 'debris',
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 5,
          2 + Math.random() * 4,
          (Math.random() - 0.5) * 5,
        ),
        life: 1.05,
        maxLife: 1.05,
        delay: 0,
      });
    }
  }
  worldModule.damageStage = function damageStage(f, a, impact = null) {
    const map = worldModule.currentMap;
    if (!map?.destructibles) return;
    map.damageEvents++;
    const dir = f.forward(),
      origin = f.pos.clone();
    origin.y = 0;
    const range = a.isUlt ? a.range : 0;
    const center = impact ? impact.clone() : origin.clone().addScaledVector(dir, range * 0.6);
    center.y = 0.025;
    const radius = a.isUlt
      ? f.def.ultStyle === 'dodonpa'
        ? 0.65
        : 1.45
      : a.dmg >= 10
        ? 0.65
        : 0.28;
    for (const item of map.destructibles) {
      if (item.broken) continue;
      const delta = item.mesh.position.clone().sub(origin);
      delta.y = 0;
      const along = delta.dot(dir),
        side = Math.abs(delta.x * dir.z - delta.z * dir.x);
      const near = a.isUlt
        ? along >= 0.1 && along <= range + 0.6 && side < radius
        : item.mesh.position.clone().setY(0).distanceTo(center.clone().setY(0)) < radius;
      if (!near) continue;
      item.hp -= a.isUlt ? 2 : 1;
      if (item.hp <= 0) {
        item.broken = true;
        if (item.tile) {
          map.brokenTiles++;
          item.mesh.position.y -= 0.055;
          item.mesh.rotation.z = (Math.random() - 0.5) * 0.055;
          item.mesh.material = item.mesh.material.clone();
          item.mesh.material.color.multiplyScalar(0.63);
        } else {
          map.destroyedProps++;
          item.mesh.visible = false;
        }
        stageDebris(
          item.mesh.position.clone().setY(0.1),
          item.mesh.material.color,
          a.isUlt ? 7 : 3,
        );
      }
    }
    // Persistent ground scars are bounded and reset with the selected arena.
    const mark = new THREE.Group();
    const rimMat = charactersModule.M(0x63584a, {
      transparent: true,
      opacity: 0.72,
    });
    for (let i = 0; i < 7; i++) {
      const angle = (i * 6.283) / 7,
        ray = 0.3 + radius * (0.5 + Math.random() * 0.5);
      charactersModule.tube(
        mark,
        rimMat,
        [
          [0, 0.015, 0],
          [Math.sin(angle) * ray * 0.45, 0.015, Math.cos(angle) * ray * 0.45],
          [Math.sin(angle + 0.12) * ray, 0.015, Math.cos(angle + 0.12) * ray],
        ],
        0.009,
      );
    }
    const crater = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 0.48, 20),
      new THREE.MeshBasicMaterial({
        color: 0x4a4337,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      }),
    );
    crater.rotation.x = -Math.PI / 2;
    crater.position.y = 0.01;
    mark.add(crater);
    mark.position.copy(center);
    map.group.add(mark);
    map.scars.push(mark);
    if (map.scars.length > 24) {
      const old = map.scars.shift();
      map.group.remove(old);
      worldModule.disposeGroup(old);
    }
    renderModule.spawnDust(center, a.isUlt ? 14 : 4);
  };
  return function initialize() {
    if (location.search.includes('test=1'))
      Object.assign(window.__db, {
        readPlayer2Input: inputModule.readPlayer2Input,
        inputEdges2: inputModule.inputEdges2,
        flightPhysics: combatModule.flightPhysics,
        damageStage: worldModule.damageStage,
        get audioProfiles() {
          return renderModule.ultAudioHistory;
        },
        get ultimateVisuals() {
          return renderModule.ultimateVisuals;
        },
      });
  };
}
