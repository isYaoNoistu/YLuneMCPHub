import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useServerData } from '@/hooks/useServerData';
import { useUserData } from '@/hooks/useUserData';
import { callTool } from '@/services/toolService';
import { summarizeGrants } from '@/utils/grantPreview';
import { Server, Tool } from '@/types';

const shortName = (serverName: string, toolName: string): string => {
  const prefix = `${serverName}-`;
  return toolName.startsWith(prefix) ? toolName.slice(prefix.length) : toolName;
};

const LabPage = () => {
  const { t } = useTranslation();
  const { auth } = useAuth();
  const isAdmin = auth.user?.isAdmin === true;
  const { allServers } = useServerData();
  const { users } = useUserData();
  const [asUser, setAsUser] = useState(auth.user?.username || '');
  const [serverName, setServerName] = useState('');
  const [toolName, setToolName] = useState('');
  const [argsText, setArgsText] = useState('{}');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');

  const selectedUser = users.find((user) => user.username === asUser);
  const preview = summarizeGrants(
    selectedUser?.grants,
    allServers,
    selectedUser?.isAdmin || (!selectedUser && isAdmin),
  );
  const allowedServers = useMemo(() => {
    if (selectedUser?.isAdmin || (!selectedUser && isAdmin)) {
      return allServers.filter((server) => server.enabled !== false);
    }
    const names = new Set(preview.map((row) => row.server));
    return allServers.filter((server) => names.has(server.name));
  }, [allServers, isAdmin, preview, selectedUser]);

  const currentServer: Server | undefined = allowedServers.find((server) => server.name === serverName);
  const tools: Tool[] = currentServer?.tools || [];
  const allowedToolNames = preview.find((row) => row.server === serverName)?.tools;

  const visibleTools = tools.filter((tool) => {
    if (!allowedToolNames || preview.find((row) => row.server === serverName)?.allTools) {
      return true;
    }
    return allowedToolNames.includes(shortName(serverName, tool.name));
  });

  const run = async () => {
    setBusy(true);
    setResult('');
    try {
      let parsed: Record<string, unknown> = {};
      if (argsText.trim()) {
        parsed = JSON.parse(argsText) as Record<string, unknown>;
      }
      const accessToken = selectedUser?.isAdmin ? undefined : selectedUser?.token;
      if (selectedUser && !selectedUser.isAdmin && !accessToken) {
        setResult(t('lab.noToken'));
        return;
      }
      const response = await callTool({ toolName, arguments: parsed }, serverName, accessToken);
      setResult(JSON.stringify(response, null, 2));
    } catch (error) {
      setResult(error instanceof Error ? error.message : t('lab.failed'));
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="hub-card p-6 text-center" style={{ color: 'var(--hub-err)' }}>
        {t('users.adminRequired')}
      </div>
    );
  }

  return (
    <div>
      <div className="hub-page-head">
        <div>
          <h1 className="hub-h1">{t('lab.title')}</h1>
          <p className="hub-sub">{t('lab.hint')}</p>
        </div>
      </div>

      <div className="hub-card" style={{ padding: 16 }}>
        <div className="ylune-dialog-body" style={{ padding: 0 }}>
          <label className="ylune-label">{t('lab.asUser')}</label>
          <select
            className="hub-input"
            value={asUser}
            onChange={(event) => {
              setAsUser(event.target.value);
              setServerName('');
              setToolName('');
            }}
          >
            {users.map((user) => (
              <option key={user.username} value={user.username}>
                {user.username}
                {user.isAdmin ? ` (${t('users.admin')})` : ''}
              </option>
            ))}
          </select>

          <label className="ylune-label">{t('nav.servers')}</label>
          <select
            className="hub-input"
            value={serverName}
            onChange={(event) => {
              setServerName(event.target.value);
              setToolName('');
            }}
          >
            <option value="">{t('lab.pickServer')}</option>
            {allowedServers.map((server) => (
              <option key={server.name} value={server.name}>
                {server.name}
              </option>
            ))}
          </select>

          <label className="ylune-label">{t('lab.tool')}</label>
          <select
            className="hub-input"
            value={toolName}
            onChange={(event) => setToolName(event.target.value)}
            disabled={!serverName}
          >
            <option value="">{t('lab.pickTool')}</option>
            {visibleTools.map((tool) => (
              <option key={tool.name} value={tool.name}>
                {shortName(serverName, tool.name)}
              </option>
            ))}
          </select>

          <label className="ylune-label">{t('lab.args')}</label>
          <textarea
            className="hub-input"
            rows={6}
            value={argsText}
            onChange={(event) => setArgsText(event.target.value)}
          />

          <button
            type="button"
            className="hub-btn primary"
            disabled={busy || !serverName || !toolName}
            onClick={run}
          >
            {busy ? t('common.processing') : t('lab.run')}
          </button>

          {result ? <pre className="ylune-code">{result}</pre> : null}
        </div>
      </div>
    </div>
  );
};

export default LabPage;
