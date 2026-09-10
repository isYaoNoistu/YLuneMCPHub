import { toImportTemplate } from '../../src/utils/templateFormat.js';

describe('toImportTemplate', () => {
  it('accepts an mcp-settings backup as well as a sharing template', () => {
    expect(
      toImportTemplate({
        version: '1.0',
        name: 'pack',
        servers: { a: { command: 'npx' } },
        groups: [],
      })?.servers,
    ).toEqual({ a: { command: 'npx' } });

    expect(
      toImportTemplate({
        mcpServers: { b: { url: 'http://example' } },
      })?.servers,
    ).toEqual({ b: { url: 'http://example' } });
  });
});
