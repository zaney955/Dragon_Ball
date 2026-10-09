import * as THREE from 'three';
export function register({ characters: charactersModule }) {
  charactersModule.M = function M(color, o = {}) {
    return new THREE.MeshToonMaterial({
      color,
      gradientMap: charactersModule.toonRamp,
      side: o.side ?? THREE.FrontSide,
      transparent: o.transparent ?? false,
      opacity: o.opacity ?? 1,
      emissive: o.emissive ?? 0,
      emissiveIntensity: o.ei ?? 0,
    });
  };
  charactersModule.meshTo = function meshTo(g, geo, mat, x = 0, y = 0, z = 0, s = null) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (s) m.scale.set(...s);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  charactersModule.ball = function ball(g, m, x, y, z, r, s = null) {
    return charactersModule.meshTo(g, new THREE.SphereGeometry(r, 18, 12), m, x, y, z, s);
  };
  charactersModule.box = function box(g, m, x, y, z, w, h, d) {
    return charactersModule.meshTo(g, new THREE.BoxGeometry(w, h, d), m, x, y, z);
  };
  charactersModule.tube = function tube(g, m, pts, r = 0.035) {
    return charactersModule.meshTo(
      g,
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))),
        24,
        r,
        7,
        false,
      ),
      m,
    );
  };
  charactersModule.badge = function badge(
    g,
    text,
    x,
    y,
    z,
    r,
    back = false,
    bg = '#fffaf0',
    fg = '#16171c',
  ) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const k = c.getContext('2d');
    k.fillStyle = bg;
    k.beginPath();
    k.arc(128, 128, 116, 0, 7);
    k.fill();
    k.strokeStyle = fg;
    k.lineWidth = 10;
    k.stroke();
    k.fillStyle = fg;
    k.font = 'bold 164px "Microsoft YaHei",serif';
    k.textAlign = 'center';
    k.textBaseline = 'middle';
    k.fillText(text, 128, 135);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const m = charactersModule.meshTo(
      g,
      new THREE.PlaneGeometry(r * 2, r * 2),
      new THREE.MeshBasicMaterial({
        map: t,
        transparent: true,
        side: THREE.DoubleSide,
      }),
      x,
      y,
      z,
    );
    if (back) m.rotation.y = Math.PI;
  };
  return function initialize() {
    charactersModule.toonRamp = (() => {
      const t = new THREE.DataTexture(new Uint8Array([85, 165, 230, 255]), 4, 1, THREE.RedFormat);
      t.needsUpdate = true;
      t.magFilter = t.minFilter = THREE.NearestFilter;
      return t;
    })();
  };
}
