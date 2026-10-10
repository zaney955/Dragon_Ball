import * as THREE from 'three';
export function register({
  art: artModule,
  characters: charactersModule,
  render: renderModule,
  world: worldModule,
}) {
  worldModule.clearMap = function clearMap() {
    if (worldModule.currentMap) {
      renderModule.scene.remove(worldModule.currentMap.group);
      worldModule.disposeGroup(worldModule.currentMap.group);
      for (let i = renderModule.effects.length - 1; i >= 0; i--) {
        const effect = renderModule.effects[i];
        if (!effect.stageEffect) continue;
        renderModule.scene.remove(effect.mesh);
        effect.mesh.geometry?.dispose();
        effect.mesh.material?.dispose();
        renderModule.effects.splice(i, 1);
      }
      worldModule.currentMap = null;
    }
  };
  worldModule.makeTextTexture = function makeTextTexture(text, opts = {}) {
    const w = opts.w || 1024,
      h = opts.h || 256;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = opts.bg || '#7a1a1a';
    ctx.fillRect(0, 0, w, h);
    if (!opts.plain) {
      ctx.strokeStyle = opts.border || '#ffd166';
      ctx.lineWidth = 14;
      ctx.strokeRect(7, 7, w - 14, h - 14);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      ctx.strokeRect(20, 20, w - 40, h - 40);
    }
    // 文字
    ctx.fillStyle = opts.fg || '#ffe8b8';
    ctx.font = `900 ${opts.fontSize || 130}px "PingFang SC","Microsoft YaHei",serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = opts.plain ? 0 : 12;
    ctx.fillText(text, w / 2, h / 2 + 6);
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  worldModule.worldClouds = function worldClouds(g) {
    const m = charactersModule.M(0xfff9ed);
    const clouds = [];
    for (let i = 0; i < 12; i++) {
      const c = new THREE.Group();
      for (let j = 0; j < 4; j++)
        charactersModule.ball(c, m, j * 2.3, Math.sin(j) * 0.6, 0, 2.5, [1.4, 0.65, 1]);
      artModule.batchDecoration(c);
      c.position.set(-70 + i * 12, 19 + (i % 3) * 3, -40 - (i % 4) * 12);
      g.add(c);
      clouds.push(c);
    }
    return (dt) => {
      for (const c of clouds) {
        c.position.x += dt * 0.35;
        if (c.position.x > 95) c.position.x = -95;
      }
    };
  };
  worldModule.roof = function roof(g, x, y, z, w, d, h, color = 0x8c5542) {
    const v = [
      -w / 2,
      0,
      d / 2,
      w / 2,
      0,
      d / 2,
      0,
      h,
      d / 2,
      -w / 2,
      0,
      -d / 2,
      w / 2,
      0,
      -d / 2,
      0,
      h,
      -d / 2,
    ];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    geo.setIndex([0, 1, 2, 3, 5, 4, 0, 2, 5, 0, 5, 3, 1, 4, 5, 1, 5, 2]);
    geo.computeVertexNormals();
    charactersModule.meshTo(
      g,
      geo,
      charactersModule.M(color, {
        side: THREE.DoubleSide,
      }),
      x,
      y,
      z,
    );
    for (let i = 0; i <= w; i += 0.55) {
      const xx = -w / 2 + i,
        yy = y + h * (1 - Math.abs(xx) / (w / 2));
      const line = charactersModule.meshTo(
        g,
        new THREE.CylinderGeometry(0.028, 0.028, d, 5),
        charactersModule.M(0x6f4233),
        x + xx,
        yy + 0.025,
        z,
      );
      line.rotation.x = Math.PI / 2;
    }
  };
  return function initialize() {
    worldModule.currentMap = null;
    worldModule.MAPS = [
      {
        id: 'budokai',
        name: '天下一武道会',
        desc: '露天石板擂台 · 经典大会会馆',
        m1: '#ead5a5',
        m2: '#a7593c',
      },
      {
        id: 'wild',
        name: '包子山荒野',
        desc: '圆顶石峰 · 少年悟空的冒险山野',
        m1: '#9db778',
        m2: '#73c0d3',
      },
      {
        id: 'kame',
        name: '龟仙屋',
        desc: '粉色小屋 · 椰树 · 碧蓝海岛',
        m1: '#efb1ae',
        m2: '#49b9cc',
      },
      {
        id: 'kami',
        name: '天神殿',
        desc: '云海浮空白石平台 · 多层金顶神殿',
        m1: '#eee9df',
        m2: '#78bff0',
      },
    ];
  };
}
