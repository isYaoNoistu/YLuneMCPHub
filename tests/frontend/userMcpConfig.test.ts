import {
  isLoopbackHostname,
  joinMcpUrl,
  resolveHubOrigin,
} from '../../frontend/src/utils/userMcpConfig.js';

describe('hub origin for agent mcp.json', () => {
  it('treats localhost and loopback as local', () => {
    expect(isLoopbackHostname('localhost')).toBe(true);
    expect(isLoopbackHostname('127.0.0.1')).toBe(true);
    expect(isLoopbackHostname('::1')).toBe(true);
    expect(isLoopbackHostname('example.com')).toBe(false);
  });

  it('ignores a localhost install URL when the console is opened on a public host', () => {
    expect(
      resolveHubOrigin('http://localhost:3000', 'http://203.0.113.10:3000'),
    ).toBe('http://203.0.113.10:3000');
  });

  it('keeps a configured public install URL', () => {
    expect(
      resolveHubOrigin('https://ylune.example.com', 'http://127.0.0.1:3000'),
    ).toBe('https://ylune.example.com');
  });

  it('prefers the console domain over a leftover public IP in settings', () => {
    expect(
      resolveHubOrigin('http://203.0.113.10:3000', 'https://ylune.example.com'),
    ).toBe('https://ylune.example.com');
  });

  it('maps local Vite to the backend MCP port', () => {
    expect(resolveHubOrigin(undefined, 'http://localhost:5173')).toBe('http://localhost:3000');
  });

  it('joins BASE_PATH onto /mcp without doubling', () => {
    expect(joinMcpUrl('http://203.0.113.10:3000', '')).toBe('http://203.0.113.10:3000/mcp');
    expect(joinMcpUrl('http://203.0.113.10:3000', '/ylune')).toBe(
      'http://203.0.113.10:3000/ylune/mcp',
    );
    expect(joinMcpUrl('https://ylune.example.com/ylune', '/ylune')).toBe(
      'https://ylune.example.com/ylune/mcp',
    );
  });
});
