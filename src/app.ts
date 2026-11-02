import * as THREE from 'three';
import { SolarSystem, AU_SCALE } from './scene/SolarSystem';
import { CameraRig, type ViewPreset } from './scene/CameraRig';
import { Experience } from './ui/Experience';
import { polishIcons, setPlaybackIcon } from './ui/icons';
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
  private speedIndex = 2;
  private viewingPlayback: { speed: number; direction: number } | null = null;
  private playing = true;
  private scrubbing = false;
  private direction = 1;
  private experience: Experience;
  private tourPlayback: { playing: boolean; speed: number } | null = null;
  private isCinema = false;
  private layersVisible = true;
  private orbitsOn = true;

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
    polishIcons();
    setPlaybackIcon(this.els.play, this.playing);
    this.bindUI();
    this.updateSpeedLabel();
    this.updateSizeTags(1);
    this.syncScrub();
    this.system.update(this.jd - J2000, centuriesSinceJ2000(this.jd));
    this.experience = new Experience({
      select: (id, view) => {
        this.finishIntro();
        this.select(id, false);
        this.following = true;
        this.els.follow.classList.add('on');
        this.els.follow.textContent = '正在跟随';
        this.rig.focus(id, { view });
      },
      overview: kind => { this.finishIntro(); this.closePanel(); this.rig.overview(kind); },
      setDate: jd => { this.jd = jd; this.system.clearTrails(); this.syncScrub(); },
      reverse: () => { this.direction *= -1; this.system.clearTrails(); return this.direction < 0; },
      cinema: on => {
        this.isCinema = on;
        this.rig.controls.autoRotate = on && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.layersVisible = !on;
        this.applyLayerVisibility();
        this.rig.controls.autoRotateSpeed = 0.18;
      },
      capture: message => this.capture(message),
      effects: (bloom, comet) => { this.system.setBloom(bloom); this.system.comet.enabled = comet; },
      visitComet: () => {
        this.finishIntro(); this.closePanel();
        this.jd = J2000; this.system.clearTrails();
        this.system.update(0, 0);
        const p = this.system.comet.position;
        const target = new THREE.Vector3(p.x, p.z, -p.y);
        this.rig.setImmediate(target.clone().add(new THREE.Vector3(80, 65, 160)), target.clone().add(new THREE.Vector3(25, 0, -10)));
        this.playing = false; setPlaybackIcon(this.els.play, false); this.syncScrub();
      },
      tourMode: on => {
        if (on) {
          this.tourPlayback = { playing: this.playing, speed: this.speedIndex };
          this.playing = true; this.speedIndex = 2;
          this.els.panel.classList.remove('show');
          document.getElementById('app')!.classList.add('touring');
          this.rig.controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          this.rig.controls.autoRotateSpeed = 0.16;
        } else {
          if (this.tourPlayback) {
            this.playing = this.tourPlayback.playing; this.speedIndex = this.tourPlayback.speed;
          }
          this.tourPlayback = null;
          document.getElementById('app')!.classList.remove('touring');
          this.rig.controls.autoRotate = false;
        }
        this.els.speed.value = String(this.speedIndex);
        setPlaybackIcon(this.els.play, this.playing);
        this.updateSpeedLabel();
      },
    });
    this.rig.controls.addEventListener('start', () => this.experience.stopTour());
    this.system.renderer.domElement.addEventListener('wheel', () => {
      if (this.introIndex >= 0) this.skipIntro();
    }, { passive: true });

    // 开场：相机从地球夜面缓缓升起
    this.rig.controls.enabled = false;
    this.introIndex = 0;
    this.introT = 0;
    this.applyIntroCamera(0);
    const prefersStill = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersStill) this.skipIntro();
    else {
      // Do not consume the opening camera sequence behind the texture-loading curtain.
      const sequence = this.introIndex;
      this.introIndex = -2;
      void this.system.ready.then(() => {
        if (this.introIndex === -2) { this.introIndex = sequence; this.introT = 0; }
      });
    }

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
    document.getElementById('skip-intro')!.onclick = () => this.skipIntro();
    this.els.play.addEventListener('click', () => this.togglePlay());
    this.els.speed.addEventListener('input', () => {
      this.speedIndex = Number(this.els.speed.value);
      this.updateSpeedLabel();
    });
    this.els.now.addEventListener('click', () => {
      this.jd = jdFromDate(new Date());
      this.system.clearTrails();
      this.syncScrub();
    });
    this.els.scrub.addEventListener('pointerdown', () => (this.scrubbing = true));
    window.addEventListener('pointerup', () => (this.scrubbing = false));
    this.els.scrub.addEventListener('input', () => {
      const years = Number(this.els.scrub.value);
      this.jd = J2000 + years * 365.25;
      this.system.clearTrails();
    });

    this.els.size.addEventListener('input', () => {
      const v = Number(this.els.size.value) / 100;
      this.system.sizeScale = v;
      this.updateSizeTags(v);
    });

    document.querySelectorAll<HTMLElement>('[data-view]').forEach(button => {
      button.onclick = () => {
        if (this.selected) this.rig.focus(this.selected, { view: button.dataset.view as ViewPreset, follow: this.following });
      };
    });
    this.els.follow.addEventListener('click', () => this.toggleFollow());
    this.els.close.addEventListener('click', () => this.closePanel());

    document.getElementById('toggle-orbits')!.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      const on = !btn.classList.contains('on');
      btn.classList.toggle('on', on);
      this.orbitsOn = on;
      this.applyLayerVisibility();
    });
    document.getElementById('toggle-labels')!.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      const on = !btn.classList.toggle('on');
      this.labelLayer.style.display = on ? 'none' : '';
    });
    document.getElementById('toggle-trails')!.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      const on = btn.classList.toggle('on');
      for (const t of this.system.trails.values()) t.line.visible = on;
    });

    window.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tag)) return;
      if (e.key === 'Escape') { this.experience.escape(); this.skipIntroIfNeeded(); }
      if (e.key.toLowerCase() === 'c') this.experience.setCinema(!this.isCinema);
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
    setPlaybackIcon(this.els.play, this.playing);
  }

  private syncScrub() {
    const years = (this.jd - J2000) / 365.25;
    this.els.scrub.value = String(Math.max(-200, Math.min(50, years)));
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
    this.finishIntro();
    const body = BODY_BY_ID.get(id);
    if (!body) return;
    if (!this.viewingPlayback && !this.tourPlayback) this.viewingPlayback = { speed: this.speedIndex, direction: this.direction };
    // A close-up should reveal geography, not spin several years per second.
    this.speedIndex = Math.min(this.speedIndex, 1);
    this.els.speed.value = String(this.speedIndex);
    this.updateSpeedLabel();
    this.selected = id;

    document.getElementById('observation-name')!.textContent = `${body.name} / ${body.latin.toUpperCase()}`;
    this.els.title.textContent = body.name;
    this.els.latin.textContent = body.latin.toUpperCase();
    this.els.poetry.textContent = body.poetry;
    const related = document.getElementById('p-related')!;
    related.replaceChildren();
    const siblings = BODIES.filter(b => b.parent === id || b.id === body.parent);
    for (const b of siblings) {
      const btn = document.createElement('button'); btn.textContent = b.name;
      btn.onclick = () => this.select(b.id, true); related.append(btn);
    }

    const rows: Array<[string, string]> = [
      [body.parent ? '距母星' : '距太阳', body.info.distance],
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

    this.updateImmersive();
    this.els.panel.hidden = false;
    requestAnimationFrame(() => this.els.panel.classList.add('show'));

    for (const btn of Array.from(this.els.quickbar.querySelectorAll('button'))) {
      btn.classList.toggle('on', (btn as HTMLElement).dataset.id === id);
    }
    for (const [lid, el] of this.labels) el.classList.toggle('sel', lid === id);

    if (focus) {
      this.experience.stopTour();
      this.following = true;
      this.els.follow.classList.add('on');
      this.els.follow.textContent = '正在跟随';
      this.rig.focus(id);
    }
  }

  private closePanel() {
    this.els.panel.classList.remove('show');
    this.selected = null;
    document.getElementById('observation-name')!.textContent = '太阳系 / SOLAR SYSTEM';
    if (this.viewingPlayback) {
      this.speedIndex = this.viewingPlayback.speed;
      this.viewingPlayback = null;
      this.els.speed.value = String(this.speedIndex);
      this.updateSpeedLabel();
    }
    this.following = false;
    this.els.follow.classList.remove('on');
    this.rig.release();
    for (const el of this.labels.values()) el.classList.remove('sel');
    for (const btn of this.els.quickbar.querySelectorAll('button')) btn.classList.remove('on');
    this.updateImmersive();
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

  private finishIntro() {
    if (this.introIndex < 0) return;
    this.introIndex = -1;
    this.els.intro.classList.add('hide');
    this.rig.controls.enabled = true;
    this.revealUI();
  }

  private skipIntroIfNeeded() { if (this.introIndex >= 0) this.skipIntro(); }

  private skipIntro() {
    this.finishIntro();
    this.rig.frameAll(false);
  }

  private applyLayerVisibility() {
    this.system.setOrbitsVisible(this.orbitsOn && this.layersVisible);
    for (const t of this.system.trails.values()) t.line.visible = this.layersVisible && document.getElementById('toggle-trails')!.classList.contains('on');
    this.system.comet.group.visible = this.layersVisible && this.system.comet.enabled;
  }

  private updateImmersive() {
    document.getElementById('app')!.classList.toggle('immersive', Boolean(this.selected) && !this.isCinema);
  }

  private revealUI() {
    this.els.brand.classList.add('ready');
    this.els.timebar.classList.add('ready');
    this.els.hud.classList.add('ready');
    this.els.quick.classList.add('ready');
    document.getElementById('app')!.classList.add('ready');
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
    this.experience.update(dt, this.jd, this.selected,
      this.selected ? this.system.worldPositionOf(this.selected).length() / AU_SCALE : this.system.camera.position.length() / AU_SCALE,
      this.selected ? this.system.bodyRadiusWorld(this.selected) : 0);

    if (this.playing && !this.scrubbing && this.introIndex < 0) {
      const preset = SPEED_PRESETS[this.speedIndex];
      this.jd += dt * preset.daysPerSecond * this.direction;
      this.jd = Math.max(jdFromDate(new Date('1800-01-01T00:00:00Z')), Math.min(jdFromDate(new Date('2050-12-31T23:59:59Z')), this.jd));
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
    // Shift portrait composition upward only while the information sheet occupies the bottom.
    const portrait = this.system.camera.aspect < 0.9;
    const sheet = this.selected && !this.isCinema && !this.tourPlayback;
    const camera = this.system.camera;
    if (portrait && sheet) {
      const w = this.container.clientWidth, h = this.container.clientHeight;
      camera.setViewOffset(w, h, 0, h * 0.14, w, h);
    } else if (camera.view?.enabled) camera.clearViewOffset();

    this.updateLabels();
    this.els.date.textContent = formatDate(this.jd);
    this.applyLayerVisibility();
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
      const distance = cam.position.distanceTo(world);
      const pixels = this.system.bodyRadiusWorld(body.id) / Math.max(distance, 0.001) * rect.height;
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
        el.style.pointerEvents = 'none';
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
      el.style.top = `${y + Math.min(120, pixels * 0.8) + 15}px`;
      el.style.opacity = body.type === 'moon' ? '0.7' : '1';
      el.style.pointerEvents = 'auto';
    }
  }

  private async capture(message: string) {
    const source = this.system.renderer.domElement;
    // Render immediately so export does not depend on preserveDrawingBuffer.
    this.system.render(this.clock.elapsedTime);
    const canvas = document.createElement('canvas');
    canvas.width = source.width; canvas.height = source.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(source, 0, 0);
    const w = canvas.width, h = canvas.height;
    const gradient = ctx.createLinearGradient(0, h * 0.6, 0, h);
    gradient.addColorStop(0, 'transparent'); gradient.addColorStop(1, 'rgba(0,3,8,.9)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    const font = Math.max(18, Math.min(w * 0.034, 32));
    ctx.fillStyle = '#ffd9a0'; ctx.font = `${font}px serif`; ctx.textAlign = 'center';
    // Wrap by measured width, including Chinese, without inserting HTML.
    const lines: string[] = []; let line = '';
    for (const c of (message || '在这个宇宙里，很高兴遇见你。').slice(0, 100)) {
      if (c === '\n' || ctx.measureText(line + c).width > w * 0.8) { lines.push(line); line = c === '\n' ? '' : c; }
      else line += c;
    }
    if (line) lines.push(line);
    lines.forEach((text, i) => ctx.fillText(text, w / 2, h - 90 - (lines.length - 1 - i) * font * 1.5));
    ctx.font = `${Math.max(11, font * 0.42)}px sans-serif`; ctx.fillStyle = '#abb7c8';
    ctx.fillText(`SOL · ${formatDate(this.jd)} UTC`, w / 2, h - 35);
    ctx.font = `${Math.max(8, font * 0.28)}px sans-serif`;
    ctx.fillStyle = '#8c99a9';
    ctx.fillText('Planet imagery: Solar System Scope · CC BY 4.0 · solarsystemscope.com/textures', w / 2, h - 14);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG export failed')), 'image/png'));
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'SOL-星空明信片.png'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async ready() { await this.system.ready; }

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
    this.rig.focus(id, { immediate, padding: 6 });
    this.els.intro.style.transition = 'none';
    this.els.intro.style.opacity = '0';
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
