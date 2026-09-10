import { countGrantedTools, summarizeGrants } from '../../frontend/src/utils/grantPreview';
import { Server } from '../../frontend/src/types';

const servers: Server[] = [
  {
    name: 'jenkins',
    status: 'connected',
    enabled: true,
    tools: [{ name: 'jenkins-list_jobs' }, { name: 'jenkins-health_check' }],
  },
  {
    name: 'n9e',
    status: 'disconnected',
    enabled: true,
    tools: [{ name: 'n9e-query' }],
  },
];

describe('summarizeGrants', () => {
  it('lists every enabled server for admins', () => {
    const rows = summarizeGrants([], servers, true);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ server: 'jenkins', allTools: true });
    expect(rows[0].tools).toEqual(['list_jobs', 'health_check']);
  });

  it('returns an empty preview when a regular user has no grants', () => {
    expect(summarizeGrants([], servers)).toEqual([]);
    expect(countGrantedTools([])).toBe(0);
  });

  it('keeps selected tools when grants are a subset', () => {
    const rows = summarizeGrants([{ name: 'jenkins', tools: ['list_jobs'] }], servers);
    expect(rows).toEqual([
      expect.objectContaining({
        server: 'jenkins',
        allTools: false,
        tools: ['list_jobs'],
      }),
    ]);
    expect(countGrantedTools(rows)).toBe(1);
  });
});
