import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Edit3, Trash2, Copy, Check, Link as LinkIcon, FileCode } from 'lucide-react';
import { Group, Server, IGroupServerConfig, GroupCost } from '@/types';
import DeleteDialog from '@/components/ui/DeleteDialog';
import { useToast } from '@/contexts/ToastContext';
import { useSettingsData } from '@/hooks/useSettingsData';
import { formatTokens, percentSaved } from '@/utils/contextCost';

interface GroupCardProps {
  group: Group;
  servers: Server[];
  onEdit: (group: Group) => void;
  onDelete: (groupId: string) => void;
  cost?: GroupCost;
  canManage?: boolean;
}

const getServerNames = (servers: string[] | IGroupServerConfig[]): string[] =>
  servers.map((server) => (typeof server === 'string' ? server : server.name));

const getServerConfig = (group: Group, serverName: string): IGroupServerConfig => {
  const server = group.servers.find((s) =>
    typeof s === 'string' ? s === serverName : s.name === serverName,
  );
  if (!server) return { name: serverName, tools: 'all', prompts: 'all', resources: 'all' };
  if (typeof server === 'string') {
    return { name: server, tools: 'all', prompts: 'all', resources: 'all' };
  }
  return server;
};

const getServerDisplayName = (group: Group, serverName: string): string => {
  const config = getServerConfig(group, serverName);
  return config.alias?.trim() || serverName;
};

const copyText = async (value: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* noop */
  }
  try {
    const el = document.createElement('textarea');
    el.value = value;
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
};

