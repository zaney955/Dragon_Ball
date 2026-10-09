import * as THREE from 'three';
export function register({ render: renderModule }) {
  return function initialize() {
    renderModule.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderModule.renderer.setSize(innerWidth, innerHeight);
    renderModule.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
    renderModule.renderer.shadowMap.enabled = true;
    renderModule.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderModule.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderModule.renderer.toneMappingExposure = 0.86;
    document.getElementById('game').appendChild(renderModule.renderer.domElement);
    renderModule.scene = new THREE.Scene();
    renderModule.camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 700);
    renderModule.clock = new THREE.Clock();
    renderModule.hemi = new THREE.HemisphereLight(0xbcd8ff, 0x2a2438, 0.6);
    renderModule.scene.add(renderModule.hemi);
    renderModule.sun = new THREE.DirectionalLight(0xffffff, 1.5);
    renderModule.sun.position.set(9, 22, 14);
    renderModule.sun.castShadow = true;
    renderModule.sun.shadow.mapSize.set(1024, 1024);
    renderModule.sun.shadow.camera.left = -30;
    renderModule.sun.shadow.camera.right = 30;
    renderModule.sun.shadow.camera.top = 30;
    renderModule.sun.shadow.camera.bottom = -30;
    renderModule.sun.shadow.camera.near = 1;
    renderModule.sun.shadow.camera.far = 90;
    renderModule.sun.shadow.bias = -0.0012;
    renderModule.scene.add(renderModule.sun);
    renderModule.rim = new THREE.DirectionalLight(0x6fa8ff, 0.55);
    renderModule.rim.position.set(-14, 9, -16);
    renderModule.scene.add(renderModule.rim);
    addEventListener('resize', () => {
      renderModule.camera.aspect = innerWidth / innerHeight;
      renderModule.camera.updateProjectionMatrix();
      renderModule.renderer.setSize(innerWidth, innerHeight);
    });
  };
}
