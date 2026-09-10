import fs from 'fs';
import os from 'os';
import path from 'path';

import { SystemConfigDaoImpl } from '../../src/dao/SystemConfigDao.js';

describe('JsonFileBaseDao missing settings file', () => {
  let tmpDir: string;
  let settingsPath: string;
  let originalSettingsEnv: string | undefined;
  let originalDbUrl: string | undefined;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcphub-json-dao-'));
    settingsPath = path.join(tmpDir, 'mcp_settings.json');
    originalSettingsEnv = process.env.MCPHUB_SETTING_PATH;
    originalDbUrl = process.env.DB_URL;
    process.env.MCPHUB_SETTING_PATH = settingsPath;
    process.env.DB_URL = 'postgres://ylune:ylune@127.0.0.1:5432/ylune';
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
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
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('does not log an error when the settings file is absent in database mode', async () => {
    const config = await new SystemConfigDaoImpl().get();

    expect(config).toEqual({});
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('still logs an error when the settings file exists but is invalid', async () => {
    fs.writeFileSync(settingsPath, '{not-json', 'utf8');

    const config = await new SystemConfigDaoImpl().get();

    expect(config).toEqual({});
    expect(errorSpy).toHaveBeenCalled();
  });
});
