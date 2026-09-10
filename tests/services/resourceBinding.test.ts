import {
  extractTargetRef,
  stripSecretArgs,
} from '../../src/services/resourceService.js';

describe('resourceService helpers', () => {
  it('extracts target from several argument names', () => {
    expect(extractTargetRef({ target: 'energy-prod' })).toBe('energy-prod');
    expect(extractTargetRef({ targetName: 'uat' })).toBe('uat');
    expect(extractTargetRef({ target_id: 'abc' })).toBe('abc');
    expect(extractTargetRef({})).toBeUndefined();
  });

  it('strips password and token from tool arguments', () => {
    const sanitized = stripSecretArgs({
      target: 'energy-prod',
      sql: 'select 1',
      password: 'secret',
      token: 'tok',
    });
    expect(sanitized).toEqual({ target: 'energy-prod', sql: 'select 1' });
    expect(JSON.stringify(sanitized)).not.toMatch(/secret|tok/);
  });
});
