import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { SolarSystem } from './SolarSystem';

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface Tween {
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  t: number;
  dur: number;
}

export class CameraRig {
  readonly controls: OrbitControls;
  private tween: Tween | null = null;
  private followId: string | null = null;
  private lastFollowPos = new THREE.Vector3();
  private system: SolarSystem;

  constructor(camera: THREE.PerspectiveCamera, dom: HTMLElement, system: SolarSystem) {
    this.system = system;
    this.controls = new OrbitControls(camera, dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 1.1;
    this.controls.panSpeed = 0.8;
    this.controls.minDistance = 0.02;
    this.controls.maxDistance = 400000;
    this.controls.screenSpacePanning = false;
  }

  get isAnimating() {
    return this.tween !== null;
  }

  /** 停止一切自动行为，交还控制权给用户 */
  release() {
    this.tween = null;
    this.followId = null;
  }

  focus(bodyId: string, opts: { immediate?: boolean; padding?: number } = {}) {
    const target = this.system.worldPositionOf(bodyId);
    const radius = Math.max(this.system.bodyRadiusWorld(bodyId), 0.05);
    const dist = radius * (opts.padding ?? 7);

    const dir = new THREE.Vector3()
      .subVectors(this.controls.object.position, this.controls.target)
      .normalize();
    if (!isFinite(dir.length()) || dir.lengthSq() === 0) dir.set(0.3, 0.25, 1).normalize();

    const toPos = target.clone().add(dir.multiplyScalar(dist));

    this.followId = bodyId;
    this.lastFollowPos.copy(target);

    if (opts.immediate) {
      this.controls.target.copy(target);
      this.controls.object.position.copy(toPos);
      this.tween = null;
      return;
    }

    this.tween = {
      fromPos: this.controls.object.position.clone(),
      toPos,
      fromTarget: this.controls.target.clone(),
      toTarget: target,
      t: 0,
      dur: 1.5,
    };
  }

  /** 拉远到能看见整个海王星轨道 */
  frameAll(immediate = false) {
    const target = new THREE.Vector3(0, 0, 0);
    const dist = 1250;
    const dir = new THREE.Vector3(0.42, 0.40, 1).normalize();
    const toPos = target.clone().add(dir.multiplyScalar(dist));
    this.followId = null;

    if (immediate) {
      this.controls.target.copy(target);
      this.controls.object.position.copy(toPos);
      this.tween = null;
      return;
    }
    this.tween = {
      fromPos: this.controls.object.position.clone(),
      toPos,
      fromTarget: this.controls.target.clone(),
      toTarget: target,
      t: 0,
      dur: 2.2,
    };
  }

  /** 直接把相机放到指定位置（无过渡） */
  setImmediate(pos: THREE.Vector3, target: THREE.Vector3) {
    this.controls.object.position.copy(pos);
    this.controls.target.copy(target);
    this.tween = null;
  }

  update(dt: number) {
    if (this.tween) {
      this.tween.t += dt;
      const k = Math.min(1, this.tween.t / this.tween.dur);
      const e = easeInOut(k);
      this.controls.object.position.lerpVectors(this.tween.fromPos, this.tween.toPos, e);
      this.controls.target.lerpVectors(this.tween.fromTarget, this.tween.toTarget, e);
      if (k >= 1) this.tween = null;
    } else if (this.followId) {
      const pos = this.system.worldPositionOf(this.followId);
      const delta = pos.clone().sub(this.lastFollowPos);
      this.controls.object.position.add(delta);
      this.controls.target.copy(pos);
      this.lastFollowPos.copy(pos);
    }

    this.controls.update();
  }
}
