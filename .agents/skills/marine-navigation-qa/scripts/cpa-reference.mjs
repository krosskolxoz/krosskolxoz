// Test oracle for local Cartesian, constant ground-velocity predictions only.
// This is not a vessel model or a production navigation implementation.
export function computeReferenceCpa(input, { relativeSpeedEpsilonMps = 1e-6 } = {}) {
  if (!Number.isFinite(relativeSpeedEpsilonMps) || relativeSpeedEpsilonMps < 0) {
    throw new RangeError('Relative-speed epsilon must be finite and nonnegative');
  }
  for (const vessel of [input?.own, input?.target]) {
    for (const key of ['positionM', 'velocityMps']) {
      const vector = vessel?.[key];
      if (!Array.isArray(vector) || vector.length !== 2 || !Number.isFinite(vector[0]) || !Number.isFinite(vector[1])) {
        throw new TypeError(`${key} must contain two finite EN components`);
      }
    }
  }
  const r = input.target.positionM.map((n, i) => n - input.own.positionM[i]);
  const v = input.target.velocityMps.map((n, i) => n - input.own.velocityMps[i]);
  const speed = Math.hypot(...v);
  const range = Math.hypot(...r);
  const speedSquared = v[0] ** 2 + v[1] ** 2;
  const dot = r[0] * v[0] + r[1] * v[1];
  if (![speed, range, speedSquared, dot].every(Number.isFinite)) {
    throw new RangeError('Inputs exceed the local Cartesian oracle numerical range');
  }
  if (speed <= relativeSpeedEpsilonMps) {
    return { tcpaSignedS: null, tcpaFutureS: 0, dcpaFutureM: range };
  }
  const tcpaSignedS = -dot / speedSquared;
  const tcpaFutureS = Math.max(0, tcpaSignedS);
  const dcpaFutureM = Math.hypot(r[0] + v[0] * tcpaFutureS, r[1] + v[1] * tcpaFutureS);
  if (![tcpaSignedS, tcpaFutureS, dcpaFutureM].every(Number.isFinite)) {
    throw new RangeError('CPA result exceeds the local Cartesian oracle numerical range');
  }
  return {
    tcpaSignedS: tcpaSignedS === 0 ? 0 : tcpaSignedS,
    tcpaFutureS,
    dcpaFutureM,
  };
}
