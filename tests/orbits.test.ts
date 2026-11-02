import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BODIES, realRadius } from '../src/data/bodies.ts';
import { elementsAt, orbitBasis, positionFromBasis, positionFromElements, solveKepler } from '../src/core/kepler.ts';

const distance = (a: { x: number; y: number; z: number }, b: typeof a) => Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

test('cached basis path agrees with direct orbital calculation at multiple epochs', () => {
  for (const body of BODIES) {
    if (!body.elements) continue;
    for (const T of [-1, 0, 0.25, 0.5]) {
      const el = elementsAt(body.elements, body.rates, T);
      const viaBasis = positionFromBasis(orbitBasis(el), el.a, el.e, el.L - el.peri);
      assert.ok(distance(viaBasis, positionFromElements(el)) < 1e-9, body.id);
    }
  }
});

test('Kepler solution satisfies its equation for planet eccentricities', () => {
  for (const e of [0, 0.0167, 0.25, 0.8]) {
    for (let M = -Math.PI; M <= Math.PI; M += 0.1) {
      const E = solveKepler(M, e);
      assert.ok(Math.abs(E - e * Math.sin(E) - M) < 1e-10);
    }
  }
});

test('physical scale preserves the Sun / Earth radius ratio', () => {
  const sun = BODIES.find(b => b.id === 'sun')!;
  const earth = BODIES.find(b => b.id === 'earth')!;
  assert.ok(Math.abs(realRadius(sun) / realRadius(earth) - sun.kmRadius / earth.kmRadius) < 1e-10);
});
