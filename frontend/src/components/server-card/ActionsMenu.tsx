import {
  Copy,
  DownloadCloud,
  Edit3,
  LogOut,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Wrench,
} from 'lucide-react';
import type { MouseEventHandler } from 'react';

interface ActionsMenuLabels {
  edit: string;
  copy: string;
  clone: string;
  envPreflight: string;
  reload: string;
  reinstall: string;
  disconnectOAuth: string;
  delete: string;
}

interface ActionsMenuProps {
  showMenu: boolean;
  labels: ActionsMenuLabels;
  hasReload: boolean;
  hasReinstall: boolean;
  hasOAuthDisconnect: boolean;
  enabled: boolean;
  isToggling: boolean;
  isReloading: boolean;
  isReinstalling: boolean;
  isDisconnectingOAuth: boolean;
  onToggleMenu: MouseEventHandler<HTMLButtonElement>;
  onEdit: MouseEventHandler<HTMLButtonElement>;
  onCopyConfig: MouseEventHandler<HTMLButtonElement>;
  onClone: MouseEventHandler<HTMLButtonElement>;
  onPreflight: MouseEventHandler<HTMLButtonElement>;
  onReload: MouseEventHandler<HTMLButtonElement>;
  onRequestReinstall: MouseEventHandler<HTMLButtonElement>;
  onRequestOAuthDisconnect: MouseEventHandler<HTMLButtonElement>;
  onDelete: MouseEventHandler<HTMLButtonElement>;
}

const ActionsMenu = ({
  showMenu,
  labels,
  hasReload,
  hasReinstall,
  hasOAuthDisconnect,
  enabled,
  isToggling,
  isReloading,
  isReinstalling,
  isDisconnectingOAuth,
  onToggleMenu,
  onEdit,
  onCopyConfig,
  onClone,
  onPreflight,
  onReload,
  onRequestReinstall,
  onRequestOAuthDisconnect,
  onDelete,
}: ActionsMenuProps) => (
  <>
    <button className="hub-icon-btn" onClick={onToggleMenu} aria-label="More">
      <MoreHorizontal size={14} />
    </button>
    {showMenu && (
      <div
        className="absolute right-0 top-full mt-1 z-20 hub-card"
        style={{ minWidth: 160, padding: 4 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onEdit}
          className="flex items-center gap-2 w-full px-2.5 py-1.5 text-[13px] rounded-md hover:bg-[var(--hub-surface-hover)] text-left"
          style={{ color: 'var(--hub-ink)' }}
        >
          <Edit3 size={13} /> {labels.edit}
        </button>
        <button
          onClick={onCopyConfig}
          className="flex items-center gap-2 w-full px-2.5 py-1.5 text-[13px] rounded-md hover:bg-[var(--hub-surface-hover)] text-left"
          style={{ color: 'var(--hub-ink)' }}
        >
          <Copy size={13} /> {labels.copy}
        </button>
        <button
          onClick={onClone}
          className="flex items-center gap-2 w-full px-2.5 py-1.5 text-[13px] rounded-md hover:bg-[var(--hub-surface-hover)] text-left"
          style={{ color: 'var(--hub-ink)' }}
        >
          <Copy size={13} /> {labels.clone}
        </button>
        <button
          onClick={onPreflight}
          className="flex items-center gap-2 w-full px-2.5 py-1.5 text-[13px] rounded-md hover:bg-[var(--hub-surface-hover)] text-left"
          style={{ color: 'var(--hub-ink)' }}
        >
          <Wrench size={13} /> {labels.envPreflight}
        </button>
        {hasReload && (
          <button
            onClick={onReload}
            disabled={isReloading || isToggling || !enabled}
            className="flex items-center gap-2 w-full px-2.5 py-1.5 text-[13px] rounded-md hover:bg-[var(--hub-surface-hover)] text-left disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: 'var(--hub-ink)' }}
          >
            <RefreshCw size={13} /> {labels.reload}
          </button>
        )}
        {hasReinstall && (
          <button
            onClick={onRequestReinstall}
            disabled={isReinstalling || isToggling || !enabled}
            className="flex items-center gap-2 w-full px-2.5 py-1.5 text-[13px] rounded-md hover:bg-[var(--hub-surface-hover)] text-left disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: 'var(--hub-ink)' }}
          >
            <DownloadCloud size={13} /> {labels.reinstall}
          </button>
        )}
        {hasOAuthDisconnect && (
          <button
            onClick={onRequestOAuthDisconnect}
            disabled={isDisconnectingOAuth}
            className="flex items-center gap-2 w-full px-2.5 py-1.5 text-[13px] rounded-md hover:bg-[var(--hub-surface-hover)] text-left disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: 'var(--hub-ink)' }}
          >
            <LogOut size={13} /> {labels.disconnectOAuth}
          </button>
        )}
        <div style={{ height: 1, background: 'var(--hub-line-2)', margin: '4px 0' }} />
        <button
          onClick={onDelete}
          className="flex items-center gap-2 w-full px-2.5 py-1.5 text-[13px] rounded-md hover:bg-[var(--hub-surface-hover)] text-left"
          style={{ color: 'var(--hub-err)' }}
        >
          <Trash2 size={13} /> {labels.delete}
        </button>
      </div>
    )}
  </>
);

export default ActionsMenu;
