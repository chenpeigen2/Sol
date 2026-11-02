import * as THREE from 'three';
import { SolarSystem, AU_SCALE } from './scene/SolarSystem';
import { CameraRig } from './scene/CameraRig';
import { BODIES, BODY_BY_ID, type Body } from './data/bodies';
import { J2000, SPEED_PRESETS, centuriesSinceJ2000, dateFromJd, formatDate, jdFromDate } from './core/time';

/* ------------------------------------------------------------------ *
 * 开场运镜
 * ------------------------------------------------------------------ */

interface IntroKey {
  anchor: string;
  offset: THREE.Vector3;
  target: string;
  targetOffset: THREE.Vector3;
  dur: number;
}

const INTRO_KEYS: IntroKey[] = [
  {
    anchor: 'earth',
    offset: new THREE.Vector3(2.4, 1.1, 2.9),
    target: 'earth',
    targetOffset: new THREE.Vector3(0, 0, 0),
    dur: 3.2,
  },
  {
    anchor: 'earth',
    offset: new THREE.Vector3(11, 5, 14),
    target: 'earth',
    targetOffset: new THREE.Vector3(0, 0, 0),
    dur: 2.6,
  },
  {
    anchor: 'sun',
    offset: new THREE.Vector3(58, 26, 72),
    target: 'sun',
    targetOffset: new THREE.Vector3(0, 0, 0),
    dur: 2.8,
  },
  {
    anchor: 'sun',
    offset: new THREE.Vector3(760, 330, 900),
    target: 'sun',
    targetOffset: new THREE.Vector3(0, 0, 0),
    dur: 2.8,
  },
  {
    anchor: 'sun',
    offset: new THREE.Vector3(2300, 1100, 2650),
    target: 'sun',
    targetOffset: new THREE.Vector3(0, 0, 0),
    dur: 2.6,
  },
  {
    anchor: 'sun',
    offset: new THREE.Vector3(520, 235, 600),
    target: 'sun',
    targetOffset: new THREE.Vector3(0, 0, 0),
    dur: 3.0,
  },
];

const quickBodies = ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

/* ------------------------------------------------------------------ */

export class App {
  private system: SolarSystem;
  private rig: CameraRig;
  private container: HTMLElement;

  private jd = jdFromDate(new Date());
  private speedIndex = 3;
  private playing = true;
  private scrubbing = false;

  private introIndex = -1;
  private introT = 0;

  private selected: string | null = null;
  private following = false;
  private sunClicks = 0;

  private labels = new Map<string, HTMLDivElement>();
  private labelLayer: HTMLElement;

  private els: {
    date: HTMLElement;
    speed: HTMLInputElement;
    speedLabel: HTMLElement;
    play: HTMLButtonElement;
    scrub: HTMLInputElement;
    now: HTMLButtonElement;
    size: HTMLInputElement;
    sizeTags: HTMLElement[];
    panel: HTMLElement;
    title: HTMLElement;
    latin: HTMLElement;
    poetry: HTMLElement;
    data: HTMLElement;
    follow: HTMLButtonElement;
    close: HTMLButtonElement;
    quickbar: HTMLElement;
    intro: HTMLElement;
    loading: HTMLElement;
    brand: HTMLElement;
    timebar: HTMLElement;
    hud: HTMLElement;
    quick: HTMLElement;
  };

  private clock = new THREE.Clock();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  constructor(container: HTMLElement) {
    this.container = container;
    this.system = new SolarSystem({ container });
    this.rig = new CameraRig(this.system.camera, this.system.renderer.domElement, this.system);

    this.labelLayer = document.getElementById('labels')!;

    this.els = {
      date: document.getElementById('date')!,
      speed: document.getElementById('speed') as HTMLInputElement,
      speedLabel: document.getElementById('speedlabel')!,
      play: document.getElementById('play') as HTMLButtonElement,
      scrub: document.getElementById('scrub') as HTMLInputElement,
      now: document.getElementById('now') as HTMLButtonElement,
      size: document.getElementById('size') as HTMLInputElement,
      sizeTags: Array.from(document.querySelectorAll<HTMLElement>('.tag')),
      panel: document.getElementById('panel')!,
      title: document.getElementById('p-title')!,
      latin: document.getElementById('p-latin')!,
      poetry: document.getElementById('p-poetry')!,
      data: document.getElementById('p-data')!,
      follow: document.getElementById('p-follow') as HTMLButtonElement,
      close: document.getElementById('close') as HTMLButtonElement,
      quickbar: document.getElementById('quickbar')!,
      intro: document.getElementById('intro')!,
      loading: document.getElementById('loading')!,
      brand: document.getElementById('brand')!,
      timebar: document.getElementById('timebar')!,
      hud: document.getElementById('hud')!,
      quick: document.getElementById('quickbar')!,
    };

    this.buildQuickbar();
    this.buildLabels();
    this.bindUI();

    // 开场：相机从地球夜面缓缓升起
    this.rig.controls.enabled = false;
    this.introIndex = 0;
    this.introT = 0;
    this.applyIntroCamera(0);

    window.addEventListener('resize', () => this.onResize());
    this.system.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.system.renderer.domElement.addEventListener('pointerup', (e) => this.onPointerUp(e));

    requestAnimationFrame(() => this.loop());
  }

