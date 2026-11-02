import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Comet } from '../render/Comet';
import {
  DEG,
  elementsAt,
  normalizeAngle,
  orbitBasis,
  positionFromBasis,
  sampleOrbit,
  solveKepler,
  type OrbitBasis,
} from '../core/kepler';
import { BODIES, realRadius, type Body } from '../data/bodies';
import { ATMOSPHERES, LOOKS } from '../data/looks';
import { createBodyTextures, createGlowTexture, createHazeTexture, createRingTexture } from '../render/textures';
import { createCloudMaterial, createHaloMaterial, createPlanetMaterial } from '../render/materials';
import { createBelt, type Belt } from '../render/belts';
import { createGalaxy, createStarField, createStarSpriteMaterial, type StarField } from '../render/sky';

/** 1 AU 对应多少世界单位 */
export const AU_SCALE = 100;

export interface BodyNode {
  body: Body;
  /** 在黄道坐标系中的位置容器 */
  holder: THREE.Group;
  /** 自转倾斜枢轴 */
  pivot: THREE.Group;
  mesh: THREE.Mesh | null;
  material: THREE.ShaderMaterial | null;
  cloudMesh: THREE.Mesh | null;
  cloudMaterial: THREE.ShaderMaterial | null;
  halo: THREE.Mesh | null;
  haloMaterial: THREE.ShaderMaterial | null;
  glow: THREE.Sprite | null;
  ring: THREE.Mesh | null;
  ringMaterial: THREE.ShaderMaterial | null;
  /** 黄道坐标位置 */
  ecliptic: THREE.Vector3;
  /** 世界坐标位置 */
  world: THREE.Vector3;
  /** 轨道基向量缓存 */
  basis: OrbitBasis | null;
  /** 当前显示半径 */
  displayRadius: number;
  /** 卫星相对母天体的局部位置 */
  local: THREE.Vector3;
  /** 归一化尺寸倍率（真实比例模式用） */
  sizeScale: number;
}

export interface OrbitLine {
  body: Body;
  line: THREE.LineLoop;
  material: THREE.LineBasicMaterial;
}

export interface Trail {
  body: Body;
  positions: Float32Array;
  colors: Float32Array;
  geometry: THREE.BufferGeometry;
  line: THREE.Line;
  pts: number[];
  cols: number[];
}

interface RingGeometryOptions {
  inner: number;
  outer: number;
  segments: number;
}

function createRingGeometry({ inner, outer, segments }: RingGeometryOptions): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const ang = t * Math.PI * 2;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    positions.push(inner * c, 0, inner * s);
    positions.push(outer * c, 0, outer * s);
    uvs.push(0, t, 1, t);
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const RING_FRAG = /* glsl */ `
precision mediump float;
#include <common>
#include <logdepthbuf_pars_fragment>
varying vec2 vUv;
varying vec3 vWorldPos;
uniform sampler2D uMap;
uniform float uBrightness;
uniform vec3  uSunDir;
uniform vec3  uPlanetCenter;
uniform float uPlanetRadius;

void main(){
  vec4 t = texture2D(uMap, vUv);
  if (t.a < 0.01) discard;

  // The planet's shadow on the rings: a soft cylinder along the sun direction.
  vec3 L = normalize(uSunDir);
  vec3 toC = uPlanetCenter - vWorldPos;
  float along = dot(toC, L);
  float perp = length(toC - L * along);
  // Soft penumbra, and only on the anti-sun side.
  float shadow = along > 0.0 ? 1.0 - smoothstep(uPlanetRadius * 0.82, uPlanetRadius * 1.22, perp) : 0.0;

  vec3 col = t.rgb * uBrightness * (1.0 - 0.72 * shadow);
  gl_FragColor = vec4(col, t.a * (1.0 - 0.35 * shadow));
  #include <logdepthbuf_fragment>
}
`;

