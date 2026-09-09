import { Request, Response } from 'express';

const mockLoadSettings = jest.fn();
const mockGetMarketServers = jest.fn();
const mockGetMarketServerByName = jest.fn();
const mockSearchMarketServers = jest.fn();
const mockGetMarketCategories = jest.fn();
const mockGetMarketTags = jest.fn();

jest.mock('../../src/config/index.js', () => ({
  __esModule: true,
  default: {
    basePath: '',
    mcpHubName: 'mcphub',
    mcpHubVersion: '0.0.0-test',
  },
  loadSettings: (...args: unknown[]) => mockLoadSettings(...args),
}));

jest.mock('../../src/services/marketService.js', () => ({
  getMarketServers: (...args: unknown[]) => mockGetMarketServers(...args),
  getMarketServerByName: (...args: unknown[]) => mockGetMarketServerByName(...args),
  searchMarketServers: (...args: unknown[]) => mockSearchMarketServers(...args),
  getMarketCategories: (...args: unknown[]) => mockGetMarketCategories(...args),
  getMarketTags: (...args: unknown[]) => mockGetMarketTags(...args),
}));

import {
  listDiscoveryServers,
  getDiscoveryServer,
  getDiscoveryServerInstall,
  listDiscoveryCategories,
  listDiscoveryTags,
  getMarketplaceWellKnown,
} from '../../src/controllers/discoveryController.js';

const sampleServers = {
  firecrawl: {
    name: 'firecrawl',
    display_name: 'Firecrawl',
    description: 'Web scraping',
    categories: ['Web Services'],
    tags: ['scraping', 'web'],
    installations: {
      npm: {
        type: 'npm',
        command: 'npx',
        args: ['-y', 'firecrawl-mcp'],
        env: { FIRECRAWL_API_KEY: '${FIRECRAWL_API_KEY}' },
      },
      docker: {
        type: 'docker',
        command: 'docker',
        args: ['run', 'firecrawl/mcp'],
      },
    },
    arguments: {
      FIRECRAWL_API_KEY: { description: 'API key', required: true, example: 'fc-...' },
    },
  },
  fetch: {
    name: 'fetch',
    display_name: 'Fetch',
    description: 'HTTP fetch tool',
    categories: ['Utilities'],
    tags: ['http'],
    installations: {
      uvx: { type: 'uvx', command: 'uvx', args: ['mcp-server-fetch'] },
    },
    arguments: {},
  },
};

const enableDiscovery = (enabled: boolean) => {
  mockLoadSettings.mockReturnValue({
    systemConfig: { discovery: { enabled } },
  });
};

const buildRes = (): { res: Response; json: jest.Mock; status: jest.Mock } => {
  const json = jest.fn();
  const status = jest.fn().mockReturnThis();
  const res = { status, json } as unknown as Response;
  return { res, json, status };
};

