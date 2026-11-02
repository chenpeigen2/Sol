import { BODIES, BODY_BY_ID } from '../data/bodies';
import { J2000, jdFromDate } from '../core/time';
import { smoothstep } from '../core/easing';
import { polishIcons } from './icons';
import type { ViewPreset } from '../scene/CameraRig';

export interface ExperienceActions {
  select(id: string, view?: ViewPreset): void;
  overview(kind: 'inner' | 'all' | 'top'): void;
  setDate(jd: number): void;
  reverse(): boolean;
  cinema(on: boolean): void;
  capture(message: string): Promise<void>;
  tourMode(on: boolean): void;
  effects(bloom: boolean, comet: boolean): void;
  visitComet(): void;
}

const CHAPTERS = [
  { id: 'earth', title: '01 / 唯一的蓝色', text: '我们所有的相遇，都发生在这颗小小的星球上。', view: 'oblique' },
  { id: 'earth', title: '02 / 地月之间', text: '它绕着我们，像一句始终没有说完的晚安。', view: 'system' },
  { id: 'jupiter', title: '03 / 巨人的四颗心', text: '四颗伽利略卫星，在同一束阳光里跳着不同的舞。', view: 'system' },
  { id: 'europa', title: '04 / 冰层下的海', text: '如果远方也有生命，也许它正隔着冰层仰望。', view: 'oblique' },
  { id: 'saturn', title: '05 / 时间的戒指', text: '无数冰粒绕成一枚环。它不承诺永远，只认真发光。', view: 'oblique' },
  { id: 'neptune', title: '06 / 日光的远方', text: '阳光走了四个多小时，才到这片遥远的蓝。', view: 'oblique' },
  { id: 'pluto', title: '07 / 不必在名单里', text: '即使不再被叫作行星，也没有失去自己的轨道。', view: 'system' },
] as const;

export class Experience {
  readonly root = document.createElement('div');
  private chapter = -1;
  private chapterTime = 0;
  private cinema = false;
  private caption: HTMLElement;
  private progress: HTMLElement;
  private explorer: HTMLElement;
  private results: HTMLElement;
  private message: HTMLTextAreaElement;
  private toastTimer = 0;
  private lastSelected: string | null = null;
  private wasPlayingTour = false;

  constructor(private actions: ExperienceActions) {
    this.root.id = 'experience';
    this.root.innerHTML = `
      <nav class="missionbar glass" aria-label="探索工具">
        <button id="open-explorer">⌕ <span>探索天体</span></button>
        <button id="start-tour">▷ <span>电影巡游</span></button>
        <button id="cinema">✧ <span>浪漫模式</span></button>
        <button id="open-letter">♡ <span>写给你</span></button>
        <button id="capture">↓ <span>留念</span></button>
        <button id="toggle-details" aria-pressed="false">⋯ <span>观测</span></button>
      </nav>
      <section id="explorer" class="glass" hidden aria-label="探索控制台">
        <header><div><small>FLIGHT DECK</small><h2>选择你的远方</h2></div><button data-close="explorer" aria-label="关闭探索">×</button></header>
        <input id="body-search" type="search" placeholder="搜索行星、卫星或英文名…" aria-label="搜索天体" />
        <div class="view-presets"><button data-overview="inner">内太阳系</button><button data-overview="all">全太阳系</button><button data-overview="top">黄道俯视</button></div>
        <div class="effect-controls"><label><input id="bloom-effect" type="checkbox" checked /> 电影辉光</label><label><input id="comet-effect" type="checkbox" checked /> 示意彗星双尾</label></div>
        <button id="visit-comet">☄ 追寻彗星 · 双尾近日点演示</button>
        <div id="body-results"></div>
        <div class="date-controls"><label for="travel-date">去一个特别的日子 · UTC</label><input id="travel-date" type="date" min="1800-01-01" max="2050-12-31" /><button id="travel">时间旅行</button><button id="reverse">↶ 时间倒流</button><p>行星使用 JPL 近似轨道，推荐 1800–2050；卫星为示意轨道。</p></div>
      </section>
      <section id="letter" class="glass" hidden aria-label="星空寄语">
        <header><div><small>A NOTE FROM THE COSMOS</small><h2>把宇宙写给一个人</h2></div><button data-close="letter" aria-label="关闭寄语">×</button></header>
        <label for="dedication">你的寄语（仅保存在这台设备）</label>
        <textarea id="dedication" maxlength="100" rows="4" placeholder="在这个宇宙里，很高兴遇见你。"></textarea>
        <div class="letter-actions"><button id="show-letter">点亮这句话</button><button id="save-letter">保存为星空明信片</button></div>
      </section>
      <div id="tour-caption" aria-live="polite" hidden><small id="chapter-title"></small><p id="chapter-text"></p><div class="tour-progress"><i></i></div><div class="tour-actions"><button id="tour-prev">上一站</button><button id="tour-next">下一站</button><button id="tour-stop">结束巡游</button></div></div>
      <div id="dedication-display" hidden></div>
      <button id="exit-cinema" hidden>退出浪漫模式 · Esc</button>
      <div id="telemetry" class="glass"><span>DEEP SPACE NETWORK</span><strong id="telemetry-target">SOL / 日心巡航</strong><p id="telemetry-data">正在接收信号…</p></div>
      <div id="toast" role="status" hidden></div>`;
    document.getElementById('app')!.append(this.root);
    this.explorer = this.get('explorer');
    this.results = this.get('body-results');
    this.caption = this.get('tour-caption');
    this.progress = this.root.querySelector('.tour-progress i')!;
    this.message = this.get('dedication') as HTMLTextAreaElement;
    try { this.message.value = localStorage.getItem('sol.dedication') ?? '在这个宇宙里，很高兴遇见你。'; } catch { /* storage optional */ }
    (this.get('travel-date') as HTMLInputElement).value = new Date().toISOString().slice(0, 10);
    this.bind();
    polishIcons(this.root);
    this.renderResults('');
  }

