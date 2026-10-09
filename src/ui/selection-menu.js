import * as THREE from 'three';
export function register({
  animation: animationModule,
  audio: audioModule,
  characters: charactersModule,
  match: matchModule,
  render: renderModule,
  ui: uiModule,
  world: worldModule,
}) {
  uiModule.portrait = function portrait(def) {
    const r = uiModule.portraitRenderer,
      sc = new THREE.Scene();
    sc.background = new THREE.Color(0xefe0be);
    sc.add(new THREE.HemisphereLight(0xffffff, 0xa69473, 1.0));
    const l = new THREE.DirectionalLight(0xffedcc, 2.0);
    l.position.set(-3, 5, 7);
    sc.add(l);
    const b = def.buildBody();
    b.root.rotation.y = -0.35;
    sc.add(b.root);
    const h = 2.6 * b.root.scale.x;
    const c = new THREE.PerspectiveCamera(33, 1, 0.1, 30);
    c.position.set(0, h * 0.57, h * 1.9);
    c.lookAt(0, h * 0.49, 0);
    charactersModule.applyPose(b.parts, animationModule.IDLE_POSE, 1, true);
    r.render(sc, c);
    const url = r.domElement.toDataURL();
    worldModule.disposeGroup(b.root);
    return url;
  };
  uiModule.buildMenu = function buildMenu() {
    uiModule.portraitRenderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    uiModule.portraitRenderer.setSize(480, 480);
    uiModule.portraitRenderer.setPixelRatio(1);
    uiModule.portraitRenderer.toneMapping = renderModule.renderer.toneMapping;
    uiModule.portraitRenderer.toneMappingExposure = renderModule.renderer.toneMappingExposure;
    const chars = document.getElementById('charList'),
      maps = document.getElementById('mapList');
    chars.innerHTML = '';
    maps.innerHTML = '';
    charactersModule.CHARACTERS.forEach((c, i) => {
      const d = document.createElement('button');
      d.className = 'card char-card' + (i === matchModule.game.selectedChar ? ' sel' : '');
      d.style.setProperty('--c1', matchModule.hex(c.color));
      d.setAttribute('aria-label', c.name + '，必杀 ' + c.ultName);
      d.setAttribute('aria-pressed', i === matchModule.game.selectedChar);
      d.innerHTML =
        '<img class="portrait" alt="' +
        c.name +
        '角色模型" src="' +
        uiModule.portrait(c) +
        '"><div class="cname">' +
        c.name +
        '</div>';
      d.onclick = () => {
        matchModule.game.selectedChar = i;
        [...chars.children].forEach((n, j) => {
          n.classList.toggle('sel', i === j);
          n.setAttribute('aria-pressed', i === j);
        });
        audioModule.initAudio();
      };
      chars.appendChild(d);
    });
    uiModule.portraitRenderer.dispose();
    uiModule.portraitRenderer = null;
    worldModule.MAPS.forEach((m, i) => {
      const d = document.createElement('button');
      d.className = 'card map-card' + (i === matchModule.game.selectedMap ? ' sel' : '');
      d.style.setProperty('--c1', '#c96738');
      d.setAttribute('aria-pressed', i === matchModule.game.selectedMap);
      const svg =
        i === 0
          ? '<rect x="18" y="53" width="164" height="20" fill="#e3d7b7"/><rect x="40" y="28" width="120" height="27" fill="#edcc95"/><path d="M28 31L100 5L172 31Z" fill="#9c684b"/><rect x="60" y="25" width="80" height="14" fill="#fff1c8"/>'
          : i === 1
            ? '<path d="M0 75V60Q25 45 48 62Q120 40 200 65V75Z" fill="#87a16b"/><path d="M30 63V21Q45 3 60 21V63M85 65V32Q110 6 132 32V65M145 65V15Q165 -4 180 15V65" fill="#b4a276"/>'
            : '<ellipse cx="100" cy="68" rx="87" ry="11" fill="#eed5a6"/><rect x="69" y="28" width="61" height="38" fill="#efb1ae"/><path d="M60 29L99 8L138 29Z" fill="#b9614e"/><rect x="92" y="45" width="13" height="20" fill="#866754"/><path d="M43 61L48 17M150 61L157 12" stroke="#9b7051" stroke-width="4"/><path d="M30 15Q48 1 65 18M139 12Q157 -2 175 16" fill="none" stroke="#4f8960" stroke-width="8"/>';
      d.innerHTML =
        '<svg class="map-thumb" viewBox="0 0 200 80" aria-hidden="true" style="background:' +
        m.m2 +
        '">' +
        svg +
        '</svg><div class="map-info"><div class="mname">' +
        m.name +
        '</div><div class="mdesc">' +
        ['石板擂台', '圆顶石峰', '海岛小屋'][i] +
        '</div></div>';
      d.onclick = () => {
        matchModule.game.selectedMap = i;
        [...maps.children].forEach((n, j) => {
          n.classList.toggle('sel', i === j);
          n.setAttribute('aria-pressed', i === j);
        });
        matchModule.previewMap(i);
        uiModule.updateSelection();
      };
      maps.appendChild(d);
    });
    const cpu = document.getElementById('opponent');
    charactersModule.CHARACTERS.forEach((c, i) => {
      const op = document.createElement('option');
      op.value = i;
      op.textContent = c.name;
      cpu.appendChild(op);
    });
  };
  return function initialize() {
    uiModule.portraitRenderer = null;
  };
}
