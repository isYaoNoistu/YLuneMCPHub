import treeKill from 'tree-kill';
import { isProcessTreeKillAvailable } from '../../utils/processTree.js';
import { logger } from '../../utils/logger.js';

const STDIO_KILL_GRACE_PERIOD_MS = 2000;

export const getStdioProcessId = (transport: unknown): number | null => {
  const candidateTransport = transport as { pid?: unknown } | null | undefined;
  return typeof candidateTransport?.pid === 'number' ? candidateTransport.pid : null;
};

// Kill the entire process tree of a stdio transport's child process.
//
// transport.close() only sends SIGTERM to the direct child. When the server is
// launched through a wrapper like `npx` / `npm exec`, the wrapper does not
// forward signals to its descendants, so the real server process is left
// running as an orphan. Walk the whole tree and force-kill it.
//
// When the process-lister tool tree-kill needs (`ps` on Linux) is missing —
// e.g. slim Docker images without procps — tree-kill's internal spawn fails
// with an unhandled 'error' event that would crash MCPHub. Fall back to
// signaling just the direct child instead (issue #1072).
export function killStdioProcessTree(name: string, pid: number): void {
  const safeDirectKill = (signal: 'SIGTERM' | 'SIGKILL'): void => {
    try {
      process.kill(pid, signal);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ESRCH') {
        logger.warn('Failed to send signal to process', {
          serverName: name,
          pid,
          signal,
          err,
        });
      }
    }
  };

  const safeTreeKill = (signal: 'SIGTERM' | 'SIGKILL'): void => {
    try {
      treeKill(pid, signal, (err) => {
        if (err) {
          const code = (err as NodeJS.ErrnoException).code;
          if (code !== 'ESRCH') {
            logger.warn('Failed to send signal to process tree', {
              serverName: name,
              pid,
              signal,
              err,
            });
          }
        }
      });
    } catch (err) {
      logger.warn('Failed to send signal to process tree', {
        serverName: name,
        pid,
        signal,
        err,
      });
    }
  };

  const safeKill = isProcessTreeKillAvailable()
    ? safeTreeKill
    : (signal: 'SIGTERM' | 'SIGKILL'): void => {
        logger.warn('Process lister unavailable, killing only the direct child process', {
          serverName: name,
          pid,
          signal,
        });
        safeDirectKill(signal);
      };

  safeKill('SIGTERM');

  setTimeout(() => {
    if (!isProcessAlive(pid)) {
      return;
    }
    safeKill('SIGKILL');
  }, STDIO_KILL_GRACE_PERIOD_MS);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}