  private get(id: string) { return this.root.querySelector<HTMLElement>(`#${id}`)!; }
  private bind() {
    this.get('open-explorer').onclick = () => {
      this.get('letter').hidden = true;
      this.explorer.hidden = !this.explorer.hidden;
      if (!this.explorer.hidden) this.get('body-search').focus();
    };
    this.get('open-letter').onclick = () => {
      this.explorer.hidden = true;
      this.get('letter').hidden = !this.get('letter').hidden;
    };
    this.get('toggle-details').onclick = () => {
      const on = document.getElementById('app')!.classList.toggle('instruments');
      this.get('toggle-details').setAttribute('aria-pressed', String(on));
    };
    this.root.querySelectorAll<HTMLElement>('[data-close]').forEach(b => b.onclick = () => { this.get(b.dataset.close!).hidden = true; });
    this.get('body-search').oninput = e => this.renderResults((e.target as HTMLInputElement).value);
    this.root.querySelectorAll<HTMLElement>('[data-overview]').forEach(b => b.onclick = () => {
      this.stopTour(); this.actions.overview(b.dataset.overview as 'inner' | 'all' | 'top'); this.explorer.hidden = true;
    });
    this.get('start-tour').onclick = () => this.chapter < 0 ? this.startTour() : this.stopTour();
    this.get('tour-next').onclick = () => this.goChapter((this.chapter + 1) % CHAPTERS.length);
    this.get('tour-prev').onclick = () => this.goChapter((this.chapter - 1 + CHAPTERS.length) % CHAPTERS.length);
    this.get('tour-stop').onclick = () => this.stopTour();
    this.get('cinema').onclick = () => this.setCinema(!this.cinema);
    this.get('exit-cinema').onclick = () => this.setCinema(false);
    const effects = () => this.actions.effects((this.get('bloom-effect') as HTMLInputElement).checked, (this.get('comet-effect') as HTMLInputElement).checked);
    this.get('visit-comet').onclick = () => {
      this.stopTour(); this.explorer.hidden = true;
      (this.get('comet-effect') as HTMLInputElement).checked = true;
      effects(); this.actions.visitComet();
      this.notify('彗星为示意轨道；蓝色离子尾背向太阳，金色尘埃尾弯向来路。');
    };
    this.get('bloom-effect').onchange = effects;
    this.get('comet-effect').onchange = effects;
    this.get('reverse').onclick = () => {
      const reversed = this.actions.reverse();
      this.get('reverse').textContent = reversed ? '↷ 恢复正向时间' : '↶ 时间倒流';
      this.notify(reversed ? '时间开始倒流，轨道依然记得来路。' : '时间恢复向前。');
    };
    this.get('travel').onclick = () => {
      const date = this.get('travel-date') as HTMLInputElement;
      if (!date.value || !date.checkValidity()) { this.notify('请选择 1800–2050 年之间的有效日期。'); return; }
      this.actions.setDate(jdFromDate(new Date(`${date.value}T12:00:00Z`)));
      this.notify(`已抵达 ${date.value} · UTC`);
    };
    this.get('show-letter').onclick = () => {
      this.saveMessage();
      this.get('dedication-display').textContent = this.message.value.trim() || '在这个宇宙里，很高兴遇见你。';
      this.get('dedication-display').hidden = false;
      this.get('letter').hidden = true;
      this.setCinema(true);
    };
    const capture = async () => {
      try { await this.actions.capture(this.message.value.trim()); this.notify('星空明信片已下载。'); }
      catch { this.notify('保存失败，请允许浏览器下载后重试。'); }
    };
    this.get('capture').onclick = capture;
    this.get('save-letter').onclick = () => { this.saveMessage(); void capture(); };
  }

