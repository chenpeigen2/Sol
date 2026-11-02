import * as THREE from 'three';
import { orbitBasis, positionFromBasis } from '../core/kepler';
import { createStarTexture } from './textures';

/** A deliberately illustrative comet, not a predictive Halley ephemeris. */
export class Comet {
  readonly group = new THREE.Group();
  private positions = new Float32Array(1200 * 3);
  private colors = new Float32Array(1200 * 3);
  private particles: THREE.Points;
  private head: THREE.Sprite;
  private orbit;
  private basis;
  private seeds: number[] = [];
  private previous = new THREE.Vector3();
  readonly position = new THREE.Vector3();
  enabled = true;

  constructor() {
    this.orbit = { a: 8, e: 0.86, i: 58, L: 0, peri: 55, node: 35 };
    this.basis = orbitBasis(this.orbit);
    let seed = 77;
    for (let j = 0; j < 4800; j++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      this.seeds.push(seed / 4294967296);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.particles = new THREE.Points(geometry, new THREE.PointsMaterial({
      size: 1.4, map: createStarTexture(), transparent: true,
      vertexColors: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.particles.frustumCulled = false;
    this.group.add(this.particles);
    this.head = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createStarTexture(), color: 0xb7eeff, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.head.scale.setScalar(7);
    this.group.add(this.head);

    const points: THREE.Vector3[] = [];
    for (let j = 0; j < 512; j++) {
      const E = j / 512 * Math.PI * 2;
      const x = this.orbit.a * (Math.cos(E) - this.orbit.e) * 100;
      const y = this.orbit.a * Math.sqrt(1 - this.orbit.e ** 2) * Math.sin(E) * 100;
      points.push(new THREE.Vector3(this.basis.ex.x*x + this.basis.ey.x*y, this.basis.ex.y*x + this.basis.ey.y*y, this.basis.ex.z*x + this.basis.ey.z*y));
    }
    this.group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x7dd7e8, transparent: true, opacity: 0.12, depthWrite: false })));
  }

  update(days: number) {
    this.group.visible = this.enabled;
    if (!this.enabled) return;
    const mean = days / (365.25 * 8 ** 1.5) * 360;
    const p = positionFromBasis(this.basis, 8, 0.86, mean);
    const prev = positionFromBasis(this.basis, 8, 0.86, mean - 0.03);
    this.position.set(p.x, p.y, p.z).multiplyScalar(100);
    this.previous.set(prev.x, prev.y, prev.z).multiplyScalar(100);
    const away = this.position.clone().normalize();
    const tangent = this.position.clone().sub(this.previous).normalize();
    const side = away.clone().cross(new THREE.Vector3(0, 0, 1)).normalize();
    const up = side.clone().cross(away).normalize();
    const activity = Math.min(1, 5 / (this.position.length() / 100) ** 2);
    this.head.position.copy(this.position);
    this.head.material.opacity = 0.4 + 0.6 * activity;
    for (let j = 0; j < 1200; j++) {
      const ion = j < 500;
      const t = this.seeds[j * 4];
      const length = t * (ion ? 115 : 80) * activity;
      const width = (ion ? 0.6 : 1.8) * (0.4 + t * 4);
      const angle = this.seeds[j * 4 + 1] * Math.PI * 2;
      const radial = Math.sqrt(this.seeds[j * 4 + 2]) * width;
      const v = this.position.clone().addScaledVector(away, length)
        .addScaledVector(tangent, ion ? -length * 0.08 : -length * t * 0.7)
        .addScaledVector(side, Math.cos(angle) * radial)
        .addScaledVector(up, Math.sin(angle) * radial);
      this.positions.set(v.toArray(), j * 3);
      const f = (1 - t) * activity * (0.35 + this.seeds[j * 4 + 3] * 0.65);
      this.colors.set(ion ? [0.2*f, 0.65*f, f] : [f, 0.7*f, 0.35*f], j * 3);
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
    this.particles.geometry.attributes.color.needsUpdate = true;
  }
}
