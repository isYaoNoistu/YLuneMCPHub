import type { Request, Response } from 'express';

export type DescribableConfig = Record<string, { enabled: boolean; description?: string }>;

type CapabilityOperation = 'toggle' | 'updateDescription' | 'resetDescription';

type CapabilityHandlerOptions<TServer extends { name: string }> = {
  displayName: 'Tool' | 'Prompt' | 'Resource';
  itemParam: 'toolName' | 'promptName' | 'resourceUri';
  missingNamesMessage: string;
  loadServer: (
    req: Request,
    res: Response,
    serverName: string,
  ) => Promise<TServer | null>;
  getItems: (server: TServer) => DescribableConfig;
  persistItems: (serverName: string, items: DescribableConfig) => Promise<boolean>;
  afterPersist: (
    operation: CapabilityOperation,
    serverName: string,
    itemName: string,
  ) => void;
  getDefaultDescription: (serverName: string, itemName: string) => string;
};

const FORBIDDEN_ITEM_NAMES = ['__proto__', 'constructor', 'prototype'];

const clearDescriptionOverride = (
  items: DescribableConfig,
  itemName: string,
): DescribableConfig => {
  const nextItems = { ...items };
  const itemConfig = nextItems[itemName];

  if (!itemConfig) {
    return nextItems;
  }

  const { description: _description, ...remainingConfig } = itemConfig;

  if (remainingConfig.enabled === false) {
    nextItems[itemName] = { enabled: false };
  } else {
    delete nextItems[itemName];
  }

  return nextItems;
};

export const createCapabilityHandlers = <TServer extends { name: string }>(
  options: CapabilityHandlerOptions<TServer>,
) => {
  const readNames = (req: Request) => ({
    serverName: decodeURIComponent(req.params.serverName),
    itemName: decodeURIComponent(req.params[options.itemParam]),
  });

  const validateNames = (res: Response, serverName: string, itemName: string): boolean => {
    if (!serverName || !itemName || FORBIDDEN_ITEM_NAMES.includes(itemName)) {
      res.status(400).json({
        success: false,
        message: options.missingNamesMessage,
      });
      return false;
    }

    return true;
  };

  const saveItems = async (
    res: Response,
    serverName: string,
    items: DescribableConfig,
  ): Promise<boolean> => {
    const saved = await options.persistItems(serverName, items);
    if (!saved) {
      res.status(500).json({
        success: false,
        message: 'Failed to save settings',
      });
      return false;
    }

    return true;
  };

  const toggle = async (req: Request, res: Response): Promise<void> => {
    try {
      const { serverName, itemName } = readNames(req);
      const { enabled } = req.body;

      if (!validateNames(res, serverName, itemName)) {
        return;
      }

      if (typeof enabled !== 'boolean') {
        res.status(400).json({
          success: false,
          message: 'Enabled status must be a boolean',
        });
        return;
      }

      const server = await options.loadServer(req, res, serverName);
      if (!server) {
        return;
      }

      const items = options.getItems(server);
      items[itemName] = { ...items[itemName], enabled };

      if (!(await saveItems(res, serverName, items))) {
        return;
      }

      options.afterPersist('toggle', serverName, itemName);
      res.json({
        success: true,
        message: `${options.displayName} ${itemName} ${
          enabled ? 'enabled' : 'disabled'
        } successfully`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };

  const updateDescription = async (req: Request, res: Response): Promise<void> => {
    try {
      const { serverName, itemName } = readNames(req);
      const { description } = req.body;

      if (!validateNames(res, serverName, itemName)) {
        return;
      }

      if (typeof description !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Description must be a string',
        });
        return;
      }

      const server = await options.loadServer(req, res, serverName);
      if (!server) {
        return;
      }

      const items = options.getItems(server);
      if (!items[itemName]) {
        items[itemName] = { enabled: true };
      }
      items[itemName].description = description;

      if (!(await saveItems(res, serverName, items))) {
        return;
      }

      options.afterPersist('updateDescription', serverName, itemName);
      res.json({
        success: true,
        message: `${options.displayName} ${itemName} description updated successfully`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };

  const resetDescription = async (req: Request, res: Response): Promise<void> => {
    try {
      const { serverName, itemName } = readNames(req);

      if (!validateNames(res, serverName, itemName)) {
        return;
      }

      const server = await options.loadServer(req, res, serverName);
      if (!server) {
        return;
      }

      const items = clearDescriptionOverride(options.getItems(server), itemName);
      if (!(await saveItems(res, serverName, items))) {
        return;
      }

      options.afterPersist('resetDescription', serverName, itemName);
      const defaultDescription = options.getDefaultDescription(serverName, itemName);

      res.json({
        success: true,
        message: `${options.displayName} ${itemName} description reset successfully`,
        data: {
          description: defaultDescription,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };

  return {
    toggle,
    updateDescription,
    resetDescription,
  };
};
