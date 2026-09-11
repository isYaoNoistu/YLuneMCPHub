import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useServerData } from '@/hooks/useServerData';
import { useUserData } from '@/hooks/useUserData';
import { callTool } from '@/services/toolService';
import { summarizeGrants } from '@/utils/grantPreview';
import SchemaArgsForm, { exampleFromSchema } from '@/components/SchemaArgsForm';
import { Server, Tool } from '@/types';

const shortName = (serverName: string, toolName: string): string => {
  const prefix = `${serverName}-`;
  return toolName.startsWith(prefix) ? toolName.slice(prefix.length) : toolName;
};

const lastArgsKey = (user: string, server: string, tool: string) =>
  `ylune.lab.lastArgs.${user}.${server}.${tool}`;

const LabPage = () => {
  const { t } = useTranslation();
  const { auth } = useAuth();
  const isAdmin = auth.user?.isAdmin === true;
  const { allServers } = useServerData();
  const { users } = useUserData();
  const [asUser, setAsUser] = useState(auth.user?.username || '');
  const [serverName, setServerName] = useState('');
  const [toolName, setToolName] = useState('');
  const [args, setArgs] = useState<Record<string, unknown>>({});
  const [argsText, setArgsText] = useState('{}');
  const [mode, setMode] = useState<'form' | 'raw'>('form');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [meta, setMeta] = useState<{
    ok: boolean;
    ms: number;
    server: string;
    tool: string;
    asUser: string;
  } | null>(null);

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
  const currentTool = visibleTools.find((tool) => tool.name === toolName);

  useEffect(() => {
    if (!serverName || !toolName) return;
    const cached = sessionStorage.getItem(lastArgsKey(asUser, serverName, toolName));
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as Record<string, unknown>;
        setArgs(parsed);
        setArgsText(JSON.stringify(parsed, null, 2));
        return;
      } catch {
        /* ignore */
      }
    }
    const next = exampleFromSchema(currentTool?.inputSchema);
    setArgs(next);
    setArgsText(JSON.stringify(next, null, 2));
  }, [asUser, serverName, toolName, currentTool?.inputSchema]);

  const syncFromForm = (next: Record<string, unknown>) => {
    setArgs(next);
    setArgsText(JSON.stringify(next, null, 2));
  };

  const run = async () => {
    setBusy(true);
    setResult('');
    setMeta(null);
    const started = Date.now();
    try {
      let parsed = args;
      if (mode === 'raw') {
        parsed = argsText.trim() ? (JSON.parse(argsText) as Record<string, unknown>) : {};
      }
      const accessToken = selectedUser?.isAdmin ? undefined : selectedUser?.token;
      if (selectedUser && !selectedUser.isAdmin && !accessToken) {
        setResult(t('lab.noToken'));
        return;
      }
      const response = await callTool({ toolName, arguments: parsed }, serverName, accessToken);
      sessionStorage.setItem(lastArgsKey(asUser, serverName, toolName), JSON.stringify(parsed));
      setMeta({
        ok: response.success !== false && !response.error,
        ms: Date.now() - started,
        server: serverName,
        tool: shortName(serverName, toolName),
        asUser,
      });
      setResult(JSON.stringify(response, null, 2));
    } catch (error) {
      setMeta({
        ok: false,
        ms: Date.now() - started,
        server: serverName,
        tool: shortName(serverName, toolName),
        asUser,
      });
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
    <div className="hub-page-stack">
      <div className="hub-page-head">
        <div>
          <h1 className="hub-h1">{t('lab.title')}</h1>
          <p className="hub-sub">{t('lab.hint')}</p>
        </div>
      </div>

      <div className="hub-card lab-card">
        <div className="ylune-dialog-body">
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

          <div className="flex gap-2 mb-2">
            <button
              type="button"
              className={`hub-btn${mode === 'form' ? ' primary' : ''}`}
              onClick={() => setMode('form')}
            >
              {t('lab.formTab')}
            </button>
            <button
              type="button"
              className={`hub-btn${mode === 'raw' ? ' primary' : ''}`}
              onClick={() => setMode('raw')}
            >
              {t('lab.rawTab')}
            </button>
            <button
              type="button"
              className="hub-btn"
              onClick={() => syncFromForm(exampleFromSchema(currentTool?.inputSchema))}
            >
              {t('lab.fillExample')}
            </button>
            <button type="button" className="hub-btn" onClick={() => syncFromForm({})}>
              {t('lab.clear')}
            </button>
          </div>

          {mode === 'form' ? (
            <SchemaArgsForm schema={currentTool?.inputSchema} value={args} onChange={syncFromForm} />
          ) : (
            <>
              <label className="ylune-label">{t('lab.args')}</label>
              <textarea
                className="hub-input"
                rows={6}
                value={argsText}
                onChange={(event) => setArgsText(event.target.value)}
              />
            </>
          )}

          <button
            type="button"
            className="hub-btn primary"
            disabled={busy || !serverName || !toolName}
            onClick={() => void run()}
            style={{ marginTop: 12 }}
          >
            {busy ? t('common.processing') : t('lab.run')}
          </button>

          {meta && (
            <p className="ylune-help" style={{ marginTop: 12 }}>
              {meta.ok ? t('lab.resultSuccess') : t('lab.resultError')} · {meta.ms}ms · {meta.server} ·{' '}
              {meta.tool} · {t('lab.asUser')}: {meta.asUser}
            </p>
          )}
          {result ? <pre className="ylune-code">{result}</pre> : null}
        </div>
      </div>
    </div>
  );
};

export default LabPage;
