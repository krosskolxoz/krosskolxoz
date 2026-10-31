import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, test } from 'vitest';
import { fixtures, options, expectCpa } from './cpa-test-utils.mjs';

const modulePath = process.env.MARINE_CPA_MODULE;

describe.skipIf(!modulePath)('Production CPA adapter — requires MARINE_CPA_MODULE', () => {
  let computeCpa;
  beforeAll(async () => {
    if (!isAbsolute(modulePath)) throw new Error('MARINE_CPA_MODULE must be an absolute ES module path');
    ({ computeCpa } = await import(pathToFileURL(modulePath).href));
    expect(computeCpa, 'adapter must export computeCpa').toBeTypeOf('function');
  });

  test.each(fixtures.cases)('$id: actual application calculation', async ({ input, expected }) => {
    expectCpa(await computeCpa(structuredClone(input), options), expected);
  });
});
