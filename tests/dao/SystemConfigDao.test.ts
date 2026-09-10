import fs from 'fs';
import os from 'os';
import path from 'path';

import { SystemConfigDaoImpl } from '../../src/dao/SystemConfigDao.js';

const writeSettings = (settingsPath: string, settings: unknown): void => {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
};

describe('SystemConfigDaoImpl smart-routing migration', () => {
  let tmpDir: string;
  let settingsPath: string;
  let originalSettingsEnv: string | undefined;
  let originalDbUrl: string | undefined;
  let originalUseDb: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcphub-system-config-'));
    settingsPath = path.join(tmpDir, 'mcp_settings.json');
    originalSettingsEnv = process.env.MCPHUB_SETTING_PATH;
    originalDbUrl = process.env.DB_URL;
    originalUseDb = process.env.USE_DB;
    delete process.env.DB_URL;
    delete process.env.USE_DB;
    process.env.MCPHUB_SETTING_PATH = settingsPath;
  });

  afterEach(() => {
    if (originalSettingsEnv === undefined) {
      delete process.env.MCPHUB_SETTING_PATH;
    } else {
      process.env.MCPHUB_SETTING_PATH = originalSettingsEnv;
    }
    if (originalDbUrl === undefined) {
      delete process.env.DB_URL;
    } else {
      process.env.DB_URL = originalDbUrl;
    }
    if (originalUseDb === undefined) {
      delete process.env.USE_DB;
    } else {
      process.env.USE_DB = originalUseDb;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns migrated settings when a read-only config rejects writeback', async () => {
    writeSettings(settingsPath, {
      mcpServers: {},
      users: [],
      systemConfig: {
        smartRouting: {
          openaiApiKey: 'legacy-key',
          openaiApiBaseUrl: 'https://legacy.example/v1',
          openaiApiEmbeddingModel: 'legacy-model',
        },
      },
    });
    const writeError = Object.assign(new Error('read-only filesystem'), { code: 'EROFS' });
    const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementationOnce(() => {
      throw writeError;
    });

    const config = await new SystemConfigDaoImpl().get();

    expect(config.smartRouting).toEqual({
      llmProviderApiKey: 'legacy-key',
      llmProviderBaseUrl: 'https://legacy.example/v1',
      embeddingModel: 'legacy-model',
    });
    writeSpy.mockRestore();
  });
});
