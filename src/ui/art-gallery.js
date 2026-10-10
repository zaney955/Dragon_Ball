import * as THREE from 'three';
import { applyDisplayPose } from '../art/display-poses.js';
import {
  addDisplayFloor,
  configureDisplayShadows,
  configureStageDisplayShadows,
} from '../art/display-lighting.js';
export function register({
  art: artModule,
  characters: charactersModule,
  match: matchModule,
  render: renderModule,
  ui: uiModule,
  world: worldModule,
}) {
  let originalMenuBuild, artDialog, artOpen, artView, artPreviousFocus, artHost, artPointer;
  uiModule.fitArtCamera = function fitArtCamera(reset = false) {
    if (!artView) return;
    const v = artView,
      rect = v.host.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    v.r.setSize(rect.width, rect.height, false);
    v.cam.aspect = rect.width / rect.height;
    v.cam.updateProjectionMatrix();
    if (v.characterSize) {
      const zoom = v.distance ? v.distance / v.baseDistance : 1;
      const size = v.characterSize;
      v.baseDistance = Math.max(size.y, (size.x + size.z * 0.4) / v.cam.aspect) * 2.1;
      v.distance = v.baseDistance * zoom;
    }
    if (reset) {
      v.yaw = v.isStage ? 0.65 : -0.35;
      v.pitch = v.isStage ? 0.46 : 0.12;
      v.distance = v.baseDistance;
    }
    const cp = Math.cos(v.pitch);
    v.cam.position.set(
      v.center.x + Math.sin(v.yaw) * cp * v.distance,
      v.center.y + Math.sin(v.pitch) * v.distance,
      v.center.z + Math.cos(v.yaw) * cp * v.distance,
    );
    v.cam.lookAt(v.center);
    v.r.render(v.sc, v.cam);
  };
  uiModule.loadArtAsset = function loadArtAsset() {
    if (!artView) return;
    const v = artView;
    if (v.model) {
      v.sc.remove(v.model);
      worldModule.disposeGroup(v.model);
    }
    if (v.floor) {
      v.sc.remove(v.floor);
      worldModule.disposeGroup(v.floor);
      v.floor = null;
    }
    const [kind, key] = uiModule.assetSelect.value.split(':'),
      index = Number(key);
    v.isStage = kind === 'stage';
    v.characterSize = null;
    if (v.isStage) {
      const map = worldModule.MAPS[index].build();
      v.model = map.group;
      v.center.set(0, 2, -6);
      v.baseDistance = map.preview?.distance ?? (index === 1 ? 65 : 47);
      if (map.preview) v.center.fromArray(map.preview.center);
      document.getElementById('artType').textContent = '对战舞台';
      document.getElementById('artName').textContent = worldModule.MAPS[index].name;
      document.getElementById('artNote').textContent = worldModule.MAPS[index].desc;
    } else {
      const def = charactersModule.CHARACTERS[index],
        body = def.buildBody();
      v.model = body.root;
      const pose = applyDisplayPose(body, def.id, charactersModule);
      const bounds = new THREE.Box3().setFromObject(body.root),
        size = bounds.getSize(new THREE.Vector3());
      bounds.getCenter(v.center);
      v.baseDistance = Math.max(size.y * 2.1, size.x * 2.4);
      v.characterSize = size;
      v.floor = addDisplayFloor(v.sc, bounds);
      document.getElementById('artType').textContent = artModule.ART_PROFILES[def.id].label;
      document.getElementById('artName').textContent = def.name;
      document.getElementById('artNote').textContent = artModule.ART_PROFILES[def.id].note;
      document.getElementById('artPose').textContent = pose.name;
    }
    if (v.isStage) document.getElementById('artPose').textContent = '';
    v.sc.add(v.model);
    v.hemi.intensity = v.isStage ? 1.2 : 1.8;
    v.fill.intensity = v.isStage ? 0.55 : 1;
    v.fill.position.set(v.isStage ? 24 : 5, v.isStage ? 14 : 4, v.isStage ? -30 : -6);
    if (v.isStage) configureStageDisplayShadows(v.r, v.key);
    else configureDisplayShadows(v.r, v.key, new THREE.Box3().setFromObject(v.model));
    uiModule.fitArtCamera(true);
  };
  function openArtGallery() {
    if (artView) return;
    artPreviousFocus = document.activeElement;
    artDialog.classList.add('show');
    document.getElementById('menu').inert = true;
    const host = artDialog.querySelector('.artViewport'),
      r = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
      });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    r.toneMapping = renderModule.renderer.toneMapping;
    r.toneMappingExposure = 0.95;
    host.prepend(r.domElement);
    const sc = new THREE.Scene();
    sc.background = new THREE.Color(0xf3e4c2);
    const hemi = new THREE.HemisphereLight(0xfff8e8, 0x65736a, 1.8);
    sc.add(hemi);
    const key = new THREE.DirectionalLight(0xffe8c6, 2.5);
    key.position.set(-4, 8, 6);
    sc.add(key);
    sc.add(key.target);
    const fill = new THREE.DirectionalLight(0xbadbe9, 1);
    fill.position.set(5, 4, -6);
    sc.add(fill);
    artView = {
      host,
      r,
      sc,
      key,
      hemi,
      fill,
      floor: null,
      cam: new THREE.PerspectiveCamera(35, 1, 0.05, 500),
      center: new THREE.Vector3(),
      model: null,
      isStage: false,
      baseDistance: 5,
    };
    uiModule.assetSelect.value = 'character:' + matchModule.game.selectedChar;
    uiModule.loadArtAsset();
    document.getElementById('artClose').focus();
  }
  function closeArtGallery() {
    if (!artView) return;
    const v = artView;
    worldModule.disposeGroup(v.sc);
    v.key.shadow.dispose();
    v.r.dispose();
    v.r.forceContextLoss();
    v.r.domElement.remove();
    artView = null;
    artDialog.classList.remove('show');
    document.getElementById('menu').inert = false;
    artPreviousFocus?.focus();
  }
  return function initialize() {
    originalMenuBuild = uiModule.buildMenu;
    uiModule.buildMenu = function () {
      originalMenuBuild();
      uiModule.portraitRenderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
      });
      uiModule.portraitRenderer.setPixelRatio(1);
      uiModule.portraitRenderer.toneMapping = renderModule.renderer.toneMapping;
      uiModule.portraitRenderer.toneMappingExposure = renderModule.renderer.toneMappingExposure;
      document.querySelectorAll('.map-card').forEach((card, i) => {
        const old = card.querySelector('.map-thumb'),
          img = document.createElement('img');
        img.className = 'map-thumb';
        img.alt = worldModule.MAPS[i].name + '实际场景';
        img.src = artModule.stageThumbnail(worldModule.MAPS[i]);
        old.replaceWith(img);
      });
      uiModule.portraitRenderer.dispose();
      uiModule.portraitRenderer = null;
    };
    artDialog = document.createElement('div');
    artDialog.id = 'artGallery';
    artDialog.setAttribute('role', 'dialog');
    artDialog.setAttribute('aria-modal', 'true');
    artDialog.setAttribute('aria-labelledby', 'artHeading');
    artDialog.innerHTML =
      '<div class="artPanel"><div class="artHeader"><strong id="artHeading">武道图鉴</strong><select id="artAsset" aria-label="选择查看的模型"></select><button id="artReset">重置视角</button><button id="artClose" aria-label="关闭美术图鉴">关闭 ×</button></div><div class="artBody"><div class="artViewport"><div class="artCaption">拖动旋转 · 滚轮缩放</div></div><aside class="artNotes"><div id="artType"></div><h3 id="artName"></h3><p id="artPose"></p><p id="artNote"></p></aside></div></div>';
    document.body.appendChild(artDialog);
    uiModule.assetSelect = document.getElementById('artAsset');
    for (const [kind, list] of [
      ['character', charactersModule.CHARACTERS],
      ['stage', worldModule.MAPS],
    ]) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = kind === 'character' ? '人物模型' : '场景模型';
      list.forEach((d, i) => {
        const op = document.createElement('option');
        op.value = kind + ':' + i;
        op.textContent = d.name;
        optgroup.appendChild(op);
      });
      uiModule.assetSelect.appendChild(optgroup);
    }
    artOpen = document.createElement('button');
    artOpen.className = 'artOpen';
    artOpen.textContent = '武道图鉴 ›';
    document.querySelector('.heroPanel').appendChild(artOpen);
    artView = null;
    artPreviousFocus = null;
    artOpen.onclick = openArtGallery;
    document.getElementById('artClose').onclick = closeArtGallery;
    document.getElementById('artReset').onclick = () => uiModule.fitArtCamera(true);
    uiModule.assetSelect.onchange = uiModule.loadArtAsset;
    artHost = artDialog.querySelector('.artViewport');
    artPointer = null;
    artHost.onpointerdown = (e) => {
      if (!artView) return;
      artPointer = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
      };
      artHost.setPointerCapture(e.pointerId);
    };
    artHost.onpointermove = (e) => {
      if (!artView || !artPointer || e.pointerId !== artPointer.id) return;
      artView.yaw -= (e.clientX - artPointer.x) * 0.009;
      artView.pitch = THREE.MathUtils.clamp(
        artView.pitch + (e.clientY - artPointer.y) * 0.007,
        -0.35,
        1.2,
      );
      artPointer.x = e.clientX;
      artPointer.y = e.clientY;
      uiModule.fitArtCamera();
    };
    artHost.onpointerup =
      artHost.onpointercancel =
      artHost.onlostpointercapture =
        () => (artPointer = null);
    artHost.addEventListener(
      'wheel',
      (e) => {
        if (!artView) return;
        e.preventDefault();
        artView.distance = THREE.MathUtils.clamp(
          artView.distance * Math.exp(e.deltaY * 0.001),
          artView.baseDistance * 0.45,
          artView.baseDistance * 2,
        );
        uiModule.fitArtCamera();
      },
      {
        passive: false,
      },
    );
    addEventListener('resize', () => uiModule.fitArtCamera());
    artDialog.addEventListener('click', (e) => {
      if (e.target === artDialog) closeArtGallery();
    });
    addEventListener(
      'keydown',
      (e) => {
        if (!artView) return;
        if (e.code === 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation();
          closeArtGallery();
        }
        if (e.key === 'Tab') {
          const items = [
              uiModule.assetSelect,
              document.getElementById('artReset'),
              document.getElementById('artClose'),
            ],
            i = items.indexOf(document.activeElement);
          e.preventDefault();
          items[(i + (e.shiftKey ? 2 : 1)) % 3].focus();
        }
      },
      {
        capture: true,
      },
    );
    if (location.search.includes('test=1')) {
      Object.assign(window.__db, {
        ART_PROFILES: artModule.ART_PROFILES,
        openArtGallery,
        closeArtGallery,
      });
      Object.defineProperty(window.__db, 'artView', {
        get: () => artView,
      });
    }
  };
}