const RING_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
varying vec3 vWorldPos;
void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}
`;

export interface SolarSystemOptions {
  container: HTMLElement;
}

export class SolarSystem {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly ecliptic = new THREE.Group();
  readonly comet = new Comet();
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;

  readonly nodes = new Map<string, BodyNode>();
  readonly orbitLines: OrbitLine[] = [];
  readonly trails = new Map<string, Trail>();

  private belt!: Belt;
  private kuiper!: Belt;
  private stars: StarField;
  private galaxy: THREE.Mesh;
  private ringTexture: THREE.Texture;
  private starSpriteMat: THREE.SpriteMaterial;
  private glowTexture: THREE.Texture;
  private moonOrbits = new Map<string, THREE.LineLoop>();
  private lastTrailDay: number | null = null;
  private lastOrbitCentury = Infinity;

  /** 0 = 每个天体与卫星距离的真实尺度；1 = 视觉夸张 */
  sizeScale = 1;

  constructor(opts: SolarSystemOptions) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      logarithmicDepthBuffer: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(opts.container.clientWidth, opts.container.clientHeight);
    this.renderer.setClearColor(0x000308, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    opts.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      55,
      opts.container.clientWidth / opts.container.clientHeight,
      0.01,
      4_000_000,
    );

    // 黄道坐标系 → 场景坐标系：绕 X 轴 -90°，使黄北极指向世界 +Y
    this.ecliptic.rotation.x = -Math.PI / 2;
    this.scene.add(this.ecliptic);

    // 背景
    this.stars = createStarField(9000, 1_200_000, 20240611);
    this.scene.add(this.stars.points);
    this.galaxy = createGalaxy(1_500_000);
    this.scene.add(this.galaxy);

    this.ringTexture = createRingTexture();
    this.starSpriteMat = createStarSpriteMaterial();
    this.glowTexture = createGlowTexture();

    this.buildBodies();
    this.buildBelts();
    this.buildHaze();
    this.ecliptic.add(this.comet.group);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(opts.container.clientWidth, opts.container.clientHeight), 0.4, 0.5, 0.85);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  setBloom(enabled: boolean) { this.bloom.enabled = enabled; }

  /** 小行星带 / 柯伊伯带的弥散尘埃盘 */
  private buildHaze() {
    const add = (innerAU: number, outerAU: number, gaps: number[], opacity: number, color: number) => {
      const tex = createHazeTexture(gaps);
      const mat = new THREE.ShaderMaterial({
        vertexShader: HAZE_VERT,
        fragmentShader: HAZE_FRAG,
        uniforms: {
          uMap: { value: tex },
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: opacity },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(
        createRingGeometry({ inner: innerAU * AU_SCALE, outer: outerAU * AU_SCALE, segments: 192 }),
        mat,
      );
      mesh.rotation.x = Math.PI / 2;
      mesh.frustumCulled = false;
      this.ecliptic.add(mesh);
    };

    // 柯克伍德空隙
    add(2.06, 3.42, [0.30, 0.44, 0.62, 0.80], 0.20, 0xc8b89a);
    add(35.5, 52, [], 0.34, 0x9fb4d8);
  }

  /* ---------------------------------------------------------------- */

  private buildBodies() {
    for (const body of BODIES) {
      const node: BodyNode = {
        body,
        holder: new THREE.Group(),
        pivot: new THREE.Group(),
        mesh: null,
        material: null,
        cloudMesh: null,
        cloudMaterial: null,
        halo: null,
        haloMaterial: null,
        glow: null,
        ring: null,
        ringMaterial: null,
        ecliptic: new THREE.Vector3(),
        world: new THREE.Vector3(),
        basis: null,
        displayRadius: body.displayRadius,
        local: new THREE.Vector3(),
        sizeScale: 1,
      };

      const isSun = body.type === 'star';

      // 太阳
      if (isSun) {
        const look = LOOKS[body.id];
        const tex = createBodyTextures(this.renderer, 'sun', 3.1, look);
        const mat = new THREE.ShaderMaterial({
          vertexShader: SUN_VERTEX,
          fragmentShader: SUN_FRAGMENT,
          uniforms: {
            uMap: { value: tex.day },
            uTime: { value: 0 },
            uIntensity: { value: 1.25 },
          },
        });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), mat);
        mesh.frustumCulled = false;
        node.pivot.add(mesh);
        node.mesh = mesh;
        node.material = mat;

        const glow = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: this.glowTexture,
            color: 0xfff0cc,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: false,
          }),
        );
        glow.renderOrder = 6;
        node.pivot.add(glow);
        node.glow = glow;
      } else {
        const look = LOOKS[body.id];
        const tex = createBodyTextures(
          this.renderer,
          body.texture,
          hashSeed(body.id),
          look,
          body.type === 'moon' ? 256 : 1024,
        );
        const atmo = ATMOSPHERES[body.id];

        const mat = createPlanetMaterial({
          day: tex.day,
          night: tex.night,
          rimColor: atmo?.rim ?? body.color,
          rimStrength: atmo?.rimStrength ?? 0.12,
          atmoColor: atmo?.color ?? body.color,
          atmoStrength: atmo?.strength ?? 0,
        });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), mat);
        mesh.frustumCulled = false;
        node.pivot.add(mesh);
        node.mesh = mesh;
        node.material = mat;

        if (tex.clouds) {
          const cm = createCloudMaterial(tex.clouds);
          const cm2 = new THREE.Mesh(new THREE.SphereGeometry(1.012, 64, 48), cm);
          cm2.frustumCulled = false;
          node.pivot.add(cm2);
          node.cloudMesh = cm2;
          node.cloudMaterial = cm;
        }

        if (atmo && atmo.strength > 0) {
          const hm = createHaloMaterial(atmo.color, atmo.strength);
          const halo = new THREE.Mesh(new THREE.SphereGeometry(1.055, 48, 32), hm);
          halo.frustumCulled = false;
          node.pivot.add(halo);
          node.halo = halo;
          node.haloMaterial = hm;
        }

        // 柔光精灵：远景时仍能看见
        const glow = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: this.starSpriteMat.map,
            color: body.color,
            transparent: true,
            opacity: body.type === 'moon' ? 0.3 : 0.34,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        glow.renderOrder = 3;
        node.pivot.add(glow);
        node.glow = glow;

        // 行星环
        if (body.rings) {
          const rm = new THREE.ShaderMaterial({
            vertexShader: RING_VERT,
            fragmentShader: RING_FRAG,
            uniforms: {
              uMap: { value: this.ringTexture },
              uBrightness: { value: 0.72 },
              uSunDir: { value: new THREE.Vector3(1, 0, 0) },
              uPlanetCenter: { value: new THREE.Vector3() },
              uPlanetRadius: { value: 1 },
            },
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
          const ring = new THREE.Mesh(createRingGeometry({ inner: 1.11, outer: 2.32, segments: 256 }), rm);
          ring.frustumCulled = false;
          node.pivot.add(ring);
          node.ring = ring;
          node.ringMaterial = rm;
        }
      }

      node.holder.add(node.pivot);
      this.ecliptic.add(node.holder);
      this.nodes.set(body.id, node);

      if (body.elements) this.buildOrbitLine(body);
      if (body.type === 'planet' || body.type === 'dwarf') this.buildTrail(body);
    }

    // 卫星轨道挂在母天体的 holder 下
    for (const body of BODIES) {
      if (!body.moon) continue;
      const parent = this.nodes.get(body.parent!)!;
      const node = this.nodes.get(body.id)!;
      parent.holder.add(node.holder);
      this.buildMoonOrbit(body);
    }
  }

  private buildOrbitLine(body: Body) {
    const el = body.elements!;
    const raw = sampleOrbit(el, 512);
    const pts = new Float32Array(raw.length);
    for (let i = 0; i < raw.length; i += 3) {
      pts[i] = raw[i] * AU_SCALE;
      pts[i + 1] = raw[i + 1] * AU_SCALE;
      pts[i + 2] = raw[i + 2] * AU_SCALE;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const material = new THREE.LineBasicMaterial({
      color: body.color,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const line = new THREE.LineLoop(geo, material);
    line.frustumCulled = false;
    this.ecliptic.add(line);
    this.orbitLines.push({ body, line, material });
  }

  private buildMoonOrbit(body: Body) {
    const m = body.moon!;
    // Unit ellipse about the parent, not about the moving moon.
    const pts = new Float32Array(128 * 3);
    for (let j = 0; j < 128; j++) {
      const E = j / 128 * Math.PI * 2;
      pts[j * 3] = Math.cos(E) - m.e;
      pts[j * 3 + 1] = Math.sqrt(1 - m.e * m.e) * Math.sin(E);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const material = new THREE.LineBasicMaterial({ color: body.color, transparent: true, opacity: 0.22, depthWrite: false });
    const loop = new THREE.LineLoop(geo, material);
    loop.frustumCulled = false;
    this.nodes.get(body.parent!)!.holder.add(loop);
    this.moonOrbits.set(body.id, loop);
  }

  setOrbitsVisible(visible: boolean) {
    for (const o of this.orbitLines) o.line.visible = visible;
    for (const o of this.moonOrbits.values()) o.visible = visible;
  }

  clearTrails() {
    for (const t of this.trails.values()) {
      t.pts.length = t.cols.length = 0;
      t.geometry.setDrawRange(0, 0);
    }
    this.lastTrailDay = null;
  }

  private buildTrail(body: Body) {
    const MAX = 256;
    const positions = new Float32Array(MAX * 3);
    const colors = new Float32Array(MAX * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setDrawRange(0, 0);
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    this.ecliptic.add(line);
    this.trails.set(body.id, { body, positions, colors, geometry: geo, line, pts: [], cols: [] });
  }

  private buildBelts() {
    this.belt = createBelt({
      count: 4200,
      aMin: 2.1,
      aMax: 3.4,
      eMax: 0.22,
      iMax: 14,
      sizeMin: 0.035,
      sizeMax: 0.1,
      color: [0.55, 0.5, 0.42],
      seed: 991,
    });
    this.ecliptic.add(this.belt.mesh);

    this.kuiper = createBelt({
      count: 2600,
      aMin: 36,
      aMax: 52,
      eMax: 0.18,
      iMax: 16,
      sizeMin: 0.22,
      sizeMax: 0.7,
      color: [0.42, 0.48, 0.62],
      seed: 1771,
    });
    this.ecliptic.add(this.kuiper.mesh);
  }

  /* ---------------------------------------------------------------- */

  /** 更新整个系统到指定时刻（儒略日） */
  update(daysSinceJ2000: number, centuries: number) {
    const toSun = new THREE.Vector3();
    const camPos = this.camera.position;
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);

    for (const node of this.nodes.values()) {
      const body = node.body;

      if (body.elements) {
        const el = elementsAt(body.elements, body.rates, centuries);
        const basis = orbitBasis(el);
        node.basis = basis;
        const pos = positionFromBasis(basis, el.a, el.e, el.L - el.peri);
        node.ecliptic.set(pos.x * AU_SCALE, pos.y * AU_SCALE, pos.z * AU_SCALE);
        node.holder.position.copy(node.ecliptic);
      } else if (body.moon) {
        const m = body.moon;
        const nodeDeg = m.nodeDeg + m.nodeRate * centuries;
        const basis = moonBasis(nodeDeg, m.i);
        const meanAnom = normalizeAngle(m.phaseDeg + (360 * daysSinceJ2000) / m.periodDays);
        const E = solveKepler(meanAnom * DEG, m.e);
        const xp = Math.cos(E) - m.e;
        const yp = Math.sqrt(Math.max(0, 1 - m.e * m.e)) * Math.sin(E);
        const blend = Math.pow(this.sizeScale, 3.2);
        const radius = THREE.MathUtils.lerp(m.aAU * AU_SCALE, m.displayOrbit, blend);
        const line = this.moonOrbits.get(body.id)!;
        line.scale.setScalar(radius);
        const ex = new THREE.Vector3(basis.ex.x, basis.ex.y, basis.ex.z);
        const ey = new THREE.Vector3(basis.ey.x, basis.ey.y, basis.ey.z);
        line.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ex, ey, ex.clone().cross(ey)));
        node.local.set(
          (basis.ex.x * xp + basis.ey.x * yp) * radius,
          (basis.ex.y * xp + basis.ey.y * yp) * radius,
          (basis.ex.z * xp + basis.ey.z * yp) * radius,
        );
        node.holder.position.copy(node.local);
      }

      // 尺寸
      const radius = THREE.MathUtils.lerp(realRadius(body), body.displayRadius, Math.pow(this.sizeScale, 3.2));
      node.displayRadius = radius;

      if (node.mesh) {
        node.mesh.scale.setScalar(radius);
        // SphereGeometry's pole is +Y; the ecliptic pole is +Z.
        node.pivot.rotation.x = (90 + body.tilt) * DEG;
        const spin = (daysSinceJ2000 * 24) / body.rotationHours;
        node.mesh.rotation.y = spin * Math.PI * 2;
      }
      if (node.cloudMesh) {
        node.cloudMesh.scale.setScalar(radius);
        node.cloudMesh.rotation.y = (daysSinceJ2000 * 24 / body.rotationHours) * Math.PI * 2 * 1.015;
      }
      if (node.halo) node.halo.scale.setScalar(radius);
      if (node.ring) node.ring.scale.setScalar(radius);
      if (node.glow) {
        const g = node.glow;
        const dist = camPos.distanceTo(node.world);
        if (body.type === 'star') {
          g.scale.setScalar(Math.max(radius * 10, dist * 0.012));
        } else {
          // 保证远处仍是一个可见的光点
          g.scale.setScalar(Math.max(radius * 3, dist * 0.005, 0.05));
        }
      }

      // 光照方向（太阳在原点）与可见性
      node.holder.getWorldPosition(node.world);
      if (node.world.lengthSq() > 1e-9) {
        toSun.copy(node.world).normalize().negate();
      } else {
        toSun.set(1, 0, 0);
      }

      // 巨大的发光精灵在相机背后时会被错误地画到屏幕上（GPU 不做近平面裁剪），
      // 这里直接关掉背对相机的辉光。
      if (node.glow) {
        const inFront = node.world.clone().sub(camPos).dot(camDir) > 0;
        node.glow.visible = inFront;
      }

      if (node.material) {
        const u = node.material.uniforms.uSunDir;
        if (u) u.value.copy(toSun);
      }
      if (node.cloudMaterial) {
        node.cloudMaterial.uniforms.uSunDir.value.copy(toSun);
      }
      if (node.haloMaterial) {
        node.haloMaterial.uniforms.uSunDir.value.copy(toSun);
      }
      if (node.ringMaterial) {
        const u = node.ringMaterial.uniforms;
        u.uSunDir.value.copy(toSun);
        u.uPlanetCenter.value.copy(node.world);
        u.uPlanetRadius.value = radius;
      }
    }

    // Do not accumulate identical samples while paused, or draw a chord across a date jump.
    if (this.lastTrailDay === null || Math.abs(daysSinceJ2000 - this.lastTrailDay) > 1e-9) {
      if (this.lastTrailDay !== null && Math.abs(daysSinceJ2000 - this.lastTrailDay) > 400) this.clearTrails();
      this.updateTrails();
      this.lastTrailDay = daysSinceJ2000;
    }
    if (Math.abs(centuries - this.lastOrbitCentury) > 0.0001) {
      for (const o of this.orbitLines) {
        const pts = sampleOrbit(elementsAt(o.body.elements!, o.body.rates, centuries), 512);
        for (let j = 0; j < pts.length; j++) pts[j] *= AU_SCALE;
        (o.line.geometry.attributes.position as THREE.BufferAttribute).array.set(pts);
        o.line.geometry.attributes.position.needsUpdate = true;
      }
      this.lastOrbitCentury = centuries;
    }

    this.belt.material.uniforms.uDays.value = daysSinceJ2000;
    this.kuiper.material.uniforms.uDays.value = daysSinceJ2000;
    this.comet.update(daysSinceJ2000);
  }

  private updateTrails() {
    const MAX = 256;
    for (const trail of this.trails.values()) {
      const node = this.nodes.get(trail.body.id)!;
      trail.pts.push(node.ecliptic.x, node.ecliptic.y, node.ecliptic.z);
      if (trail.pts.length > MAX * 3) trail.pts.splice(0, 3);

      const n = trail.pts.length / 3;
      const c = new THREE.Color(trail.body.color);
      for (let j = 0; j < n; j++) {
        const k = n <= 1 ? 1 : j / (n - 1);
        const f = k * k * k;
        trail.cols[j * 3] = c.r * f;
        trail.cols[j * 3 + 1] = c.g * f;
        trail.cols[j * 3 + 2] = c.b * f;
      }

      trail.positions.set(trail.pts);
      trail.colors.set(trail.cols.slice(0, n * 3));
      trail.geometry.attributes.position.needsUpdate = true;
      trail.geometry.attributes.color.needsUpdate = true;
      trail.geometry.setDrawRange(0, n);
    }
  }

  /* ---------------------------------------------------------------- */

  worldPositionOf(id: string): THREE.Vector3 {
    const node = this.nodes.get(id);
    if (!node) return new THREE.Vector3();
    const v = new THREE.Vector3();
    node.holder.getWorldPosition(v);
    return v;
  }

  bodyRadiusWorld(id: string): number {
    return this.nodes.get(id)?.displayRadius ?? 0;
  }

  pick(raycaster: THREE.Raycaster): string | null {
    const meshes: THREE.Object3D[] = [];
    for (const node of this.nodes.values()) {
      if (node.mesh) meshes.push(node.mesh);
    }
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return null;
    const obj = hits[0].object;
    for (const [id, node] of this.nodes) {
      if (node.mesh === obj) return id;
    }
    return null;
  }

  setSize(w: number, h: number) {
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(elapsed: number) {
    this.stars.material.uniforms.uTime.value = elapsed;
    for (const node of this.nodes.values()) {
      if (node.material && node.body.type === 'star') {
        node.material.uniforms.uTime.value = elapsed;
      }
    }
    this.composer.render();
  }
}

const HAZE_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
varying vec3 vWorldPos;
void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}
`;

