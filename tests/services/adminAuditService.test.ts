import { redactAuditValue } from '../../src/services/adminAuditService.js';

describe('adminAuditService', () => {
  it('redacts secret fields before storing audit payloads', () => {
    const redacted = redactAuditValue({
      username: 'alice',
      grants: [{ name: 'jenkins', tools: ['job'] }],
      password: 'plain',
      token: 'ylune_abc',
    });
    expect(redacted).toEqual({
      username: 'alice',
      grants: [{ name: 'jenkins', tools: ['job'] }],
      password: '[redacted]',
      token: '[redacted]',
    });
  });
});
