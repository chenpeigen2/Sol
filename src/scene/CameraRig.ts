import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { SolarSystem } from './SolarSystem';

export type ViewPreset = 'oblique' | 'top' | 'edge' | 'system';
const DIRECTIONS = {
  oblique: new THREE.Vector3(0.65, 0.48, 1).normalize(),
  top: new THREE.Vector3(0.001, 1, 0.001).normalize(),
  edge: new THREE.Vector3(0.4, 0.025, 1).normalize(),
};
interface Flight {
  fromPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  offset: THREE.Vector3;
  anchor: string | null;
  target: THREE.Vector3;
  elapsed: number;
  duration: number;
}

export class CameraRig {
  readonly controls: OrbitControls;
  private flight: Flight | null = null;
  private followId: string | null = null;
  private lastFollowPos = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera, dom: HTMLElement, private system: SolarSystem) {
    this.controls = new OrbitControls(camera, dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.rotateSpeed = 0.55;
    this.controls.minDistance = 0.003;
    this.controls.maxDistance = 400000;
    this.controls.screenSpacePanning = true;
    this.controls.addEventListener('start', () => { this.flight = null; });
  }

  get isAnimating() { return this.flight !== null; }

  release() {
    this.flight = null;
    this.followId = null;
    this.controls.autoRotate = false;
  }

  focus(id: string, opts: { immediate?: boolean; padding?: number; follow?: boolean; view?: ViewPreset } = {}) {
    const radius = Math.max(this.system.bodyRadiusWorld(id), 0.001);
    const view = opts.view ?? 'oblique';
    let dist = radius * (opts.padding ?? (id === 'saturn' ? 10 : 6));
    if (view === 'system') {
      const moons = [...this.system.nodes.values()].filter(n => n.body.parent === id);
      const span = Math.max(radius * 3, ...moons.map(n => n.holder.position.length()));
      dist = span * 3;
    }
    // Match portrait framing instead of clipping a planet on narrow phones.
    dist *= Math.max(1, 0.9 / this.system.camera.aspect);
    const dir = DIRECTIONS[view === 'system' ? 'oblique' : view];
    this.move(id, new THREE.Vector3(), dir.clone().multiplyScalar(dist), 2.4, opts.immediate ?? false);
    this.followId = opts.follow === false ? null : id;
  }

  overview(kind: 'inner' | 'all' | 'top' = 'inner') {
    const distance = (kind === 'all' ? 10000 : 600) * Math.max(1, 0.9 / this.system.camera.aspect);
    this.release();
    this.move(null, new THREE.Vector3(), (kind === 'top' ? DIRECTIONS.top : DIRECTIONS.oblique).clone().multiplyScalar(distance), 3);
  }

  frameAll(immediate = false) {
    this.release();
    this.move(null, new THREE.Vector3(), DIRECTIONS.oblique.clone().multiplyScalar(600), 2.5, immediate);
  }

  private move(anchor: string | null, target: THREE.Vector3, offset: THREE.Vector3, duration: number, immediate = false) {
    const center = anchor ? this.system.worldPositionOf(anchor) : target;
    this.lastFollowPos.copy(center);
    if (immediate) { this.setImmediate(center.clone().add(offset), center); return; }
    this.flight = {
      fromPos: this.controls.object.position.clone(),
      fromTarget: this.controls.target.clone(), offset, anchor, target, elapsed: 0, duration,
    };
  }

  setImmediate(pos: THREE.Vector3, target: THREE.Vector3) {
    this.controls.object.position.copy(pos);
    this.controls.target.copy(target);
    this.controls.object.lookAt(target);
    this.flight = null;
  }

  update(dt: number) {
    if (this.flight) {
      const f = this.flight;
      const center = f.anchor ? this.system.worldPositionOf(f.anchor) : f.target;
      f.elapsed += dt;
      const k = Math.min(1, f.elapsed / f.duration);
      const e = k * k * (3 - 2 * k);
      this.controls.object.position.lerpVectors(f.fromPos, center.clone().add(f.offset), e);
      this.controls.target.lerpVectors(f.fromTarget, center, e);
      this.lastFollowPos.copy(center);
      if (k === 1) this.flight = null;
    } else if (this.followId) {
      const p = this.system.worldPositionOf(this.followId);
      this.controls.object.position.add(p.clone().sub(this.lastFollowPos));
      this.controls.target.copy(p);
      this.lastFollowPos.copy(p);
    }
    this.controls.update(dt);
  }
}
