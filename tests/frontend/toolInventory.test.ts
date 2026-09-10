import {
  diffToolInventory,
  extractSearchTags,
  rememberToolInventory,
} from '../../frontend/src/utils/toolInventory';
import { Server } from '../../frontend/src/types';

const store: Record<string, string> = {};

beforeEach(() => {
  Object.keys(store).forEach((key) => {
    delete store[key];
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    },
  });
});

const server = (name: string, tools: string[], description = ''): Server => ({
  name,
  status: 'connected',
  enabled: true,
  tools: tools.map((tool) => ({ name: `${name}-${tool}` })),
  config: { description },
});

describe('toolInventory', () => {
  it('returns no diff on the first visit', () => {
    expect(diffToolInventory([server('jenkins', ['list_jobs'])])).toEqual([]);
  });

  it('reports added and removed tools after a snapshot', () => {
    rememberToolInventory([server('jenkins', ['list_jobs', 'health_check'])]);
    expect(diffToolInventory([server('jenkins', ['list_jobs', 'build'])])).toEqual([
      {
        server: 'jenkins',
        added: ['build'],
        removed: ['health_check'],
      },
    ]);
  });

  it('puts description hashtags ahead of tool-name chips', () => {
    expect(
      extractSearchTags([
        server('jenkins', ['list_jobs'], 'CI #ops #readonly'),
        server('n9e', ['query'], 'alerts'),
      ]),
    ).toEqual(['#ops', '#readonly', 'list_jobs', 'query']);
  });
});
