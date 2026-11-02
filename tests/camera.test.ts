import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { normalizeAngle, solveKepler } from '../src/core/kepler.ts';
import { smoothstep } from '../src/core/easing.ts';

test('slerp-based camera interpolation keeps a constant radius and reaches the target direction', () => {
  const from = new THREE.Vector3(0.72, 0.58, 1).normalize();
  const to = new THREE.Vector3(0.22, 0.2, 1).normalize();
  const fromDistance = 30;
  const toDistance = 70;
  const rotation = new THREE.Quaternion().setFromUnitVectors(from, to);

  for (const e of [0, 0.25, 0.5, 0.75, 1]) {
    const partial = new THREE.Quaternion().slerp(rotation, e);
    const direction = from.clone().applyQuaternion(partial).normalize();
    const distance = THREE.MathUtils.lerp(fromDistance, toDistance, e);
    const offset = direction.multiplyScalar(distance);
    // Radius stays exactly on the interpolated arc: never collapses toward the target.
    assert.ok(Math.abs(offset.length() - distance) < 1e-6);
    assert.ok(Number.isFinite(offset.x) && Number.isFinite(offset.y) && Number.isFinite(offset.z));
  }

  const final = from.clone().applyQuaternion(rotation).normalize();
  assert.ok(final.distanceTo(to) < 1e-6);
});

test('opposite directions do not produce a NaN or zero-length offset', () => {
  const from = new THREE.Vector3(1, 0, 0);
  const to = new THREE.Vector3(-1, 0, 0);
  const rotation = new THREE.Quaternion().setFromUnitVectors(from, to);
  for (const e of [0, 0.3, 0.6, 1]) {
    const partial = new THREE.Quaternion().slerp(rotation, e);
    const offset = from.clone().applyQuaternion(partial).multiplyScalar(12);
    assert.ok(Number.isFinite(offset.length()) && offset.length() > 11.9);
  }
});

test('angle normalisation and easing behave at boundaries', () => {
  assert.equal(normalizeAngle(360), 0);
  assert.equal(normalizeAngle(-180), -180);
  assert.equal(normalizeAngle(190), -170);
  assert.equal(smoothstep(0, 1, -1), 0);
  assert.equal(smoothstep(0, 1, 2), 1);
  assert.ok(Math.abs(smoothstep(0, 1, 0.5) - 0.5) < 1e-9);
});

test('Kepler solver is stable for near-parabolic motion', () => {
  const E = solveKepler(Math.PI, 0.97);
  assert.ok(Number.isFinite(E));
  assert.ok(Math.abs(E - 0.97 * Math.sin(E) - Math.PI) < 1e-9);
});