describe('discoveryController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMarketServers.mockReturnValue(sampleServers);
    mockGetMarketServerByName.mockImplementation(
      (name: string) => (sampleServers as Record<string, unknown>)[name] ?? null,
    );
    mockSearchMarketServers.mockReturnValue(Object.values(sampleServers));
    mockGetMarketCategories.mockReturnValue(['Utilities', 'Web Services']);
    mockGetMarketTags.mockReturnValue(['http', 'scraping', 'web']);
  });

  describe('feature gating', () => {
    it.each([
      ['listDiscoveryServers', listDiscoveryServers],
      ['getDiscoveryServer', getDiscoveryServer],
      ['getDiscoveryServerInstall', getDiscoveryServerInstall],
      ['listDiscoveryCategories', listDiscoveryCategories],
      ['listDiscoveryTags', listDiscoveryTags],
      ['getMarketplaceWellKnown', getMarketplaceWellKnown],
    ])('%s returns 404 when discovery is disabled', (_label, handler) => {
      enableDiscovery(false);
      const { res, status, json } = buildRes();
      const req = { params: { name: 'firecrawl' }, query: {} } as unknown as Request;

      handler(req, res);

      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith({ success: false, message: 'Not found' });
    });

    it('returns 404 when loadSettings throws', () => {
      mockLoadSettings.mockImplementation(() => {
        throw new Error('boom');
      });
      const { res, status } = buildRes();
      listDiscoveryServers({ query: {} } as unknown as Request, res);
      expect(status).toHaveBeenCalledWith(404);
    });
  });

  describe('listDiscoveryServers', () => {
    beforeEach(() => enableDiscovery(true));

    it('returns all servers when no filters supplied', () => {
      const { res, json } = buildRes();
      listDiscoveryServers({ query: {} } as unknown as Request, res);

      expect(json).toHaveBeenCalledWith({
        success: true,
        data: { total: 2, servers: Object.values(sampleServers) },
      });
    });

    it('delegates text search to searchMarketServers', () => {
      mockSearchMarketServers.mockReturnValue([sampleServers.firecrawl]);
      const { res, json } = buildRes();
      listDiscoveryServers({ query: { search: 'scrape' } } as unknown as Request, res);

      expect(mockSearchMarketServers).toHaveBeenCalledWith('scrape');
      expect(json).toHaveBeenCalledWith({
        success: true,
        data: { total: 1, servers: [sampleServers.firecrawl] },
      });
    });

    it('filters by category and tag', () => {
      const { res, json } = buildRes();
      listDiscoveryServers(
        { query: { category: 'Web Services', tag: 'scraping' } } as unknown as Request,
        res,
      );

      expect(json).toHaveBeenCalledWith({
        success: true,
        data: { total: 1, servers: [sampleServers.firecrawl] },
      });
    });

    it('respects limit but reports the pre-limit total so clients can paginate', () => {
      const { res, json } = buildRes();
      listDiscoveryServers({ query: { limit: '1' } } as unknown as Request, res);

      expect(json).toHaveBeenCalledWith({
        success: true,
        data: { total: 2, servers: [sampleServers.firecrawl] },
      });
    });

    it('ignores non-numeric limit', () => {
      const { res, json } = buildRes();
      listDiscoveryServers({ query: { limit: 'abc' } } as unknown as Request, res);

      expect(json).toHaveBeenCalledWith({
        success: true,
        data: { total: 2, servers: Object.values(sampleServers) },
      });
    });
  });

  describe('getDiscoveryServer', () => {
    beforeEach(() => enableDiscovery(true));

    it('returns the requested server', () => {
      const { res, json } = buildRes();
      getDiscoveryServer(
        { params: { name: 'firecrawl' }, query: {} } as unknown as Request,
        res,
      );
      expect(json).toHaveBeenCalledWith({ success: true, data: sampleServers.firecrawl });
    });

    it('returns 404 for an unknown server', () => {
      mockGetMarketServerByName.mockReturnValue(null);
      const { res, status } = buildRes();
      getDiscoveryServer(
        { params: { name: 'nope' }, query: {} } as unknown as Request,
        res,
      );
      expect(status).toHaveBeenCalledWith(404);
    });
  });

  describe('getDiscoveryServerInstall', () => {
    beforeEach(() => enableDiscovery(true));

    it('returns the npm installation by default (highest preference)', () => {
      const { res, json } = buildRes();
      getDiscoveryServerInstall(
        { params: { name: 'firecrawl' }, query: {} } as unknown as Request,
        res,
      );

      expect(json).toHaveBeenCalledWith({
        success: true,
        data: {
          name: 'firecrawl',
          installationType: 'npm',
          availableTypes: ['npm', 'docker'],
          mcpServers: {
            firecrawl: {
              command: 'npx',
              args: ['-y', 'firecrawl-mcp'],
              env: { FIRECRAWL_API_KEY: '${FIRECRAWL_API_KEY}' },
            },
          },
          arguments: {
            FIRECRAWL_API_KEY: { description: 'API key', required: true, example: 'fc-...' },
          },
        },
      });
    });

    it('honours explicit ?type=docker', () => {
      const { res, json } = buildRes();
      getDiscoveryServerInstall(
        { params: { name: 'firecrawl' }, query: { type: 'docker' } } as unknown as Request,
        res,
      );

      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            installationType: 'docker',
            mcpServers: {
              firecrawl: { command: 'docker', args: ['run', 'firecrawl/mcp'] },
            },
          }),
        }),
      );
    });

    it('returns 404 when requested type is unavailable', () => {
      const { res, status, json } = buildRes();
      getDiscoveryServerInstall(
        { params: { name: 'firecrawl' }, query: { type: 'binary' } } as unknown as Request,
        res,
      );
      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith({
        success: false,
        message: "Server has no 'binary' installation method",
      });
    });

    it('omits env from snippet when installation has no env', () => {
      const { res, json } = buildRes();
      getDiscoveryServerInstall(
        { params: { name: 'fetch' }, query: {} } as unknown as Request,
        res,
      );

      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mcpServers: { fetch: { command: 'uvx', args: ['mcp-server-fetch'] } },
          }),
        }),
      );
    });
  });

  describe('listDiscoveryCategories / listDiscoveryTags', () => {
    beforeEach(() => enableDiscovery(true));

    it('returns categories', () => {
      const { res, json } = buildRes();
      listDiscoveryCategories({} as Request, res);
      expect(json).toHaveBeenCalledWith({
        success: true,
        data: ['Utilities', 'Web Services'],
      });
    });

    it('returns tags', () => {
      const { res, json } = buildRes();
      listDiscoveryTags({} as Request, res);
      expect(json).toHaveBeenCalledWith({
        success: true,
        data: ['http', 'scraping', 'web'],
      });
    });
  });

  describe('getMarketplaceWellKnown', () => {
    beforeEach(() => enableDiscovery(true));

    it('returns marketplace metadata with endpoint map and total', () => {
      const { res, json } = buildRes();
      getMarketplaceWellKnown({} as Request, res);

      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'mcphub-marketplace',
          version: '0.1',
          hub: { name: 'mcphub', version: '0.0.0-test' },
          total_servers: 2,
          endpoints: expect.objectContaining({
            servers: '/discovery/servers',
            server: '/discovery/servers/{name}',
            install: '/discovery/servers/{name}/install',
            categories: '/discovery/categories',
            tags: '/discovery/tags',
          }),
        }),
      );
    });
  });
});
