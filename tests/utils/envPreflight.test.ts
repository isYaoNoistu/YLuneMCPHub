import { buildEnvPreflight, collectCredentialNeeds, collectEnvRefNames, overlayCredentialFields } from '../../src/utils/envPreflight.js';

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

  it('collects env keys and ${VAR} refs, ignoring PATH-like names', () => {
    expect(
      collectCredentialNeeds({
        env: { JENKINS_URL: 'https://ci', PATH: '/usr/bin', JENKINS_API_TOKEN: '${JENKINS_API_TOKEN}' },
        headers: { Authorization: 'Bearer ${N9E_TOKEN}' },
        args: ['--token', '${EXTRA}'],
        command: 'npx',
      }),
    ).toEqual(['EXTRA', 'JENKINS_API_TOKEN', 'JENKINS_URL', 'N9E_TOKEN']);
  });

  it('overlays credential fields onto config.env without dropping other keys', () => {
    const overlaid = overlayCredentialFields(
      { command: 'npx', env: { JENKINS_URL: 'https://ci', PATH: '/usr/bin' } },
      { JENKINS_API_TOKEN: 'secret' },
    );
    expect(overlaid.env).toEqual({
      JENKINS_URL: 'https://ci',
      PATH: '/usr/bin',
      JENKINS_API_TOKEN: 'secret',
    });
  });
});
