import { readFileSync } from 'node:fs';
import { expect } from 'vitest';

export const fixtures = JSON.parse(readFileSync(new URL('../assets/cpa-cases.json', import.meta.url), 'utf8'));
export const options = { relativeSpeedEpsilonMps: fixtures.relativeSpeedEpsilonMps };

export function expectCpa(actual, expected) {
  for (const key of ['tcpaSignedS', 'tcpaFutureS', 'dcpaFutureM']) {
    if (expected[key] === null) {
      expect(actual[key], key).toBeNull();
    } else {
      expect(Number.isFinite(actual[key]), `${key} must be finite`).toBe(true);
      expect(Math.abs(actual[key] - expected[key]), `${key}: absolute tolerance 1e-8`).toBeLessThanOrEqual(1e-8);
    }
  }
}
