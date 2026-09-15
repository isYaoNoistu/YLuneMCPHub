import {
  Copy,
  CopyPlus,
  DownloadCloud,
  Edit3,
  LogOut,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Wrench,
} from 'lucide-react';
import { useId } from 'react';
import type { MouseEventHandler } from 'react';

interface ActionsMenuLabels {
  actions: string;
  configuration: string;
  connection: string;
  danger: string;
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
}: ActionsMenuProps) => {
  const panelId = useId();

  return (
    <>
      <button
        className="hub-icon-btn hub-actions-trigger"
        onClick={onToggleMenu}
        aria-label={labels.actions}
        aria-expanded={showMenu}
        aria-controls={panelId}
      >
        <MoreHorizontal size={14} />
      </button>
      {showMenu && (
        <div
          id={panelId}
          className="hub-actions-menu"
          role="group"
          aria-label={labels.actions}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="hub-actions-menu-section" role="group" aria-label={labels.configuration}>
            <span className="hub-actions-menu-label">{labels.configuration}</span>
            <button onClick={onEdit} className="hub-actions-menu-item">
              <Edit3 size={14} /> <span>{labels.edit}</span>
            </button>
            <button onClick={onCopyConfig} className="hub-actions-menu-item">
              <Copy size={14} /> <span>{labels.copy}</span>
            </button>
            <button onClick={onClone} className="hub-actions-menu-item">
              <CopyPlus size={14} /> <span>{labels.clone}</span>
            </button>
          </div>

          <div className="hub-actions-menu-section" role="group" aria-label={labels.connection}>
            <span className="hub-actions-menu-label">{labels.connection}</span>
            <button onClick={onPreflight} className="hub-actions-menu-item">
              <Wrench size={14} /> <span>{labels.envPreflight}</span>
            </button>
            {hasReload && (
              <button
                onClick={onReload}
                disabled={isReloading || isToggling || !enabled}
                className="hub-actions-menu-item"
              >
                <RefreshCw size={14} /> <span>{labels.reload}</span>
              </button>
            )}
            {hasReinstall && (
              <button
                onClick={onRequestReinstall}
                disabled={isReinstalling || isToggling || !enabled}
                className="hub-actions-menu-item"
              >
                <DownloadCloud size={14} /> <span>{labels.reinstall}</span>
              </button>
            )}
            {hasOAuthDisconnect && (
              <button
                onClick={onRequestOAuthDisconnect}
                disabled={isDisconnectingOAuth}
                className="hub-actions-menu-item"
              >
                <LogOut size={14} /> <span>{labels.disconnectOAuth}</span>
              </button>
            )}
          </div>

          <div
            className="hub-actions-menu-section is-danger"
            role="group"
            aria-label={labels.danger}
          >
            <span className="hub-actions-menu-label">{labels.danger}</span>
            <button onClick={onDelete} className="hub-actions-menu-item is-danger">
              <Trash2 size={14} /> <span>{labels.delete}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ActionsMenu;
