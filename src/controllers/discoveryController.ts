import { Request, Response } from 'express';
import config, { loadSettings } from '../config/index.js';
import {
  getMarketServers,
  getMarketServerByName,
  searchMarketServers,
  getMarketCategories,
  getMarketTags,
} from '../services/marketService.js';
import { ApiResponse, MarketServer, MarketServerInstallation } from '../types/index.js';

// Preference order when no explicit installation type is requested.
const INSTALLATION_PREFERENCE = ['npm', 'uvx', 'pip', 'docker', 'binary'];

const isDiscoveryEnabled = (): boolean => {
  try {
    return loadSettings().systemConfig?.discovery?.enabled === true;
  } catch {
    return false;
  }
};

// When discovery is disabled we return 404 (not 401) so unauthenticated callers
// cannot probe whether the feature even exists on a given mcphub instance.
const ensureEnabled = (res: Response): boolean => {
  if (!isDiscoveryEnabled()) {
    res.status(404).json({ success: false, message: 'Not found' });
    return false;
  }
  return true;
};

const applyFilters = (
  servers: MarketServer[],
  filters: { category?: string; tag?: string; limit?: number },
): { results: MarketServer[]; total: number } => {
  let result = servers;
  if (filters.category) {
    result = result.filter((s) => s.categories?.includes(filters.category!));
  }
  if (filters.tag) {
    result = result.filter((s) => s.tags?.includes(filters.tag!));
  }
  const total = result.length;
  if (typeof filters.limit === 'number' && filters.limit > 0) {
    result = result.slice(0, filters.limit);
  }
  return { results: result, total };
};

const pickInstallation = (
  installations: Record<string, MarketServerInstallation> | undefined,
  preferred?: string,
): { type: string; installation: MarketServerInstallation } | null => {
  if (!installations) return null;
  const keys = Object.keys(installations);
  if (keys.length === 0) return null;

  // If caller explicitly requested a type, return it or nothing — never silently
  // substitute a different installer, since that would break automated installs.
  if (preferred) {
    return installations[preferred]
      ? { type: preferred, installation: installations[preferred] }
      : null;
  }
  for (const key of INSTALLATION_PREFERENCE) {
    if (installations[key]) {
      return { type: key, installation: installations[key] };
    }
  }
  return { type: keys[0], installation: installations[keys[0]] };
};

export const listDiscoveryServers = (req: Request, res: Response): void => {
  if (!ensureEnabled(res)) return;
  try {
    const { search, category, tag, limit } = req.query;
    const base =
      typeof search === 'string' && search.trim()
        ? searchMarketServers(search)
        : Object.values(getMarketServers());

    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : NaN;
    const { results, total } = applyFilters(base, {
      category: typeof category === 'string' && category ? category : undefined,
      tag: typeof tag === 'string' && tag ? tag : undefined,
      limit: !Number.isNaN(limitNum) ? limitNum : undefined,
    });

    const response: ApiResponse = {
      success: true,
      data: { total, servers: results },
    };
    res.json(response);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to list discovery servers' });
  }
};

export const getDiscoveryServer = (req: Request, res: Response): void => {
  if (!ensureEnabled(res)) return;
  try {
    const { name } = req.params;
    if (!name) {
      res.status(400).json({ success: false, message: 'Server name is required' });
      return;
    }
    const server = getMarketServerByName(name);
    if (!server) {
      res.status(404).json({ success: false, message: 'Server not found' });
      return;
    }
    const response: ApiResponse = { success: true, data: server };
    res.json(response);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get discovery server' });
  }
};

// Returns a ready-to-paste `mcpServers` snippet compatible with the common
// MCP client config format (Claude Desktop, OpenClaw `openclaw.json`, Cursor,
// etc.). Callers can request a specific installation type via ?type=npm|docker|...
// and the response includes the documented `arguments` so the consumer knows
// which env vars to fill in.
export const getDiscoveryServerInstall = (req: Request, res: Response): void => {
  if (!ensureEnabled(res)) return;
  try {
    const { name } = req.params;
    if (!name) {
      res.status(400).json({ success: false, message: 'Server name is required' });
      return;
    }
    const server = getMarketServerByName(name);
    if (!server) {
      res.status(404).json({ success: false, message: 'Server not found' });
      return;
    }
    const preferred = typeof req.query.type === 'string' ? req.query.type : undefined;
    const picked = pickInstallation(server.installations, preferred);
    if (!picked) {
      res.status(404).json({
        success: false,
        message: preferred
          ? `Server has no '${preferred}' installation method`
          : 'Server has no installation method',
      });
      return;
    }
    const { installation, type } = picked;
    const snippet: Record<string, unknown> = {
      command: installation.command,
      args: installation.args,
    };
    if (installation.env && Object.keys(installation.env).length > 0) {
      snippet.env = installation.env;
    }
    const response: ApiResponse = {
      success: true,
      data: {
        name: server.name,
        installationType: type,
        availableTypes: Object.keys(server.installations || {}),
        mcpServers: { [server.name]: snippet },
        arguments: server.arguments || {},
      },
    };
    res.json(response);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to build install snippet' });
  }
};

export const listDiscoveryCategories = (_req: Request, res: Response): void => {
  if (!ensureEnabled(res)) return;
  try {
    const response: ApiResponse = { success: true, data: getMarketCategories() };
    res.json(response);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to list categories' });
  }
};

export const listDiscoveryTags = (_req: Request, res: Response): void => {
  if (!ensureEnabled(res)) return;
  try {
    const response: ApiResponse = { success: true, data: getMarketTags() };
    res.json(response);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to list tags' });
  }
};

// Well-known autodiscovery: lets external clients learn the discovery API
// surface of this mcphub instance in a single request.
export const getMarketplaceWellKnown = (_req: Request, res: Response): void => {
  if (!ensureEnabled(res)) return;
  try {
    const base = config.basePath || '';
    const total = Object.keys(getMarketServers()).length;
    res.json({
      name: 'mcphub-marketplace',
      version: '0.1',
      hub: { name: config.mcpHubName, version: config.mcpHubVersion },
      endpoints: {
        servers: `${base}/discovery/servers`,
        server: `${base}/discovery/servers/{name}`,
        install: `${base}/discovery/servers/{name}/install`,
        categories: `${base}/discovery/categories`,
        tags: `${base}/discovery/tags`,
      },
      total_servers: total,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch marketplace metadata' });
  }
};
