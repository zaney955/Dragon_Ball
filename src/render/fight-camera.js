import * as THREE from 'three';
export function register({
  match: matchModule,
  render: renderModule,
  training: trainingModule,
  ui: uiModule,
  world: worldModule,
}) {
  renderModule.resetShoulderCameras = function resetShoulderCameras() {
    renderModule.cameraObstacles.length = 0;
    worldModule.currentMap?.group.traverse((o) => {
      const p = o.geometry?.parameters;
      if (
        o.isMesh &&
        o.geometry.type === 'BoxGeometry' &&
        p.height >= 1.3 &&
        p.width >= 0.4 &&
        !o.material.transparent
      )
        renderModule.cameraObstacles.push(o);
    });
    renderModule.scene.updateMatrixWorld(true);
    for (let i = 0; i < 2; i++) {
      const f = i ? matchModule.enemy : matchModule.player,
        s = renderModule.shoulderStates[i];
      s.initialized = false;
      s.yaw = f?.facingAngle ?? 0;
    }
    renderModule.updateFightCamera(1, true);
  };
  function updateShoulderView(cam, f, foe, s, dt, snap = false) {
    const delta = foe.pos.clone().sub(f.pos),
      dist = Math.hypot(delta.x, delta.z),
      wanted = dist > 0.2 ? Math.atan2(delta.x, delta.z) : f.facingAngle;
    s.yaw += snap
      ? renderModule.angleDelta(wanted, s.yaw)
      : THREE.MathUtils.clamp(
          renderModule.angleDelta(wanted, s.yaw) * (1 - Math.exp(-(dist < 1 ? 7 : 6) * dt)),
          -dt * 4.5,
          dt * 4.5,
        );
    const front = new THREE.Vector3(Math.sin(s.yaw), 0, Math.cos(s.yaw)),
      right = new THREE.Vector3(-front.z, 0, front.x);
    const split = matchModule.game.difficulty === 'local' && !matchModule.game.online,
      back = (split ? 4.9 : 4.8) + Math.min(1.8, dist * 0.07 + Math.abs(delta.y) * 0.2),
      shoulder =
        (split ? 1.3 : 1.45) + Math.max(0, 1 - dist / 5) * 2 + Math.max(0, f.baseScale - 1) * 0.3;
    const origin = f.pos.clone().add(new THREE.Vector3(0, 1.65 * f.baseScale, 0));
    const desired = f.pos.clone().addScaledVector(front, -back).addScaledVector(right, shoulder);
    desired.y += 2.65 + Math.max(0, f.baseScale - 1) * 1.6 + Math.min(2, Math.abs(delta.y) * 0.3);
    const dir = desired.clone().sub(origin),
      length = dir.length();
    renderModule.cameraRay.set(origin, dir.normalize());
    renderModule.cameraRay.far = length;
    const hit = renderModule.cameraRay.intersectObjects(renderModule.cameraObstacles, false)[0];
    if (hit && hit.distance < length) {
      desired.copy(origin).addScaledVector(dir, Math.max(0.35, hit.distance - 0.3));
      desired.y = Math.max(desired.y, 0.45);
    }
    const desiredTarget = f.pos
      .clone()
      .addScaledVector(front, Math.min(5.5, Math.max(1.1, dist * 0.43)))
      .addScaledVector(right, 0);
    desiredTarget.y +=
      Math.max(1.15, foe.baseScale * 1.2) + THREE.MathUtils.clamp(delta.y * 0.45, -0.8, 2.8);
    if (!s.initialized || snap) {
      s.position.copy(desired);
      s.target.copy(desiredTarget);
      s.initialized = true;
    } else {
      s.position.lerp(desired, 1 - Math.exp(-11 * dt));
      s.target.lerp(desiredTarget, 1 - Math.exp(-12 * dt));
    }
    const finalDir = s.position.clone().sub(origin),
      finalLength = finalDir.length();
    renderModule.cameraRay.set(origin, finalDir.normalize());
    renderModule.cameraRay.far = finalLength;
    const finalHit = renderModule.cameraRay.intersectObjects(
      renderModule.cameraObstacles,
      false,
    )[0];
    if (finalHit && finalHit.distance < finalLength) {
      s.position.copy(origin).addScaledVector(finalDir, Math.max(0.35, finalHit.distance - 0.25));
      s.position.y = Math.max(0.4, s.position.y);
    }
    cam.aspect = innerWidth / (innerHeight / (split ? 2 : 1));
    cam.fov = (split ? 58 : 55) + Math.min(8, Math.abs(delta.y) * 1.5);
    cam.updateProjectionMatrix();
    cam.position.copy(s.position);
    cam.lookAt(s.target);
    if (!matchModule.game.reducedShake && matchModule.game.shake > 0.001) {
      const t = performance.now() * 0.044;
      cam.position.x += Math.sin(t) * matchModule.game.shake * 0.65;
      cam.position.y += Math.cos(t * 1.17) * matchModule.game.shake * 0.4;
    }
  }
  renderModule.updateFightCamera = function updateFightCamera(dt, snap = false) {
    if (!matchModule.player || !matchModule.enemy) return;
    updateShoulderView(
      renderModule.camera,
      matchModule.game.onlineSeat === 1 && matchModule.game.online
        ? matchModule.enemy
        : matchModule.player,
      matchModule.game.onlineSeat === 1 && matchModule.game.online
        ? matchModule.player
        : matchModule.enemy,
      renderModule.shoulderStates[0],
      dt,
      snap,
    );
    if (matchModule.game.difficulty === 'local' && !matchModule.game.online)
      updateShoulderView(
        renderModule.camera2,
        matchModule.enemy,
        matchModule.player,
        renderModule.shoulderStates[1],
        dt,
        snap,
      );
    matchModule.game.shake *= Math.exp(-19 * dt);
    matchModule.game.cameraImpulse *= Math.exp(-10 * dt);
  };
  renderModule.renderGameViews = function renderGameViews() {
    const split =
      !matchModule.game.online &&
      matchModule.game.difficulty === 'local' &&
      matchModule.game.screen !== 'menu' &&
      !!matchModule.player &&
      !!matchModule.enemy;
    document.body.classList.toggle('splitMode', split);
    const W = innerWidth,
      H = innerHeight;
    renderModule.renderer.setScissorTest(split);
    renderModule.renderer.setViewport(0, 0, W, H);
    renderModule.renderer.setScissor(0, 0, W, H);
    renderModule.renderer.clear();
    if (split) {
      const top = Math.ceil(H / 2),
        bottom = H - top;
      renderModule.renderer.setViewport(0, bottom, W, top);
      renderModule.renderer.setScissor(0, bottom, W, top);
      renderModule.renderer.render(renderModule.scene, renderModule.camera);
      renderModule.renderer.setViewport(0, 0, W, bottom);
      renderModule.renderer.setScissor(0, 0, W, bottom);
      const shadowUpdate = renderModule.renderer.shadowMap.autoUpdate;
      renderModule.renderer.shadowMap.autoUpdate = false;
      try {
        renderModule.renderer.render(renderModule.scene, renderModule.camera2);
      } finally {
        renderModule.renderer.shadowMap.autoUpdate = shadowUpdate;
      }
      renderModule.renderer.setScissorTest(false);
      renderModule.renderer.setViewport(0, 0, W, H);
    } else {
      if (matchModule.game.screen === 'menu') {
        renderModule.camera.aspect = W / H;
        renderModule.camera.updateProjectionMatrix();
      }
      renderModule.renderer.render(renderModule.scene, renderModule.camera);
    }
    renderModule.updateViewHUD(split);
  };
  renderModule.updateViewHUD = function updateViewHUD(split) {
    document.getElementById('splitOverlay').hidden = !split;
    document.getElementById('singleTarget').hidden =
      split || matchModule.game.screen === 'menu' || !matchModule.enemy;
    if (!matchModule.player || !matchModule.enemy) return;
    if (split) {
      for (const [own, foe, prefix, cam] of [
        [matchModule.player, matchModule.enemy, 'view1', renderModule.camera],
        [matchModule.enemy, matchModule.player, 'view2', renderModule.camera2],
      ]) {
        document.getElementById(prefix + 'Name').textContent = own.def.name;
        document.getElementById(prefix + 'HP').style.width = (own.hp / own.maxHp) * 100 + '%';
        document.getElementById(prefix + 'Ki').style.width = own.ki + '%';
        document
          .getElementById(prefix + 'Ki')
          .parentElement.classList.toggle(
            'charging',
            own.state === 'charge' && !matchModule.game.paused,
          );
        document
          .getElementById(prefix + 'Ki')
          .parentElement.classList.toggle('insufficient', (own.kiWarning ?? 0) > 0);
        document.getElementById(prefix + 'Stats').textContent =
          Math.ceil(own.hp) +
          ' / ' +
          own.maxHp +
          '  气 ' +
          Math.floor(own.ki) +
          '  残像 ' +
          own.escapeCharges +
          '\n' +
          uiModule.fighterStatus(own) +
          ' · ' +
          uiModule.specialAvailability(own) +
          '\n仙豆 ' +
          trainingModule.senzuHint(
            own,
            renderModule.shoulderStates[own === matchModule.enemy ? 1 : 0],
          );
        document.getElementById(prefix + 'Enemy').textContent =
          foe.def.name + '  ' + Math.ceil(foe.hp);
        positionTarget(document.getElementById(prefix + 'Target'), foe, cam, innerHeight / 2);
      }
      document.getElementById('splitClock').textContent = Math.ceil(matchModule.game.timeLeft);
    } else
      positionTarget(
        document.getElementById('singleTarget'),
        matchModule.enemy,
        renderModule.camera,
        innerHeight,
      );
  };
  function positionTarget(el, foe, cam, height) {
    const point = foe.pos
      .clone()
      .add(new THREE.Vector3(0, 1.35 * foe.baseScale, 0))
      .project(cam);
    const visible =
      point.z >= -1 && point.z <= 1 && Math.abs(point.x) < 0.94 && Math.abs(point.y) < 0.88;
    el.style.display = 'block';
    el.textContent = visible ? '' : '↻';
    el.style.left = (THREE.MathUtils.clamp(point.x, -0.9, 0.9) * 0.5 + 0.5) * innerWidth + 'px';
    el.style.top = (-0.5 * THREE.MathUtils.clamp(point.y, -0.82, 0.82) + 0.5) * height + 'px';
  }
  return function initialize() {
    renderModule.camera2 = new THREE.PerspectiveCamera(
      55,
      innerWidth / (innerHeight / 2),
      0.12,
      220,
    );
    renderModule.shoulderStates = [
      {
        yaw: Math.PI / 2,
        position: new THREE.Vector3(),
        target: new THREE.Vector3(),
        initialized: false,
      },
      {
        yaw: -Math.PI / 2,
        position: new THREE.Vector3(),
        target: new THREE.Vector3(),
        initialized: false,
      },
    ];
    renderModule.cameraRay = new THREE.Raycaster();
    renderModule.cameraObstacles = [];
  };
}
