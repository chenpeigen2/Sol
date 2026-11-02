import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { SolarSystem } from './SolarSystem';

export type ViewPreset = 'oblique' | 'top' | 'edge' | 'system' | 'ring';
const DIRECTIONS = {
  // A comfortable three-quarter view; clearly off the ecliptic plane.
  oblique: new THREE.Vector3(0.72, 0.58, 1).normalize(),
  top: new THREE.Vector3(0.001, 1, 0.001).normalize(),
  edge: new THREE.Vector3(0.4, 0.025, 1).normalize(),
  // Low elevation: Saturn's rings open into a wide ellipse.
  ring: new THREE.Vector3(0.22, 0.2, 1).normalize(),
};
interface Flight {
  /** Start direction, normalised. */
  fromDir: THREE.Vector3;
  /** Destination direction, normalised. */
  toDir: THREE.Vector3;
  fromDistance: number;
  toDistance: number;
  fromTarget: THREE.Vector3;
  anchor: string | null;
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
    this.controls.dampingFactor = 0.045;
    this.controls.rotateSpeed = 0.42;
    this.controls.zoomSpeed = 0.75;
    this.controls.panSpeed = 0.65;
    this.controls.minDistance = 0.003;
    this.controls.maxDistance = 400000;
    this.controls.screenSpacePanning = true;
    this.controls.addEventListener('start', () => { this.flight = null; });
  }

  get isAnimating() { return this.flight !== null; }

  release() { this.flight = null; this.followId = null; this.controls.autoRotate = false; }

  focus(id: string, opts: { immediate?: boolean; padding?: number; follow?: boolean; view?: ViewPreset } = {}) {
    const radius = Math.max(this.system.bodyRadiusWorld(id), 0.001);
    const view = opts.view ?? 'oblique';
    // Leave breathing room instead of filling the frame with the planet.
    let dist = radius * (opts.padding ?? (id === 'saturn' ? 11 : 7.5));
    if (view === 'system') {
      const span = Math.max(radius * 3, ...[...this.system.nodes.values()].filter(n => n.body.parent === id).map(n => n.holder.position.length()));
      dist = span * 3.4;
    }
    dist *= Math.max(1, 0.9 / this.system.camera.aspect);
    const dir = DIRECTIONS[view === 'system' ? 'oblique' : view];
    this.flyTo(id, dir, dist, opts.immediate ?? false, view === 'system' ? 4.2 : 3.6);
    this.followId = opts.follow === false ? null : id;
  }

  overview(kind: 'inner' | 'all' | 'top' = 'inner') {
    this.release();
    const dist = (kind === 'all' ? 10000 : 820) * Math.max(1, 0.9 / this.system.camera.aspect);
    this.flyTo(null, kind === 'top' ? DIRECTIONS.top : DIRECTIONS.oblique, dist, false, 4.8);
  }

  frameAll(immediate = false) {
    this.release();
    this.flyTo(null, DIRECTIONS.oblique, 820, immediate, 4.8);
  }

  /**
   * Move the camera to `anchor` and keep it at `distance` in direction `dir`.
   * Direction and distance are interpolated independently so the framing is
   * always predictable, however far the camera travels.
   */
  flyTo(anchor: string | null, dir: THREE.Vector3, distance: number, immediate = false, duration = 3.8) {
    const center = anchor ? this.system.worldPositionOf(anchor) : new THREE.Vector3();
    const fromTarget = this.controls.target.clone();
    const current = this.controls.object.position.clone().sub(fromTarget);
    const fromDistance = current.length();
    const fromDir = fromDistance > 1e-6 ? current.clone().normalize() : dir.clone();
    const toDir = dir.clone().normalize();

    this.lastFollowPos.copy(center);
    if (immediate) { this.setImmediate(center.clone().add(toDir.clone().multiplyScalar(distance)), center); return; }

    this.flight = {
      fromDir,
      toDir,
      fromDistance: fromDistance > 1e-6 ? fromDistance : distance,
      toDistance: distance,
      fromTarget,
      anchor,
      elapsed: 0,
      duration,
    };
  }

  setImmediate(pos: THREE.Vector3, target: THREE.Vector3) {
    this.controls.object.position.copy(pos);
    this.controls.target.copy(target);
    this.controls.object.lookAt(target);
    this.flight = null;
  }

  update(dt: number) {
    const f = this.flight;
    if (f) {
      f.elapsed += dt;
      const k = Math.min(1, f.elapsed / f.duration);
      // Gentle quintic ease: long travel without an abrupt launch or landing.
      const e = k < 0.5 ? 16 * k ** 5 : 1 - Math.pow(-2 * k + 2, 5) / 2;

      // Rotate the current view direction toward the target direction.
      const rotation = new THREE.Quaternion().setFromUnitVectors(f.fromDir, f.toDir);
      const partial = new THREE.Quaternion().slerp(rotation, e);
      const direction = f.fromDir.clone().applyQuaternion(partial).normalize();
      const distance = THREE.MathUtils.lerp(f.fromDistance, f.toDistance, e);

      const center = f.anchor ? this.system.worldPositionOf(f.anchor) : new THREE.Vector3();
      // A soft arc lifts the camera over the system instead of cutting through it.
      const lift = Math.sin(Math.PI * e) * Math.min(distance * 0.10, 260);
      const offset = direction.multiplyScalar(distance);
      offset.y += lift;

      this.controls.target.lerpVectors(f.fromTarget, center, e);
      this.controls.object.position.copy(this.controls.target).add(offset);
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
