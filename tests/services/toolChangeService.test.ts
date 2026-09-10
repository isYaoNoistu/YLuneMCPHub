import { createHash } from 'node:crypto';
import {
  diffToolSnapshots,
  fingerprintTool,
  snapshotFromServers,
} from '../../src/services/toolChangeService.js';

describe('toolChangeService', () => {
  it('changes fingerprint when description or schema changes', () => {
    const before = fingerprintTool({
      name: 'query',
      description: 'old',
      inputSchema: { type: 'object' },
    });
    const after = fingerprintTool({
      name: 'query',
      description: 'new',
      inputSchema: { type: 'object' },
    });
    expect(before).not.toEqual(after);
    expect(before).toEqual(
      createHash('sha256')
        .update(
          JSON.stringify({
            name: 'query',
            description: 'old',
            inputSchema: { type: 'object' },
            outputSchema: null,
            meta: null,
          }),
        )
        .digest('hex'),
    );
  });

  it('diffs added, removed, and changed tools', () => {
    const previous = snapshotFromServers([
      {
        name: 'pg',
        tools: [
          { name: 'pg-query', description: 'a', inputSchema: {} },
          { name: 'pg-list', description: 'b', inputSchema: {} },
        ],
      },
    ]);
    const current = snapshotFromServers([
      {
        name: 'pg',
        tools: [
          { name: 'pg-query', description: 'changed', inputSchema: {} },
          { name: 'pg-explain', description: 'c', inputSchema: {} },
        ],
      },
    ]);
    expect(diffToolSnapshots(previous, current)).toEqual([
      {
        server: 'pg',
        added: ['explain'],
        removed: ['list'],
        changed: ['query'],
      },
    ]);
  });

  it('returns no diff when there is no baseline', () => {
    expect(diffToolSnapshots({}, { pg: { query: 'abc' } })).toEqual([]);
  });
});
