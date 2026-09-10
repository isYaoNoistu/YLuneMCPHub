import { isConsoleEnabled, isMcpEnabled, resolveAccountFlags } from '../../src/utils/userAccount.js';

describe('userAccount flags', () => {
  it('treats old admin rows as console plus MCP', () => {
    expect(resolveAccountFlags({ isAdmin: true })).toEqual({
      isAdmin: true,
      consoleEnabled: true,
      mcpEnabled: true,
    });
  });

  it('treats old regular rows as MCP-only', () => {
    expect(resolveAccountFlags({ isAdmin: false })).toEqual({
      isAdmin: false,
      consoleEnabled: false,
      mcpEnabled: true,
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
    });
    expect(isMcpEnabled({ mcpEnabled: false })).toBe(false);
  });
});
