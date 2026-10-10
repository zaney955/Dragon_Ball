import * as THREE from 'three';
import { stateCodec } from './state-codec.js';
import { BATTLE_RULESET } from '../online/battle-version.js';

const FIGHTER_VISUAL = new Set([
  'root',
  'parts',
  'materials',
  'shadow',
  'nimbus',
  'combatRig',
  'kiVisual',
  'chargeVoice',
  'ultAudioNodes',
  'render',
  'onlineBaseRender',
]);
const GAME_KEYS = [
  'selectedChar',
  'selectedMap',
  'opponent',
  'difficulty',
  'keepPair',
  'lastPair',
  'lightPreset',
  'matchRule',
  'ringOut',
  'ringWinner',
  'timeLeft',
  'simTime',
  'ready',
  'hitStop',
  'over',
  'round',
  'matchRound',
  'wins',
  'matchFinished',
  'endReason',
  'lastWinner',
  'roundMetrics',
  'comboCount',
  'comboTimer',
  'comboDamage',
  'infiniteKi',
  'trainingDummy',
];
const COLLECTIONS = [
  'kiBlasts',
  'kiDiscs',
  'v2Projectiles',
  'v2Devices',
  'v2Supports',
  'youthEntities',
];
const pick = (value, omit) =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !omit(key)));
const transform = (node) => ({
  position: node.position.toArray(),
  quaternion: node.quaternion.toArray(),
  scale: node.scale.toArray(),
  visible: node.visible,
  color: node.material?.color?.getHex(),
});
function applyTransform(node, data) {
  node.position.fromArray(data.position);
  node.quaternion.fromArray(data.quaternion);
  node.scale.fromArray(data.scale);
  node.visible = data.visible;
  if (data.color !== undefined && node.material?.color) node.material.color.setHex(data.color);
}
export function battleStateDigest(snapshot) {
  let hash = 2166136261;
  for (const char of JSON.stringify([snapshot.actors, snapshot.state]))
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash.toString(16).padStart(8, '0');
}
export function register({ ai, animation, characters, combat, input, match, render, world }) {
  function registry(visuals) {
    const references = new Map();
    function tree(node, path) {
      if (!node) return;
      references.set(path, node);
      if (node.geometry) references.set(path + '/geometry', node.geometry);
      if (node.material) references.set(path + '/material', node.material);
      node.children?.forEach((child, i) => tree(child, path + '/' + i));
    }
    for (const def of characters.CHARACTERS) references.set('character/' + def.id, def);
    for (const [name, anim] of Object.entries(animation.ANIM))
      references.set('animation/' + name, anim);
    [match.player, match.enemy].forEach((f, side) => {
      references.set('fighter/' + side, f);
      tree(f.root, 'body/' + side);
      tree(f.nimbus, 'nimbus/' + side);
      for (const [name, part] of Object.entries(f.parts)) {
        if (part?.isObject3D) tree(part, `part/${side}/${name}`);
        else if (Array.isArray(part))
          part.forEach((node, i) => {
            if (node?.isObject3D) tree(node, `part/${side}/${name}/${i}`);
          });
      }
    });
    tree(world.currentMap.group, 'map');
    world.currentMap.destructibles.forEach((prop, i) => tree(prop.mesh, 'prop/' + i));
    visuals.forEach((node, i) => tree(node, 'entity/' + i));
    return references;
  }
  combat.captureBattleState = function () {
    if (!match.player || !match.enemy || !world.currentMap || match.game.over)
      throw new Error('只能保存进行中的完整战斗');
    const records = Object.fromEntries(COLLECTIONS.map((name) => [name, combat[name] ?? []]));
    const roots = [];
    for (const record of Object.values(records).flat()) {
      if (record.mesh && !roots.includes(record.mesh)) roots.push(record.mesh);
    }
    const map = world.currentMap;
    const fighters = [match.player, match.enemy].map((f) => {
      const state = pick(f, (key) => FIGHTER_VISUAL.has(key) || key.startsWith('online'));
      state.youth = pick(f.youth, (key) => key === 'normalBody');
      return state;
    });
    const payload = {
      fighters,
      game: Object.fromEntries(GAME_KEYS.map((key) => [key, match.game[key]])),
      accumulator: match.stepAccumulator,
      random: ai.tacticalSeed >>> 0,
      events: { serial: combat.combatEvents.serial, sequence: combat.combatEvents.sequence },
      pendingHits: match.pendingHits,
      edges: [combat.inputEdges, input.inputEdges2],
      collections: records,
      map: pick(map, (key) => ['group', 'update', 'scars'].includes(key)),
    };
    return {
      schema: 1,
      ruleset: BATTLE_RULESET,
      actors: [match.player, match.enemy].map((f) => ({ id: f.def.id, form: f.youth.form })),
      configuration: {
        map: match.game.selectedMap,
        light: match.game.lightPreset,
        rule: match.game.matchRule,
      },
      mapTransforms: map.destructibles.map((p) => transform(p.mesh)),
      visuals: roots.map((root) => root.toJSON()),
      state: stateCodec(registry(roots)).encode(payload),
    };
  };
  combat.restoreBattleState = function (snapshot) {
    if (
      snapshot?.schema !== 1 ||
      snapshot.ruleset !== BATTLE_RULESET ||
      !Array.isArray(snapshot.actors) ||
      snapshot.actors.length !== 2 ||
      !Array.isArray(snapshot.visuals) ||
      snapshot.visuals.length > 128 ||
      JSON.stringify(snapshot).length > 2000000
    )
      throw new Error('完整战斗存档无效或版本不同');
    const indices = snapshot.actors.map((a) =>
      characters.CHARACTERS.findIndex((def) => def.id === a.id),
    );
    if (indices.includes(-1) || ![0, 1, 2, 3].includes(snapshot.configuration?.map))
      throw new Error('存档角色或地图无效');
    for (const visual of snapshot.visuals) {
      if (
        (visual.images ?? []).some(
          (image) => typeof image.url === 'string' && !image.url.startsWith('data:'),
        )
      )
        throw new Error('存档不能加载外部图片');
    }
    const local = {
      manualTest: match.game.manualTest,
      muted: match.game.muted,
      online: match.game.online,
      onlineSeat: match.game.onlineSeat,
      spectating: match.game.spectating,
    };
    Object.assign(match.game, {
      selectedChar: indices[0],
      opponent: indices[1],
      keepPair: false,
      selectedMap: snapshot.configuration.map,
      lightPreset: snapshot.configuration.light,
      matchRule: snapshot.configuration.rule,
    });
    match.startFight();
    const fighters = [match.player, match.enemy];
    fighters.forEach((f, side) => {
      if (snapshot.actors[side].form) combat.setYouthBody(f, snapshot.actors[side].form);
    });
    const loader = new THREE.ObjectLoader();
    const roots = snapshot.visuals.map((json) => loader.parse(json));
    roots.forEach((root) => render.scene.add(root));
    const payload = stateCodec(registry(roots)).decode(snapshot.state);
    fighters.forEach((f, side) => {
      const normalBody = f.youth.normalBody;
      for (const key of Object.keys(f))
        if (!FIGHTER_VISUAL.has(key) && !key.startsWith('online')) delete f[key];
      Object.assign(f, payload.fighters[side]);
      f.youth.normalBody = normalBody;
      f.combatRig = null;
    });
    Object.assign(match.game, payload.game, local);
    match.stepAccumulator = payload.accumulator;
    ai.setCombatSeed(payload.random);
    Object.assign(combat.combatEvents, payload.events);
    combat.combatEvents.history.length = 0;
    match.pendingHits = payload.pendingHits;
    combat.inputEdges.splice(0, combat.inputEdges.length, ...payload.edges[0]);
    input.inputEdges2.splice(0, input.inputEdges2.length, ...payload.edges[1]);
    for (const name of COLLECTIONS)
      combat[name].splice(0, combat[name].length, ...payload.collections[name]);
    Object.assign(world.currentMap, payload.map);
    for (const bean of world.currentMap.senzus ?? []) {
      bean.group.visible = bean.active;
      bean.group.position.set(bean.x, 0, bean.z);
    }
    snapshot.mapTransforms.forEach((state, i) =>
      applyTransform(world.currentMap.destructibles[i].mesh, state),
    );
    render.scene.updateMatrixWorld(true);
    render.resetShoulderCameras();
    for (const record of combat.youthEntities)
      if (record.kind === 'cover')
        record.mesh.traverse((node) => {
          if (node.isMesh) render.cameraObstacles.push(node);
        });
    fighters.forEach((f) => f.render(0, 1));
    return battleStateDigest(combat.captureBattleState());
  };
  return function initialize() {
    queueMicrotask(() => {
      if (window.__db)
        Object.assign(window.__db, {
          captureBattleState: combat.captureBattleState,
          restoreBattleState: combat.restoreBattleState,
          battleStateDigest,
        });
    });
  };
}