  /* ---------------------------------------------------------------- */

  private buildQuickbar() {
    for (const id of quickBodies) {
      const body = BODY_BY_ID.get(id);
      if (!body) continue;
      const btn = document.createElement('button');
      btn.textContent = body.name;
      btn.dataset.id = id;
      btn.addEventListener('click', () => this.select(id, true));
      this.els.quickbar.appendChild(btn);
    }
  }

  private buildLabels() {
    for (const body of BODIES) {
      const el = document.createElement('div');
      el.className = body.type === 'moon' ? 'label moon' : 'label';
      el.textContent = body.name;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.select(body.id, true);
      });
      this.labelLayer.appendChild(el);
      this.labels.set(body.id, el);
    }
  }

  private bindUI() {
    this.els.play.addEventListener('click', () => this.togglePlay());
    this.els.speed.addEventListener('input', () => {
      this.speedIndex = Number(this.els.speed.value);
      this.updateSpeedLabel();
    });
    this.els.now.addEventListener('click', () => {
      this.jd = jdFromDate(new Date());
      this.syncScrub();
    });
    this.els.scrub.addEventListener('pointerdown', () => (this.scrubbing = true));
    window.addEventListener('pointerup', () => (this.scrubbing = false));
    this.els.scrub.addEventListener('input', () => {
      const years = Number(this.els.scrub.value);
      this.jd = J2000 + years * 365.25;
    });

    this.els.size.addEventListener('input', () => {
      const v = Number(this.els.size.value) / 100;
      // 0 = 真实比例，1 = 视觉夸张；用幂曲线让中段更好调
      const scale = Math.pow(v, 3.2) * 0.998 + 0.002;
      this.system.sizeScale = scale;
      this.updateSizeTags(v);
    });

    this.els.follow.addEventListener('click', () => this.toggleFollow());
    this.els.close.addEventListener('click', () => this.closePanel());

    document.getElementById('toggle-orbits')!.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      const on = !btn.classList.contains('on');
      btn.classList.toggle('on', on);
      for (const o of this.system.orbitLines) o.line.visible = on;
    });
    document.getElementById('toggle-labels')!.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      const on = !btn.classList.toggle('on');
      this.labelLayer.style.display = on ? 'none' : '';
    });
    document.getElementById('toggle-trails')!.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      const on = !btn.classList.toggle('on');
      for (const t of this.system.trails.values()) t.line.visible = on;
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlay();
      }
      if (e.key === 'Escape') this.closePanel();
      if (e.key === 'f' || e.key === 'F') this.toggleFollow();
    });
  }

  private updateSpeedLabel() {
    this.els.speedLabel.textContent = SPEED_PRESETS[this.speedIndex].label;
  }

  private updateSizeTags(v: number) {
    const real = this.els.sizeTags.find((t) => t.dataset.size === '0')!;
    const fake = this.els.sizeTags.find((t) => t.dataset.size === '1')!;
    real.classList.toggle('active', v < 0.35);
    fake.classList.toggle('active', v >= 0.35);
  }

  private togglePlay() {
    this.playing = !this.playing;
    this.els.play.textContent = this.playing ? '❚❚' : '▶';
  }

  private syncScrub() {
    const years = (this.jd - J2000) / 365.25;
    this.els.scrub.value = String(Math.max(-100, Math.min(100, years)));
  }

  /* ---------------------------------------------------------------- */

  private onPointerDown(e: PointerEvent) {
    if (this.introIndex >= 0) {
      this.skipIntro();
      return;
    }
    this.pointerDownAt = { x: e.clientX, y: e.clientY };
  }

  private pointerDownAt: { x: number; y: number } | null = null;

  private onPointerUp(e: PointerEvent) {
    if (!this.pointerDownAt) return;
    const dx = e.clientX - this.pointerDownAt.x;
    const dy = e.clientY - this.pointerDownAt.y;
    this.pointerDownAt = null;
    if (Math.hypot(dx, dy) > 5) return;

    const rect = this.system.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.system.camera);

    const hit = this.system.pick(this.raycaster);
    if (hit) {
      if (hit === 'sun') {
        this.sunClicks++;
        if (this.sunClicks >= 3) {
          this.sunClicks = 0;
          this.showEgg();
          return;
        }
      }
      this.select(hit, true);
      return;
    }
    this.closePanel();
  }

  private select(id: string, focus: boolean) {
    const body = BODY_BY_ID.get(id);
    if (!body) return;
    this.selected = id;

    this.els.title.textContent = body.name;
    this.els.latin.textContent = body.latin.toUpperCase();
    this.els.poetry.textContent = body.poetry;

    const rows: Array<[string, string]> = [
      ['距太阳', body.info.distance],
      ['半径', body.info.radius],
      ['质量', body.info.mass],
      ['公转', body.info.period],
      ['自转', body.info.rotation],
      ['温度', body.info.temperature],
      ['卫星', body.info.moons],
      ['发现', body.info.discovery],
      ['成分', body.info.composition],
    ];
    this.els.data.innerHTML = rows
      .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
      .join('');

    this.els.panel.hidden = false;
    requestAnimationFrame(() => this.els.panel.classList.add('show'));

    for (const btn of Array.from(this.els.quickbar.querySelectorAll('button'))) {
      btn.classList.toggle('on', (btn as HTMLElement).dataset.id === id);
    }
    for (const [lid, el] of this.labels) el.classList.toggle('sel', lid === id);

    if (focus) {
      this.following = false;
      this.els.follow.classList.remove('on');
      this.els.follow.textContent = '跟随它';
      this.rig.focus(id);
    }
  }

  private closePanel() {
    this.els.panel.classList.remove('show');
    this.selected = null;
    this.following = false;
    this.els.follow.classList.remove('on');
    setTimeout(() => {
      if (!this.selected) this.els.panel.hidden = true;
    }, 400);
  }

  private toggleFollow() {
    if (!this.selected) return;
    this.following = !this.following;
    this.els.follow.classList.toggle('on', this.following);
    this.els.follow.textContent = this.following ? '正在跟随' : '跟随它';
    if (this.following) {
      this.rig.focus(this.selected);
    } else {
      this.rig.release();
    }
  }

  private showEgg() {
    const el = document.createElement('div');
    el.textContent = '在某个瞬间，宇宙恰好也在看着你。';
    Object.assign(el.style, {
      position: 'absolute',
      left: '50%',
      top: '42%',
      transform: 'translate(-50%,-50%)',
      fontFamily: 'var(--serif)',
      fontSize: '20px',
      letterSpacing: '0.24em',
      color: '#ffd9a0',
      textShadow: '0 0 40px rgba(255,190,110,.6)',
      pointerEvents: 'none',
      zIndex: '30',
      opacity: '0',
      transition: 'opacity 1s ease',
    });
    document.getElementById('app')!.appendChild(el);
    requestAnimationFrame(() => (el.style.opacity = '1'));
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 1200);
    }, 4200);
  }

  /* ---------------------------------------------------------------- */

  private skipIntro() {
    this.introIndex = -1;
    this.els.intro.classList.add('hide');
    this.rig.controls.enabled = true;
    this.rig.frameAll(false);
    this.revealUI();
  }

  private revealUI() {
    this.els.brand.classList.add('ready');
    this.els.timebar.classList.add('ready');
    this.els.hud.classList.add('ready');
    this.els.quick.classList.add('ready');
  }

  private applyIntroCamera(dt: number) {
    if (this.introIndex < 0) return;
    this.introT += dt;

    const key = INTRO_KEYS[this.introIndex];
    const k = Math.min(1, this.introT / key.dur);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

    // 起点（上一个关键帧的终点）与终点
    const prev = this.introIndex === 0 ? key : INTRO_KEYS[this.introIndex - 1];
    const fromAnchor = this.anchorWorld(prev.anchor, prev.offset);
    const toAnchor = this.anchorWorld(key.anchor, key.offset);
    const pos = fromAnchor.pos.clone().lerp(toAnchor.pos, e);
    const target = fromAnchor.target.clone().lerp(toAnchor.target, e);

    this.rig.setImmediate(pos, target);

    if (k >= 1) {
      this.introT = 0;
      this.introIndex++;
      if (this.introIndex >= INTRO_KEYS.length) {
        this.introIndex = -1;
        this.rig.controls.enabled = true;
        this.rig.frameAll(false);
        this.revealUI();
      }
    }
  }

  private anchorWorld(anchor: string, offset: THREE.Vector3) {
    const p = this.system.worldPositionOf(anchor);
    return {
      pos: p.clone().add(offset),
      target: p.clone(),
    };
  }

  /* ---------------------------------------------------------------- */

  private onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.system.setSize(w, h);
  }

  private loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(0.05, this.clock.getDelta());
    const elapsed = this.clock.elapsedTime;

    if (this.playing && this.introIndex < 0) {
      const preset = SPEED_PRESETS[this.speedIndex];
      this.jd += dt * preset.daysPerSecond;
      if (!this.scrubbing) this.syncScrub();
    } else if (this.introIndex >= 0) {
      this.jd += dt * 1;
    }

    const days = this.jd - J2000;
    const centuries = centuriesSinceJ2000(this.jd);
    this.system.update(days, centuries);

    if (this.introIndex >= 0) {
      this.applyIntroCamera(dt);
      if (this.introIndex >= 2) this.els.intro.classList.add('hide');
    } else {
      this.rig.update(dt);
    }

    this.updateLabels();
    this.els.date.textContent = formatDate(this.jd);
    this.system.render(elapsed);
  }

  private updateLabels() {
    const cam = this.system.camera;
    const rect = this.system.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector3();
    const placed: Array<{ x: number; y: number; w: number; h: number }> = [];

    const ordered = BODIES.slice().sort((a, b) => {
      const rank = (x: Body) => (x.type === 'star' ? 0 : x.type === 'planet' ? 1 : x.type === 'dwarf' ? 2 : 3);
      return rank(a) - rank(b);
    });

    for (const body of ordered) {
      const el = this.labels.get(body.id)!;
      const world = this.system.worldPositionOf(body.id);
      v.copy(world).project(cam);

      if (v.z > 1 || v.z < -1) {
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        continue;
      }

      const x = (v.x * 0.5 + 0.5) * rect.width;
      const y = (-v.y * 0.5 + 0.5) * rect.height;
      const dist = cam.position.distanceTo(world);

      if (x < -60 || x > rect.width + 60 || y < -30 || y > rect.height + 30) {
        el.style.opacity = '0';
        continue;
      }

      // 屏幕空间去重叠
      const w = body.type === 'moon' ? 44 : 58;
      const h = 20;
      let hidden = false;
      for (const p of placed) {
        if (Math.abs(p.x - x) < (p.w + w) / 2 && Math.abs(p.y - y) < (p.h + h) / 2) {
          hidden = true;
          break;
        }
      }

      // 卫星在远景时隐去
      if (body.type === 'moon' && dist > 900) hidden = true;

      if (hidden) {
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        continue;
      }

      placed.push({ x, y, w, h });
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.opacity = body.type === 'moon' ? '0.7' : '1';
      el.style.pointerEvents = 'auto';
    }
  }

  /* 供外部调用 */
  get currentTime() {
    return this.jd;
  }

  /** 调试用：跳过开场并锁定到某个天体 */
  debugFocus(id: string, immediate = true) {
    this.introIndex = -1;
    this.els.intro.classList.add('hide');
    this.rig.controls.enabled = true;
    this.revealUI();
    this.rig.focus(id, { immediate, padding: 5 });
  }

  /** 调试用：设定模拟时刻 */
  debugSetTime(jd: number) {
    this.jd = jd;
  }

  /** 调试用：拉到全景 */
  debugFrameAll() {
    this.introIndex = -1;
    this.els.intro.classList.add('hide');
    this.rig.controls.enabled = true;
    this.revealUI();
    this.rig.frameAll(true);
  }

  /** 调试用：把相机放到距太阳 distance 的位置 */
  debugCam(distance: number, elev = 0.42) {
    this.introIndex = -1;
    this.els.intro.classList.add('hide');
    this.rig.controls.enabled = true;
    this.revealUI();
    const dir = new THREE.Vector3(0.42, elev, 1).normalize();
    const pos = dir.multiplyScalar(distance);
    this.rig.setImmediate(pos, new THREE.Vector3(0, 0, 0));
  }
}

export { AU_SCALE, dateFromJd };
