export function register({ render: renderModule }) {
  renderModule.updateMenuCamera = function updateMenuCamera(dt) {
    renderModule.menuAngle += dt * 0.13;
    const r = 24;
    renderModule.camera.position.set(
      Math.cos(renderModule.menuAngle) * r,
      10 + Math.sin(renderModule.menuAngle * 0.6) * 2.2,
      Math.sin(renderModule.menuAngle) * r,
    );
    renderModule.camera.lookAt(0, 2.2, 0);
  };
  return function initialize() {
    renderModule.menuAngle = 0;
  };
}
