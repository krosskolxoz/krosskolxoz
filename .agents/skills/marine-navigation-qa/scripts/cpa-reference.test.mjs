import { describe, expect, test } from 'vitest';
import { computeReferenceCpa } from './cpa-reference.mjs';
import { fixtures, options, expectCpa } from './cpa-test-utils.mjs';

describe('CPA reference tooling — not application validation', () => {
  test.each(fixtures.cases)('$id: hand-derived expected values', ({ input, expected }) => {
    expectCpa(computeReferenceCpa(input, options), expected);
  });

  test.each(fixtures.cases)('$id: translation, rotation, common velocity, vessel swap', ({ input, expected }) => {
    const map = (transform) => Object.fromEntries(Object.entries(input).map(([key, vessel]) => [key, transform(vessel)]));
    const translated = map((s) => ({ ...s, positionM: [s.positionM[0] + 120, s.positionM[1] - 75] }));
    const rotated = map((s) => ({ positionM: [-s.positionM[1], s.positionM[0]], velocityMps: [-s.velocityMps[1], s.velocityMps[0]] }));
    // Binary-exact offsets avoid changing the epsilon boundary by rounding.
    const commonVelocity = map((s) => ({ ...s, velocityMps: [s.velocityMps[0], s.velocityMps[1] + 8] }));
    for (const variant of [translated, rotated, commonVelocity, { own: input.target, target: input.own }]) {
      expectCpa(computeReferenceCpa(variant, options), expected);
    }
  });

  test.each([NaN, Infinity, -Infinity, '5', undefined])('rejects invalid vector component %s', (value) => {
    const input = structuredClone(fixtures.cases[0].input);
    input.target.positionM[0] = value;
    expect(() => computeReferenceCpa(input, options)).toThrow(TypeError);
  });

  test.each([undefined, {}, { own: { positionM: [0], velocityMps: [0, 0] } }])('rejects malformed vessels: %j', (input) => {
    expect(() => computeReferenceCpa(input, options)).toThrow(TypeError);
  });

  test.each([-1, NaN, Infinity])('rejects invalid relative-speed epsilon %s', (relativeSpeedEpsilonMps) => {
    expect(() => computeReferenceCpa(fixtures.cases[0].input, { relativeSpeedEpsilonMps })).toThrow(RangeError);
  });

  test('rejects sparse vectors instead of returning NaN', () => {
    const input = structuredClone(fixtures.cases[0].input);
    input.target.positionM = Array(2);
    expect(() => computeReferenceCpa(input, options)).toThrow(TypeError);
  });

  test('rejects numeric overflow instead of returning NaN', () => {
    const input = structuredClone(fixtures.cases[0].input);
    input.target.velocityMps = [Number.MAX_VALUE, 0];
    expect(() => computeReferenceCpa(input, options)).toThrow(RangeError);
  });
});