  private saveMessage() {
    try { localStorage.setItem('sol.dedication', this.message.value); } catch { /* private mode */ }
  }

  private renderResults(query: string) {
    this.results.replaceChildren();
    const q = query.trim().toLocaleLowerCase();
    const matches = BODIES.filter(b => `${b.name} ${b.id} ${b.latin}`.toLocaleLowerCase().includes(q));
    for (const body of matches) {
      const button = document.createElement('button');
      button.className = 'body-result';
      button.dataset.body = body.id;
      const dot = document.createElement('i');
      dot.style.background = `#${body.color.toString(16).padStart(6, '0')}`;
      const name = document.createElement('strong'); name.textContent = body.name;
      const info = document.createElement('small');
      info.textContent = body.parent ? `${BODY_BY_ID.get(body.parent)!.name}的卫星` : `${body.latin} / ${body.type === 'dwarf' ? '矮行星' : body.type === 'star' ? '恒星' : '行星'}`;
      button.append(dot, name, info);
      button.onclick = () => { this.stopTour(); this.actions.select(body.id); this.explorer.hidden = true; };
      this.results.append(button);
    }
    if (!matches.length) this.results.textContent = '这个名字还不在我们的星图里。';
  }

  startTour() {
    this.explorer.hidden = true;
    this.get('letter').hidden = true;
    this.wasPlayingTour = true;
    this.actions.tourMode(true);
    this.goChapter(0);
    this.get('start-tour').classList.add('active');
  }

  private goChapter(index: number) {
    this.chapter = index;
    this.chapterTime = 0;
    this.caption.style.setProperty('--caption-opacity', '0');
    const c = CHAPTERS[index];
    this.actions.select(c.id, c.view);
    this.get('chapter-title').textContent = c.title;
    this.get('chapter-text').textContent = c.text;
    this.caption.hidden = false;
  }

  stopTour() {
    this.chapter = -1;
    this.caption.hidden = true;
    this.get('start-tour').classList.remove('active');
    if (this.wasPlayingTour) this.actions.tourMode(false);
    this.wasPlayingTour = false;
  }

  setCinema(on: boolean) {
    this.cinema = on;
    document.getElementById('app')!.classList.toggle('cinema', on);
    this.get('exit-cinema').hidden = !on;
    this.actions.cinema(on);
    if (!on) this.get('dedication-display').hidden = true;
  }

  escape() { this.stopTour(); this.setCinema(false); this.explorer.hidden = true; this.get('letter').hidden = true; }

  notify(text: string) {
    const toast = this.get('toast');
    clearTimeout(this.toastTimer);
    toast.textContent = text; toast.hidden = false;
    this.toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3600);
  }

  update(dt: number, jd: number, selected: string | null, distanceAU: number, radius: number) {
    if (this.chapter >= 0) {
      this.chapterTime += dt;
      this.caption.style.setProperty('--caption-opacity', String(smoothstep(0, 1.4, this.chapterTime) * (1 - smoothstep(10.8, 12, this.chapterTime))));
      this.progress.style.width = `${Math.min(100, this.chapterTime / 12 * 100)}%`;
      if (this.chapterTime >= 12) {
        if (this.chapter === CHAPTERS.length - 1) { this.stopTour(); this.notify('旅程没有终点。你可以继续探索。'); }
        else this.goChapter(this.chapter + 1);
      }
    }
    if (selected !== this.lastSelected) {
      this.get('telemetry-target').textContent = selected ? `${BODY_BY_ID.get(selected)!.latin.toUpperCase()} / 追踪中` : 'SOL / 日心巡航';
      this.lastSelected = selected;
    }
    this.get('telemetry-data').textContent = `${distanceAU.toFixed(3)} AU · 光行时 ${(distanceAU * 8.317).toFixed(1)} 分钟\nJ2000 + ${Math.floor(jd - J2000).toLocaleString()} 天${selected ? ` · 显示半径 ${radius.toFixed(3)}` : ''}`;
  }
}
