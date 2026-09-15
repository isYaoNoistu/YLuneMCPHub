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
      { name: 'BAR', referenced: true, resolved: false, source: 'missing' },
      { name: 'FOO', referenced: true, resolved: true, source: 'process_env' },
    ]);
    expect(JSON.stringify(items)).not.toMatch(/super-secret/);
  });

  it('resolves source from process_env, credential, or missing without returning secrets', () => {
    const config = {
      env: { A: '${FOO}', B: '${BAR}', C: '${BAZ}' },
    };
    const items = buildEnvPreflight(
      config,
      { FOO: 'env-secret', BAR: '' },
      { BAR: 'credential-secret' },
    );
    expect(items).toEqual([
      { name: 'BAR', referenced: true, resolved: true, source: 'credential' },
      { name: 'BAZ', referenced: true, resolved: false, source: 'missing' },
      { name: 'FOO', referenced: true, resolved: true, source: 'process_env' },
    ]);
    expect(JSON.stringify(items)).not.toMatch(/env-secret|credential-secret/);
  });

  it('prefers process_env over credential when both are present', () => {
    const items = buildEnvPreflight(
      { env: { A: '${TOKEN}' } },
      { TOKEN: 'from-env' },
      { TOKEN: 'from-credential' },
    );
    expect(items).toEqual([
      { name: 'TOKEN', referenced: true, resolved: true, source: 'process_env' },
    ]);
    expect(JSON.stringify(items)).not.toMatch(/from-env|from-credential/);
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
