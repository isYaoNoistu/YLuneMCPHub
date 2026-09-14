/**
 * Built-in read-only platform MCP. Not created via 服务器 → 添加.
 * Agents call its tools on /mcp with an admin Access Key, not /mcp/ylune.
 */
export const YLUNE_PLATFORM_SERVER_NAME = 'ylune';

export const YLUNE_PLATFORM_REMARK =
  'Built-in read-only platform MCP. Only an admin Access Key can call these tools on /mcp.';

export const isYlunePlatformServerName = (name: unknown): boolean =>
  typeof name === 'string' && name.trim().toLowerCase() === YLUNE_PLATFORM_SERVER_NAME;

export const YLUNE_PLATFORM_RESERVED_MESSAGE =
  'Server name "ylune" is reserved for the built-in platform MCP';
