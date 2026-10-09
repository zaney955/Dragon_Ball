import * as THREE from 'three';
export function register({
  combat: combatModule,
  match: matchModule,
  render: renderModule,
  world: worldModule,
}) {
  worldModule.daylight = function daylight(sky = 0x88ceef) {
    const moon = matchModule.game?.lightPreset === 'moon';
    const warm = matchModule.game?.lightPreset === 'sunset';
    renderModule.scene.background = moon
      ? new THREE.Color(0x17253d)
      : warm
        ? worldModule.warmSkyBackdrop
        : combatModule.skyBackdrop;
    renderModule.scene.fog = new THREE.Fog(moon ? 0x293951 : warm ? 0xe4b883 : 0xb7d6d1, 46, 160);
    renderModule.hemi.color.set(warm ? 0xffd9a4 : 0xddeef4);
    renderModule.hemi.groundColor.set(0x526450);
    renderModule.hemi.intensity = moon ? 0.65 : warm ? 0.7 : 0.85;
    if (worldModule.moon) worldModule.moon.visible = moon;
    renderModule.sun.color.set(warm ? 0xffbd76 : 0xffedcb);
    renderModule.sun.intensity = moon ? 0.85 : warm ? 2.4 : 2.15;
    if (moon) renderModule.sun.color.set(0xc1d9ff);
    renderModule.sun.position.set(warm ? -18 : -12, warm ? 14 : 23, 12);
    renderModule.rim.color.set(warm ? 0x9bb8cd : 0xb3dcff);
    renderModule.rim.intensity = 0.75;
    renderModule.sun.shadow.mapSize.set(2048, 2048);
    renderModule.sun.shadow.bias = -0.00025;
    renderModule.sun.shadow.normalBias = 0.032;
    renderModule.sun.shadow.radius = 2.5;
    renderModule.sun.shadow.camera.left = -24;
    renderModule.sun.shadow.camera.right = 24;
    renderModule.sun.shadow.camera.top = 20;
    renderModule.sun.shadow.camera.bottom = -20;
  };
  worldModule.surfaceTexture = function surfaceTexture(kind) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const k = c.getContext('2d');
    k.fillStyle = kind === 'normal' ? '#8080ff' : '#f4efdf';
    k.fillRect(0, 0, 256, 256);
    let seed = 34;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < (kind === 'normal' ? 160 : 950); i++) {
      const x = rnd() * 256,
        y = rnd() * 256;
      if (kind === 'normal') {
        k.strokeStyle = 'rgba(100,170,235,.28)';
        k.lineWidth = 2;
        k.beginPath();
        k.moveTo(x - 20, y);
        k.quadraticCurveTo(x, y - 4, x + 30, y);
        k.stroke();
      } else {
        k.fillStyle = rnd() > 0.5 ? 'rgba(71,61,43,.06)' : 'rgba(255,255,255,.14)';
        k.fillRect(x, y, 1 + rnd() * 3, 1 + rnd() * 3);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(kind === 'normal' ? 45 : 1, kind === 'normal' ? 45 : 1);
    if (kind !== 'normal') t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return function initialize() {
    worldModule.moon = new THREE.Mesh(
      new THREE.SphereGeometry(2.7, 24, 18),
      new THREE.MeshBasicMaterial({ color: 0xfff1c3 }),
    );
    worldModule.moon.position.set(-25, 27, -48);
    worldModule.moon.visible = false;
    renderModule.scene.add(worldModule.moon);
    worldModule.warmSkyBackdrop = (() => {
      const c = document.createElement('canvas');
      c.width = 8;
      c.height = 512;
      const k = c.getContext('2d'),
        g = k.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, '#5d95b4');
      g.addColorStop(0.52, '#e5c7a0');
      g.addColorStop(1, '#f4dfa9');
      k.fillStyle = g;
      k.fillRect(0, 0, 8, 512);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    Object.assign(matchModule.game, {
      lightPreset: 'day',
    });
    document.getElementById('lighting').onchange = (e) => {
      matchModule.game.lightPreset = e.target.value;
      worldModule.daylight();
    };
  };
}
