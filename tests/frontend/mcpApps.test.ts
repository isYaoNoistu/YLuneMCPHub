import {
  MCP_APPS_MIME_TYPE,
  hasMcpAppsMetadata,
  serverExposesMcpApp,
} from '../../frontend/src/utils/mcpApps';

describe('MCP Apps frontend detection', () => {
  it.each([
    [{ ui: {} }],
    [{ 'ui/resourceUri': 'ui://weather/widget' }],
  ])('detects MCP Apps metadata (%j)', (metadata) => {
    expect(hasMcpAppsMetadata(metadata)).toBe(true);
  });

  it.each([
    undefined,
    {},
    { ui: false },
    { 'ui/resourceUri': '' },
  ])('ignores absent or falsey MCP Apps metadata (%j)', (metadata) => {
    expect(hasMcpAppsMetadata(metadata)).toBe(false);
  });

  it('detects tool metadata', () => {
    expect(
      serverExposesMcpApp({
        tools: [{ _meta: { ui: { resourceUri: 'ui://weather/widget' } } }],
      }),
    ).toBe(true);
  });

  it.each([
    { uri: 'ui://weather/widget' },
    { uri: 'resource://weather/widget', mimeType: MCP_APPS_MIME_TYPE },
    { uri: 'resource://weather/widget', _meta: { 'ui/resourceUri': 'ui://weather/widget' } },
  ])('detects MCP Apps resources (%j)', (resource) => {
    expect(serverExposesMcpApp({ resources: [resource] })).toBe(true);
  });

  it('does not flag ordinary tools and resources', () => {
    expect(
      serverExposesMcpApp({
        tools: [{ _meta: { audience: ['assistant'] } }],
        resources: [{ uri: 'resource://docs/readme', mimeType: 'text/plain' }],
      }),
    ).toBe(false);
  });

  it('does not flag an empty server', () => {
    expect(serverExposesMcpApp({})).toBe(false);
  });
});