const HAZE_FRAG = /* glsl */ `
precision mediump float;
#include <common>
#include <logdepthbuf_pars_fragment>
varying vec2 vUv;
varying vec3 vWorldPos;
uniform sampler2D uMap;
uniform vec3 uColor;
uniform float uOpacity;
void main(){
  float a = texture2D(uMap, vUv).a;
  if (a < 0.004) discard;
  vec3 col = uColor * a * uOpacity;
  gl_FragColor = vec4(col, a * uOpacity);
  #include <logdepthbuf_fragment>
}
`;

/* ------------------------------------------------------------------ */

function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 7 + 1;
}

function moonBasis(nodeDeg: number, incDeg: number): OrbitBasis {
  const N = nodeDeg * DEG;
  const i = incDeg * DEG;
  const cN = Math.cos(N);
  const sN = Math.sin(N);
  const ci = Math.cos(i);
  const si = Math.sin(i);
  return {
    ex: { x: cN, y: sN, z: 0 },
    ey: { x: -sN * ci, y: cN * ci, z: si },
  };
}

/* 太阳着色器（内联以避免循环依赖） */
const SUN_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vWorldPos;
void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}
`;

const SUN_FRAGMENT = /* glsl */ `
precision highp float;
#include <common>
#include <logdepthbuf_pars_fragment>
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vWorldPos;
uniform sampler2D uMap;
uniform float uTime;
uniform float uIntensity;
void main(){
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float ndv = max(dot(N, V), 0.0);
  float limb = pow(ndv, 0.42);
  vec3 tex = texture2D(uMap, vUv).rgb;
  vec3 col = tex * (0.88 + 0.28 * (1.0 - ndv));
  col *= mix(0.70, 1.30, limb);
  col *= uIntensity;
  gl_FragColor = vec4(col, 1.0);
  #include <logdepthbuf_fragment>
}
`;
