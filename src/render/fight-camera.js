import { INPUT_LABELS } from '../ui/character-help.js';
import { updateHealthGauge } from '../ui/health-gauge.js';
import * as THREE from 'three';
export function cameraObstacle(mesh) {
  if (!mesh.isMesh || mesh.userData.cameraBlocker === false) return false;
  if (mesh.userData.cameraBlocker === true) return true;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  if (!materials.some((m) => m && m.visible !== false && (m.opacity ?? 1) >= 0.95)) return false;
  mesh.geometry.computeBoundingBox();
  const size = mesh.geometry.boundingBox
    .clone()
    .applyMatrix4(mesh.matrixWorld)
    .getSize(new THREE.Vector3());
  return size.y >= 1.3 && Math.max(size.x, size.z) >= 0.4;
}
function visibleObstacle(mesh) {
  for (let node = mesh; node; node = node.parent) {
    if (!node.visible) return false;
    if (node.isScene) return true;
  }
  return false;
}
export function register({
  match: matchModule,
  render: renderModule,
  training: trainingModule,
  ui: uiModule,
  world: worldModule,
}) {
  const obstacleBounds = new WeakMap(),
    hitPoint = new THREE.Vector3();
  function nearestCameraHit(raycaster) {
    const map = worldModule.currentMap;
    if (map?.playArea) {
      const to = raycaster.ray.at(raycaster.far, new THREE.Vector3());
      const hit = worldModule.stageCameraHit(raycaster.ray.origin, to);
      let distance = hit?.distance ?? Infinity;
      for (const mesh of renderModule.cameraObstacles) {
        let belongs = false;
        for (let node = mesh; node; node = node.parent)
          if (node === map.group) {
            belongs = true;
            break;
          }
        if (belongs || !visibleObstacle(mesh)) continue;
        const bounds = new THREE.Box3().setFromObject(mesh);
        if (raycaster.ray.intersectBox(bounds, hitPoint))
          distance = Math.min(distance, hitPoint.distanceTo(raycaster.ray.origin));
      }
      return distance <= raycaster.far ? { distance } : null;
    }
    const hits = [];
    for (const mesh of renderModule.cameraObstacles) {
      const bounds = obstacleBounds.get(mesh);
      // THREE's mesh sphere test uses an infinite ray. Reject scenery beyond the
      // actual shoulder segment before visiting any triangles in a merged bucket.
      if (bounds && !bounds.containsPoint(raycaster.ray.origin)) {
        if (!raycaster.ray.intersectBox(bounds, hitPoint)) continue;
        if (hitPoint.distanceToSquared(raycaster.ray.origin) > raycaster.far ** 2) continue;
      }
      mesh.raycast(raycaster, hits);
    }
    return hits.reduce(
      (nearest, hit) => (!nearest || hit.distance < nearest.distance ? hit : nearest),
      null,
    );
  }
  renderModule.resetShoulderCameras = function resetShoulderCameras() {
    renderModule.cameraObstacles.length = 0;
    renderModule.scene.updateMatrixWorld(true);
    if (!worldModule.currentMap?.playArea)
      worldModule.currentMap?.group.traverse((o) => {
        if (cameraObstacle(o)) {
          renderModule.cameraObstacles.push(o);
          if (o.isInstancedMesh) o.computeBoundingBox();
          else o.geometry.computeBoundingBox();
          const bounds = o.isInstancedMesh ? o.boundingBox : o.geometry.boundingBox;
          obstacleBounds.set(o, bounds.clone().applyMatrix4(o.matrixWorld));
        }
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
    const position = (f.onlineVisualPosition ?? f.pos).clone(),
      foePosition = (foe.onlineVisualPosition ?? foe.pos).clone();
    position.y += worldModule.groundHeight?.(position.x, position.z) ?? 0;
    foePosition.y += worldModule.groundHeight?.(foePosition.x, foePosition.z) ?? 0;
    const delta = foePosition.clone().sub(position),
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
    const stature = (fighter) =>
      ((fighter.parts.anatomy?.hip ?? 1) + (fighter.parts.anatomy?.neck ?? 0.65)) *
      fighter.baseScale;
    const ownHeight = stature(f),
      foeHeight = stature(foe);
    const split = matchModule.game.difficulty === 'local' && !matchModule.game.online,
      back = (split ? 4.9 : 4.8) + Math.min(4, dist * 0.12 + Math.abs(delta.y) * 0.2),
      shoulder =
        (split ? 1.3 : 1.45) +
        Math.max(0, 1 - dist / 5) * 2 +
        Math.max(0, f.baseScale - 1) * 0.3 +
        Math.max(0, ownHeight - foeHeight) * 2.8 * Math.max(0, 1 - dist / 4);
    const origin = position.clone().add(new THREE.Vector3(0, 1.65 * f.baseScale, 0));
    const desired = position.clone().addScaledVector(front, -back).addScaledVector(right, shoulder);
    desired.y += 2.65 + Math.max(0, f.baseScale - 1) * 1.6 + Math.min(2, Math.abs(delta.y) * 0.3);
    const dir = desired.clone().sub(origin);
    let length = dir.length();
    renderModule.cameraRay.set(origin, dir.normalize());
    renderModule.cameraRay.far = length;
    let hit = nearestCameraHit(renderModule.cameraRay);
    if (hit && hit.distance < 2.5) {
      let bestClearance = hit.distance;
      for (const side of [-1, 1]) {
        const alternative = position
          .clone()
          .addScaledVector(front, -back)
          .addScaledVector(right, side * 3);
        alternative.y = desired.y + 1.2;
        const direction = alternative.clone().sub(origin),
          distance = direction.length();
        renderModule.cameraRay.set(origin, direction.normalize());
        renderModule.cameraRay.far = distance;
        const obstacle = nearestCameraHit(renderModule.cameraRay),
          clearance = obstacle?.distance ?? distance;
        if (clearance > bestClearance + 0.2) {
          desired.copy(alternative);
          hit = obstacle;
          bestClearance = clearance;
        }
      }
      dir.copy(desired).sub(origin);
      length = dir.length();
      dir.normalize();
    }
    if (hit && hit.distance < length) {
      desired.copy(origin).addScaledVector(dir, Math.max(0.35, hit.distance - 0.3));
      desired.y = Math.max(desired.y, 0.45);
    }
    const desiredTarget = position
      .clone()
      .addScaledVector(delta.clone().setY(0), Math.min(0.5, 5.5 / Math.max(0.1, dist)))
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
    const finalHit = nearestCameraHit(renderModule.cameraRay);
    if (finalHit && finalHit.distance < finalLength) {
      s.position.copy(origin).addScaledVector(finalDir, Math.max(0.35, finalHit.distance - 0.25));
      s.position.y = Math.max(0.4, s.position.y);
    }
    cam.aspect = innerWidth / (innerHeight / (split ? 2 : 1));
    // A narrow portrait frustum clipped back counters and airborne landings.
    // Widen the lens while preserving the shoulder position and bounded yaw.
    cam.fov = Math.min(
      85,
      (split ? 58 : 55) + Math.max(0, 1 - cam.aspect) * 55 + Math.min(8, Math.abs(delta.y) * 1.5),
    );
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
    renderModule.cameraObstacles = renderModule.cameraObstacles.filter(visibleObstacle);
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
      !matchModule.victory &&
      matchModule.game.difficulty === 'local' &&
      !matchModule.game.online &&
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
      const v = matchModule.victory,
        last = v && v.time < (v.finished ? 0.25 : 0.2);
      renderModule.renderer.render(
        last ? v.lastHitScene : (v?.scene ?? renderModule.scene),
        last ? v.lastHitCamera : (v?.camera ?? renderModule.camera),
      );
    }
    renderModule.updateViewHUD(split);
  };
  renderModule.updateViewHUD = function updateViewHUD(split) {
    document.getElementById('splitOverlay').hidden = !split;
    document.getElementById('singleTarget').hidden =
      split ||
      !!matchModule.game.spectating ||
      !!matchModule.victory ||
      matchModule.game.screen === 'menu' ||
      !matchModule.enemy;
    if (!matchModule.player || !matchModule.enemy) return;
    if (split) {
      for (const [own, foe, prefix, cam] of [
        [matchModule.player, matchModule.enemy, 'view1', renderModule.camera],
        [matchModule.enemy, matchModule.player, 'view2', renderModule.camera2],
      ]) {
        document.getElementById(prefix + 'Name').textContent = own.def.name;
        updateHealthGauge(
          own,
          document.getElementById(prefix + 'HP'),
          document.getElementById(prefix + 'Reserve'),
        );
        document.getElementById(prefix + 'Ki').style.width = own.ki + '%';
        uiModule.updateDefenseHUD(own, prefix);
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
          '  能量 ' +
          Math.floor(own.ki) +
          '  残像 ' +
          own.escapeCharges +
          '\n' +
          uiModule.fighterStatus(
            own,
            own === matchModule.enemy ? INPUT_LABELS.two : INPUT_LABELS.one,
          ) +
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
