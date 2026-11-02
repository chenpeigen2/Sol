import './style.css';
import { App } from './app';

const container = document.getElementById('scene')!;

function boot() {
  const app = new App(container);
  const loading = document.getElementById('loading')!;
  loading.classList.add('hide');
  setTimeout(() => loading.remove(), 900);
  // 便于调试
  (window as unknown as { sol: App }).sol = app;
}

// 等待字体就绪，避免开场标题闪烁
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => requestAnimationFrame(boot));
} else {
  requestAnimationFrame(boot);
}
