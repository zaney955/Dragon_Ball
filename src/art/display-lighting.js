import * as THREE from 'three';

export function addDisplayFloor(scene, bounds) {
  const size = bounds.getSize(new THREE.Vector3());
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(
      Math.max(size.x, size.z, size.y) * 5,
      Math.max(size.x, size.z, size.y) * 5,
    ),
    new THREE.ShadowMaterial({ opacity: 0.24 }),
  );
  floor.name = 'display-shadow-floor';
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.015;
  floor.receiveShadow = true;
  scene.add(floor);
  return floor;
}

export function configureDisplayShadows(renderer, light, bounds) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.map?.setSize(1024, 1024);
  const center = bounds.getCenter(new THREE.Vector3());
  const span = Math.max(bounds.getSize(new THREE.Vector3()).length() * 0.65, 2);
  light.target.position.copy(center);
  light.position.copy(center).add(new THREE.Vector3(-0.65, 1.2, 0.9).multiplyScalar(span * 2));
  Object.assign(light.shadow.camera, {
    left: -span,
    right: span,
    top: span,
    bottom: -span,
    near: 0.1,
    far: span * 7,
  });
  light.shadow.camera.updateProjectionMatrix();
  light.shadow.bias = -0.00015;
  light.shadow.normalBias = span * 0.006;
}

export function configureStageDisplayShadows(renderer, light) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  // Three r160 keeps an existing target when mapSize changes. Resize it as well
  // when switching between character and stage previews.
  light.shadow.map?.setSize(2048, 2048);
  light.position.set(-24, 40, 28);
  light.target.position.set(0, 3, -8);
  // Frame the arena, buildings and trees; distant clouds and the 650m ocean
  // would otherwise waste nearly all of the shadow map's resolution.
  Object.assign(light.shadow.camera, {
    left: -42,
    right: 42,
    top: 36,
    bottom: -36,
    near: 1,
    far: 140,
  });
  light.shadow.camera.updateProjectionMatrix();
  light.shadow.bias = -0.0002;
  light.shadow.normalBias = 0.035;
}