const GroupCard = ({ group, servers, onEdit, onDelete, cost, canManage = false }: GroupCardProps) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { installConfig, nameSeparator } = useSettingsData();
  const baseUrl = installConfig?.baseUrl?.replace(/\/+$/, '') || '';

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCopyDropdown, setShowCopyDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCopyDropdown(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const doCopy = async (text: string) => {
    const ok = await copyText(text);
    if (ok) {
      setCopied(true);
      setShowCopyDropdown(false);
      showToast(t('common.copySuccess') || 'Copied', 'success');
      setTimeout(() => setCopied(false), 1500);
    } else {
      showToast(t('common.copyFailed') || 'Copy failed', 'error');
    }
  };

  const groupEndpoint = `${baseUrl}/mcp/${group.name}`;

  const serverNames = getServerNames(group.servers);
  const groupServers = servers.filter((s) => serverNames.includes(s.name));

  const tally = (server: Server) => {
    const cfg = getServerConfig(group, server.name);
    const prefix = `${server.name}${nameSeparator}`;
    const allTools = server.tools || [];
    const allPrompts = server.prompts || [];
    const allResources = server.resources || [];

    const visibleTools = Array.isArray(cfg.tools)
      ? allTools.filter((t) => {
          if (t.enabled === false) return false;
          const short = t.name.startsWith(prefix) ? t.name.slice(prefix.length) : t.name;
          return cfg.tools!.includes(short);
        }).length
      : allTools.filter((t) => t.enabled !== false).length;
    const visiblePrompts = Array.isArray(cfg.prompts)
      ? allPrompts.filter((p) => {
          if (p.enabled === false) return false;
          const short = p.name.startsWith(prefix) ? p.name.slice(prefix.length) : p.name;
          return cfg.prompts!.includes(short);
        }).length
      : allPrompts.filter((p) => p.enabled !== false).length;
    const visibleResources = Array.isArray(cfg.resources)
      ? allResources.filter((r) => r.enabled !== false && cfg.resources!.includes(r.uri)).length
      : allResources.filter((r) => r.enabled !== false).length;

    return {
      visibleTools,
      totalTools: allTools.length,
      visiblePrompts,
      totalPrompts: allPrompts.length,
      visibleResources,
      totalResources: allResources.length,
    };
  };

  const totalVisibleTools = groupServers.reduce((acc, s) => acc + tally(s).visibleTools, 0);

  const statusDot =
    (status: Server['status']) =>
      status === 'connected' ? 'is-ok' : status === 'connecting' ? 'is-warn' : 'is-err';

  return (
    <div className="group-card">
      <div className="group-card-head">
        <div className="min-w-0">
          <div className="group-name truncate">{group.name}</div>
          {group.description ? (
            <div className="ylune-help" style={{ margin: 0 }} title={group.description}>
              {group.description}
            </div>
          ) : null}
        </div>
        <div className="group-card-acts" ref={dropdownRef}>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCopyDropdown((v) => !v)}
              className="hub-icon-btn sm"
              title={t('common.copy')}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
            {showCopyDropdown && (
              <div className="group-popover">
                <button type="button" onClick={() => doCopy(group.id)}>
                  <Copy size={12} /> {t('common.copyId')}
                </button>
                <button type="button" onClick={() => doCopy(groupEndpoint)}>
                  <LinkIcon size={12} /> {t('common.copyUrl')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    doCopy(
                      JSON.stringify(
                        {
                          mcpServers: {
                            [group.name]: {
                              url: groupEndpoint,
                              headers: { Authorization: 'Bearer <your-access-token>' },
                            },
                          },
                        },
                        null,
                        2,
                      ),
                    )
                  }
                >
                  <FileCode size={12} /> {t('common.copyJson')}
                </button>
              </div>
            )}
          </div>
          {canManage && (
            <>
              <button
                type="button"
                onClick={() => onEdit(group)}
                className="hub-icon-btn sm"
                title={t('groups.edit')}
              >
                <Edit3 size={13} />
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteDialog(true)}
                className="hub-icon-btn sm"
                title={t('groups.delete')}
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="group-card-body">
        <div className="srv-list">
          {groupServers.length === 0 ? (
            <div className="ylune-help" style={{ margin: 0 }}>
              {t('groups.noServers')}
            </div>
          ) : (
            groupServers.map((s) => {
              const tn = tally(s);
              return (
                <div key={s.name} className="srv-chip">
                  <span className={`dot ${statusDot(s.status)}`} />
                  <span className="truncate" title={s.name}>
                    {getServerDisplayName(group, s.name)}
                  </span>
                  <span className="srv-tools mono">
                    {tn.visibleTools}/{tn.totalTools} tools
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="ylune-help" style={{ margin: 0 }}>
          {t('groups.memberCount', { count: (group.members || []).length })}
          {(group.members || []).length > 0 ? `: ${(group.members || []).join(', ')}` : ''}
        </div>

        <div className="endpoint">
          <span className="endpoint-label mono">ENDPOINT</span>
          <span className="endpoint-path" title={groupEndpoint}>
            /mcp/{group.name}
          </span>
          <button type="button" className="copy-btn" onClick={() => doCopy(groupEndpoint)}>
            <Copy size={12} /> {copied ? 'COPIED' : 'COPY'}
          </button>
        </div>
      </div>

      <div className="group-card-foot">
        <div>
          <div>
            {groupServers.length} {t('nav.servers').toLowerCase()} · {totalVisibleTools}{' '}
            {t('server.tools').toLowerCase()}
          </div>
          {cost && (
            <div className="mono" title={t('cost.estimate')}>
              {t('cost.totalFootprint')}: {formatTokens(cost.direct.exposed)}/
              {formatTokens(cost.direct.gross)}
              {cost.smartRouting && (
                <>
                  {' · '}
                  {t('cost.smartRouting')}: {formatTokens(cost.smartRouting.base)} (
                  {t('cost.saved', {
                    percent: percentSaved(cost.direct.exposed, cost.smartRouting.base),
                  })}
                  )
                </>
              )}
              {cost.connectedCount < cost.totalCount && (
                <>
                  {' · '}
                  {t('cost.connectedOf', {
                    connected: cost.connectedCount,
                    total: cost.totalCount,
                  })}
                </>
              )}
            </div>
          )}
        </div>
        {canManage ? (
          <button type="button" className="cfg-link" onClick={() => onEdit(group)}>
            {t('groups.configureTools') || t('groups.edit')} →
          </button>
        ) : (
          <span className="ylune-help" style={{ margin: 0 }}>
            {t('groups.readOnlyHint')}
          </span>
        )}
      </div>

      <DeleteDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={() => {
          onDelete(group.id);
          setShowDeleteDialog(false);
        }}
        serverName={group.name}
        isGroup={true}
      />
    </div>
  );
};

export default GroupCard;
