import { isConsoleEnabled, isMcpEnabled, isDemoUser, resolveAccountFlags } from '../../src/utils/userAccount.js';

describe('userAccount flags', () => {
  it('treats old admin rows as console plus MCP', () => {
    expect(resolveAccountFlags({ isAdmin: true })).toEqual({
      isAdmin: true,
      consoleEnabled: true,
      mcpEnabled: true,
      demo: false,
    });
  });

  it('treats old regular rows as MCP-only', () => {
    expect(resolveAccountFlags({ isAdmin: false })).toEqual({
      isAdmin: false,
      consoleEnabled: false,
      mcpEnabled: true,
      demo: false,
    });
    expect(isConsoleEnabled({ isAdmin: false })).toBe(false);
    expect(isMcpEnabled({})).toBe(true);
  });

  it('keeps an explicit console-only admin', () => {
    expect(
      resolveAccountFlags({ isAdmin: true, consoleEnabled: true, mcpEnabled: false }),
    ).toEqual({
      isAdmin: true,
      consoleEnabled: true,
      mcpEnabled: false,
      demo: false,
    });
    expect(isMcpEnabled({ mcpEnabled: false })).toBe(false);
  });

  it('makes demo accounts console-only viewers', () => {
    expect(
      resolveAccountFlags({ demo: true, isAdmin: true, mcpEnabled: true, consoleEnabled: false }),
    ).toEqual({
      isAdmin: false,
      demo: true,
      consoleEnabled: true,
      mcpEnabled: false,
    });
    expect(isConsoleEnabled({ demo: true })).toBe(true);
    expect(isMcpEnabled({ demo: true })).toBe(false);
    expect(isDemoUser({ demo: true, isAdmin: true })).toBe(true);
  });
});
