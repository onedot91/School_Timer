import test from 'node:test';
import assert from 'node:assert/strict';
import { requiresStudentEditRevisions } from '../../src/server/storageClientContract.js';

test('deployed production requires protected student writes with an explicit rollout override', () => {
  const originalEnvironment = process.env.VERCEL_ENV;
  const originalRequirement = process.env.STORAGE_REQUIRE_EDIT_REVISIONS;
  try {
    for (const [environment, requirement, expected] of [
      ['production', undefined, true],
      ['production', '0', false],
      ['production', '1', true],
      ['preview', undefined, false],
      ['preview', '1', true],
      ['development', undefined, false],
      [undefined, undefined, false],
    ] as const) {
      if (environment === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = environment;
      if (requirement === undefined) delete process.env.STORAGE_REQUIRE_EDIT_REVISIONS;
      else process.env.STORAGE_REQUIRE_EDIT_REVISIONS = requirement;
      assert.equal(requiresStudentEditRevisions(), expected, `${environment}/${requirement}`);
    }
  } finally {
    if (originalEnvironment === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalEnvironment;
    if (originalRequirement === undefined) delete process.env.STORAGE_REQUIRE_EDIT_REVISIONS;
    else process.env.STORAGE_REQUIRE_EDIT_REVISIONS = originalRequirement;
  }
});
