import { buildEnvPreflight, collectEnvRefNames } from '../../src/utils/envPreflight.js';

describe('envPreflight', () => {
  it('collects ${ENV} names and never includes values', () => {
    const names = collectEnvRefNames({
      env: { TOKEN: '${NIGHTINGALE_TOKEN}', OTHER: 'literal' },
      headers: { Authorization: 'Bearer ${JENKINS_TOKEN}' },
      url: 'https://${PG_HOST}:5432/${PG_DB}',
    });
    expect([...names].sort()).toEqual(['JENKINS_TOKEN', 'NIGHTINGALE_TOKEN', 'PG_DB', 'PG_HOST']);
  });

  it('marks resolved vs missing without returning secrets', () => {
    const items = buildEnvPreflight(
      { env: { A: '${FOO}', B: '${BAR}' } },
      { FOO: 'super-secret', BAR: '' },
    );
    expect(items).toEqual([
      { name: 'BAR', referenced: true, resolved: false },
      { name: 'FOO', referenced: true, resolved: true },
    ]);
    expect(JSON.stringify(items)).not.toMatch(/super-secret/);
  });
});
