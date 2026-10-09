import { createApplication } from './app/application.js';
import { modulePlan } from './app/module-plan.js';
const testMode = new URLSearchParams(location.search).get('test') === '1';
const testModules = testMode ? (await import('./testing/modules.js')).testModules : {};
const application = createApplication({
  plan: modulePlan,
  testModules,
});
try {
  application.start();
} catch (error) {
  console.error(error);
  const loading = document.getElementById('loading');
  loading.textContent = '游戏启动失败，请刷新页面。';
  loading.setAttribute('role', 'alert');
}
