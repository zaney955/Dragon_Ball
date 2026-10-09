import * as THREE from 'three';
export const VICTORY_LINES = {
  goku: '你真厉害！下次再打一场吧！',
  roshi: '好好修炼，好好学习，吃饱睡足。',
  taopaipai: '我是世界第一杀手，桃白白！',
  piccolo: '还有谁敢反抗本大魔王？',
  tien: '这一战，我记住了。',
  krillin: '嘿嘿，这次是我赢了！',
  yamcha: '怎么样，见识到狼牙风风拳了吧！',
  gyumao: '哈哈哈！好久没打得这么痛快了！',
  chichi: '现在知道我的厉害了吧！',
  bulma: '呼……可别再让我干这种事了。',
  chiaotzu: '天津饭，我赢了。',
  oolong: '我、我赢了？嘿嘿，也没那么难嘛！',
  korin: '心急的话，可碰不到我。',
  pilaf: '哈哈哈！这就是皮尔夫大王的实力！',
};
export const RELATION_LINES = {
  'goku:krillin': '克林，再来一场吧！打完一起吃饭！',
  'roshi:goku': '还差得远呢，明天照常修炼！',
  'roshi:krillin': '还差得远呢，明天照常修炼！',
  'taopaipai:goku': '小鬼，这次可没有那么走运了。',
  'piccolo:goku': '孙悟空，这次你救不了任何人！',
  'tien:chiaotzu': '饺子，你的念力进步了。再练练近身吧。',
  'krillin:goku': '这次我赢了！明天送牛奶可别偷跑啊！',
  'yamcha:bulma': '布尔玛，你没受伤吧？刚才我已经收着力了。',
  'gyumao:chichi': '琪琪，练得不错！可别伤着自己。',
  'chichi:goku': '悟空！你答应过我的事，可别忘了！',
  'bulma:yamcha': '雅木茶，你刚才又在耍帅吧？',
  'chiaotzu:krillin': '这次不许问我算术题。',
  'oolong:pilaf': '龙珠的愿望，还是让我先许比较好！',
  'korin:goku': '悟空，想拿到水壶，你还得再快一点。',
  'pilaf:oolong': '你这头猪！上次的愿望我还没找你算账！',
  'goku:roshi': '武天老师！这次算我出师了吗？',
  'goku:piccolo': '我不会再让你伤害我的朋友！',
  'tien:taopaipai': '我已经决定走自己的路了。',
  'chiaotzu:tien': '天津饭，这次是我赢了。',
};
export function selectVictoryLine(winner, loser, form) {
  return winner === 'goku' && form === 'ape'
    ? '咦？刚才发生什么事了？'
    : (RELATION_LINES[winner + ':' + loser] ?? VICTORY_LINES[winner]);
}
export function register({ match, combat, animation, characters, render, world, audio, ui }) {
  match.clearVictory = function () {
    if (match.victory) {
      for (const b of match.victory.bodies) world.disposeGroup(b.root);
      for (const root of match.victory.lastHitBodies ?? []) world.disposeGroup(root);
      match.victory = null;
    }
    document.getElementById('victorySubtitle')?.remove();
    document.getElementById('skipVictory')?.remove();
  };
  match.beginVictory = function (winner, snapshots) {
    match.clearVictory();
    const finished = match.game.matchFinished;
    const lastHitScene = new THREE.Scene();
    lastHitScene.background = render.scene.background;
    lastHitScene.add(new THREE.HemisphereLight(0xffefd0, 0x536b75, 2));
    const lastHitBodies = [];
    for (const f of [match.player, match.enemy]) {
      f.render(0, 1);
      const root = f.root.clone(true);
      root.traverse((o) => {
        if (o.isMesh) {
          o.geometry = o.geometry.clone();
          o.material = Array.isArray(o.material)
            ? o.material.map((m) => m.clone())
            : o.material.clone();
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            if (m.map) m.map = m.map.clone();
          }
        }
      });
      lastHitScene.add(root);
      lastHitBodies.push(root);
    }
    const lastHitCamera = render.camera.clone();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x263446);
    scene.add(new THREE.HemisphereLight(0xfff0d2, 0x617694, 2.5));
    const key = new THREE.DirectionalLight(0xffefd7, 3);
    key.position.set(-3, 6, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x82bcff, 2);
    rim.position.set(4, 3, -3);
    scene.add(rim);
    const index = winner === 'enemy' ? 1 : 0,
      selected = winner === 'draw' ? snapshots : [snapshots[index]],
      bodies = [];
    for (const [i, s] of selected.entries()) {
      const def = characters.CHARACTERS.find((c) => c.id === s.id),
        b = def.buildBody();
      b.def = def;
      b.snapshot = s;
      b.root.position.x = winner === 'draw' ? (i ? 1.8 : -1.8) : 0;
      scene.add(b.root);
      bodies.push(b);
    }
    const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.05, 100),
      bounds = new THREE.Box3();
    for (const b of bodies) {
      b.root.updateMatrixWorld(true);
      bounds.union(new THREE.Box3().setFromObject(b.root));
    }
    const center = bounds.getCenter(new THREE.Vector3()),
      size = bounds.getSize(new THREE.Vector3());
    const line =
      winner === 'draw'
        ? '不分胜负'
        : selectVictoryLine(snapshots[index].id, snapshots[1 - index].id, snapshots[index].form);
    match.victory = {
      winner,
      lastHitScene,
      lastHitCamera,
      lastHitBodies,
      snapshots,
      finished,
      scene,
      camera,
      bodies,
      center,
      size,
      time: 0,
      shown: false,
      line,
      duration: finished ? 4.5 : 1.4,
    };
    const subtitle = document.createElement('p');
    subtitle.id = 'victorySubtitle';
    subtitle.setAttribute('aria-live', 'polite');
    document.body.appendChild(subtitle);
    const skip = document.createElement('button');
    skip.id = 'skipVictory';
    skip.textContent = '跳过';
    skip.onclick = match.skipVictory;
    document.body.appendChild(skip);
    ui.el.hud.classList.remove('show');
    combat.cleanupYouthEntities();
    combat.cleanupAbilities();
    for (const f of [match.player, match.enemy]) {
      combat.endYouthForm(f, false);
      f.attack = null;
      f.vel.set(0, 0, 0);
    }
    render.clearUltimateVisuals();
    audio.finishBGM?.(winner);
    match.updateVictory(0);
  };
  match.skipVictory = function () {
    const v = match.victory;
    if (!v) return;
    v.time = v.duration;
    match.updateVictory(0);
  };
  function pose(b, t) {
    const p = animation.pz(),
      id = b.def.id,
      progress = Math.min(1, Math.max(0, (t - 0.85) / 1.15)),
      s = Math.sin((progress * Math.PI) / 2);
    p.eR = -0.5;
    p.eL = -0.5;
    if (id === 'goku') {
      if (b.parts.tail) b.parts.tail.visible = b.snapshot.tailIntact !== false;
      p.w = 1;
      p.aR = [-1.5, 0, 0.55];
      p.eR = -0.5;
      if (b.parts.staff) {
        b.parts.staff.rotation.set(0, 0, Math.PI / 2);
        b.parts.staff.position.set(0, -0.24, -0.12);
      }
      p.h = [0, -0.25 * s, 0];
      if (b.snapshot.form === 'ape') {
        p.aR = [-2, 0, -0.5];
        p.eR = -1.2;
      }
    }
    if (id === 'roshi') {
      p.aR = [-1.85, 0, -0.5];
      p.eR = -1.3;
      p.h = [-0.1, 0, 0];
    }
    if (id === 'taopaipai') {
      p.aR = [-0.8, 0, -0.7];
      p.aL = [-0.7, 0, 0.7];
      p.eR = -1;
      p.h = [0.1, -0.15, 0];
    }
    if (id === 'piccolo') {
      p.aR = [-0.7, 0, 0.65 * s];
      p.aL = [-0.7, 0, -0.65 * s];
      p.h = [0.15, 0, 0];
    }
    if (id === 'tien') {
      p.aR = [-1.25, 0, -0.65];
      p.aL = [-1.25, 0, 0.65];
      p.eR = p.eL = -0.8;
      p.t = [0.15 * s, 0, 0];
    }
    if (id === 'krillin') {
      p.aR = [-1.8, 0, -0.3];
      p.eR = -1.2;
      p.aL = [-0.7, 0, -0.4];
      p.h = [-0.1, 0, 0.1];
    }
    if (id === 'yamcha') {
      p.aR = [-2.3, 0, 0.2];
      p.eR = -1.3;
      p.h = [0, 0.3 * (1 - progress), 0];
    }
    if (id === 'gyumao') {
      p.aR = [-0.2, 0, 0.25];
      p.aL = [-0.6, 0, -0.6];
      p.eL = -1;
      p.h = [-0.1 * s, 0, 0];
      if (b.parts.axe) b.parts.axe.rotation.z = Math.PI;
    }
    if (id === 'chichi') {
      p.aR = [-0.35, 0, 0.7];
      p.aL = [-0.35, 0, -0.7];
      p.eR = p.eL = -1.3;
    }
    if (id === 'bulma') {
      if (b.parts.gun) b.parts.gun.visible = progress < 0.7;
      if (b.parts.bag) b.parts.bag.visible = false;
      p.aR = [-0.2, 0, 0.15];
      p.aL = [-0.8, 0, -0.4];
      p.eL = -1;
      p.t = [-0.04 * s, 0, 0];
    }
    if (id === 'chiaotzu') {
      p.aR = [-0.25, 0, 0.2];
      p.aL = [-0.25, 0, -0.2];
      p.y = 0.25 * (1 - progress);
    }
    if (id === 'oolong') {
      p.t = [-0.08 * s, 0, 0];
      p.h = [0, Math.sin(t * 5) * 0.15 * (1 - progress), 0];
      p.aR = [-0.3, 0, 0.3];
      p.aL = [-0.3, 0, -0.3];
    }
    if (id === 'korin') {
      p.aR = [-0.2, 0, 0.1];
      p.aL = [-1.6, 0, 0.3];
      p.eL = -1.1;
      p.h = [0.12, 0, 0];
    }
    if (id === 'pilaf') {
      p.aR = [-1.9 * s, 0, 0.1];
      p.eR = -0.5;
      const pilot = b.root.getObjectByName('pilaf-pilot');
      if (pilot) {
        pilot.position.y = -0.02 + 0.3 * s;
        pilot.position.z = 0.44 + 0.1 * s;
      }
      const hatch = b.parts.cockpit;
      if (hatch) hatch.rotation.x = -1.3 * s;
    }
    characters.applyPose(
      b.parts,
      animation.mixCombatPose(animation.youthStance(b.def), p, s),
      0,
      true,
    );
  }
  match.updateVictory = function (dt) {
    const v = match.victory;
    if (!v) return;
    v.time = Math.min(v.duration, v.time + dt);
    const impactDuration = v.finished ? 0.25 : 0.2;
    if (v.time < impactDuration) {
      for (const [i, root] of v.lastHitBodies.entries()) {
        const snap = v.snapshots[i];
        root.position.x += (snap?.velocity?.[0] ?? 0) * dt * 0.15;
        root.position.z += (snap?.velocity?.[2] ?? 0) * dt * 0.15;
        root.position.y += Math.max(0, snap?.velocityY ?? 0) * dt * 0.15;
      }
    }
    for (const b of v.bodies) pose(b, v.time);
    const box = new THREE.Box3();
    for (const b of v.bodies) {
      b.root.updateMatrixWorld(true);
      const bodyBox = new THREE.Box3().setFromObject(b.root);
      if (v.winner !== 'draw' && !['gyumao', 'korin', 'pilaf'].includes(b.def.id))
        bodyBox.min.y += bodyBox.getSize(new THREE.Vector3()).y * 0.38;
      box.union(bodyBox);
    }
    box.getSize(v.size);
    box.getCenter(v.center);
    v.camera.aspect = innerWidth / innerHeight;
    v.camera.updateProjectionMatrix();
    const fit =
      (Math.max(v.size.y, v.size.x / v.camera.aspect) * 1.2) /
      (2 * Math.tan(THREE.MathUtils.degToRad(v.camera.fov / 2)));
    const turn = Math.max(0, 1 - Math.max(0, v.time - 0.25) / 0.6) * 0.5;
    v.camera.position.set(
      v.center.x + Math.sin(turn) * fit,
      v.center.y + (v.bodies[0].def.id === 'piccolo' ? -0.18 : 0.1),
      v.center.z + Math.cos(turn) * fit,
    );
    v.camera.lookAt(v.center);
    document.getElementById('victorySubtitle').textContent =
      v.finished && v.time >= 2 ? v.line : v.winner === 'draw' ? '不分胜负' : '';
    if (v.time >= 0.85 && !v.shown) {
      v.shown = true;
      match.showResult(v.winner);
      document.getElementById('result').classList.add('victoryResult');
    }
    if (v.time >= v.duration) document.getElementById('skipVictory').hidden = true;
  };
  return function initialize() {
    match.victory = null;
    addEventListener('keydown', (e) => {
      if (['Enter', 'Space'].includes(e.code) && match.victory) {
        e.preventDefault();
        match.skipVictory();
      }
    });
    const start = match.startFight,
      back = match.backToMenu;
    match.startFight = function () {
      match.clearVictory();
      document.getElementById('result').classList.remove('victoryResult');
      start();
      audio.resetBGM?.();
    };
    match.backToMenu = function () {
      match.clearVictory();
      back();
      audio.resetBGM?.();
    };
  };
}
