export function register({ render: renderModule, world: worldModule }) {
  renderModule.updateMenuCamera = function updateMenuCamera(dt) {
    renderModule.menuAngle += dt * 0.13;
    const preview = worldModule.currentMap?.preview;
    const r = preview?.menuRadius ?? (preview ? 53 : 24);
    renderModule.camera.position.set(
      Math.cos(renderModule.menuAngle) * r,
      (preview?.menuHeight ?? (preview ? 28 : 10)) + Math.sin(renderModule.menuAngle * 0.6) * 2.2,
      Math.sin(renderModule.menuAngle) * r,
    );
    renderModule.camera.lookAt(...(preview?.menuTarget ?? [0, 2.2, preview ? -6 : 0]));
  };
  return function initialize() {
    renderModule.menuAngle = 0;
  };
}
