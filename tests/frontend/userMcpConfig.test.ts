import {
  escapeTomlString,
  formatUserMcpSnippet,
  formatUserMcpToml,
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

describe('agent connect snippets', () => {
  it('formats a Codex toml fragment to merge, not a whole file', () => {
    expect(formatUserMcpToml('ylune_abc', 'Jenkins', 'https://ylune.example.com')).toBe(
      [
        '[mcp_servers.ylune-jenkins]',
        'url = "https://ylune.example.com/mcp"',
        'http_headers = { Authorization = "Bearer ylune_abc" }',
      ].join('\n'),
    );
  });

  it('escapes quotes and backslashes in toml strings', () => {
    expect(escapeTomlString('a"b\\c')).toBe('a\\"b\\\\c');
    expect(formatUserMcpToml('tok"en\\x', 'user', 'https://example.com')).toContain(
      'Bearer tok\\"en\\\\x',
    );
  });

  it('picks json or toml from the copy format', () => {
    const json = formatUserMcpSnippet('json', 'k', 'ops', 'https://example.com');
    const toml = formatUserMcpSnippet('toml', 'k', 'ops', 'https://example.com');
    expect(json).toContain('"mcpServers"');
    expect(toml).toContain('[mcp_servers.ylune-ops]');
  });
});
