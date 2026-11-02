import './style.css';
import './experience.css';
import './polish.css';
import { App } from './app';

const container = document.getElementById('scene')!;

function boot() {
  let app: App;
  try { app = new App(container); }
  catch (error) {
    const loading = document.getElementById('loading')!;
    loading.replaceChildren();
    const text = document.createElement('p');
    text.textContent = '星空暂时无法点亮。请使用支持 WebGL2 的浏览器，并开启硬件加速后刷新。';
    loading.append(text);
    console.error(error);
    return;
  }
  const loading = document.getElementById('loading')!;
  // Keep the critical boot guard until the first scene frame has reached the browser.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.body.classList.remove('booting');
    loading.classList.add('hide');
    setTimeout(() => loading.remove(), 900);
  }));
  // 便于调试
  (window as unknown as { sol: App }).sol = app;
}

// 等待字体就绪，避免开场标题闪烁
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => requestAnimationFrame(boot));
} else {
  requestAnimationFrame(boot);
}
