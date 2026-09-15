import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import YluneDialog from '@/components/ui/YluneDialog';
import { getServerEnvPreflight } from '@/services/opsService';
import {
  getCredentialContracts,
  getCredentials,
  setServerCredentials,
  testServerCredential,
} from '@/services/credentialService';
import { Credential, CredentialContract, EnvPreflightItem } from '@/types';
import {
  appendBoundCredentialId,
  boundCredentialIdSet,
  canBindAfterSuccess,
  missingNeededKeys,
  sortCredentialsByName,
} from '@/utils/connectionPreflight';

type ConnectionPreflightDialogProps = {
  serverName: string;
  open: boolean;
  onClose: () => void;
  onServerChanged?: () => void;
};

type TestResult = {
  credentialId: string;
  ok: boolean;
  toolCount: number;
  message: string;
};

const ConnectionPreflightDialog = ({
  serverName,
  open,
  onClose,
  onServerChanged,
}: ConnectionPreflightDialogProps) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'env' | 'credential'>('env');
  const [variables, setVariables] = useState<EnvPreflightItem[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [contract, setContract] = useState<CredentialContract | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [binding, setBinding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [preflight, credentialList, contracts] = await Promise.all([
        getServerEnvPreflight(serverName),
        getCredentials(),
        getCredentialContracts(),
      ]);
      setVariables(preflight?.data?.variables || []);
      const enabled = (credentialList?.data || []).filter((item) => item.enabled !== false);
      setCredentials(sortCredentialsByName(enabled));
      setContract((contracts?.data || []).find((row) => row.serverName === serverName) || null);
      setSelectedId((current) => {
        if (current && enabled.some((item) => item.id === current)) {
          return current;
        }
        return enabled[0]?.id || '';
      });
    } catch {
      setError(t('server.preflightLoadError'));
    } finally {
      setLoading(false);
    }
  }, [serverName, t]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setTab('env');
    setTestResult(null);
    void loadData();
  }, [open, loadData]);

  const boundIds = useMemo(() => [...boundCredentialIdSet(contract)], [contract]);
  const selected = credentials.find((item) => item.id === selectedId);
  const missing = selected
    ? missingNeededKeys(contract?.neededKeys || [], selected.keys)
    : [];
  const showBind = canBindAfterSuccess(
    testResult?.credentialId,
    boundIds,
    Boolean(testResult?.ok && testResult.credentialId === selectedId),
  );

  const sourceLabel = (item: EnvPreflightItem): string => {
    if (item.source === 'process_env') {
      return t('server.envSourceProcess');
    }
    if (item.source === 'credential') {
      return t('server.envSourceCredential');
    }
    return t('server.envMissing');
  };

  const runTest = async () => {
    if (!selectedId || testing) {
      return;
    }
    setTesting(true);
    setError(null);
    const result = await testServerCredential(serverName, selectedId);
    setTesting(false);
    setTestResult({
      credentialId: selectedId,
      ok: Boolean(result?.success && result?.data?.ok !== false),
      toolCount: result?.data?.toolCount ?? 0,
      message: result?.message || (result?.success ? t('credentials.testOk') : t('credentials.testFail')),
    });
    if (result?.success) {
      onServerChanged?.();
    }
  };

  const bindSelected = async () => {
    if (!selectedId || binding) {
      return;
    }
    setBinding(true);
    setError(null);
    const result = await setServerCredentials(
      serverName,
      appendBoundCredentialId(boundIds, selectedId),
    );
    setBinding(false);
    if (!result?.success) {
      setError(result?.message || t('credentials.bindError'));
      return;
    }
    onServerChanged?.();
    await loadData();
  };

  if (!open) {
    return null;
  }

  return (
    <YluneDialog
      title={`${t('server.connectionPreflight')} · ${serverName}`}
      onClose={onClose}
      size="lg"
      footer={
        <>
          {tab === 'credential' && (
            <>
              <button
                type="button"
                className="hub-btn primary"
                disabled={!selectedId || testing || loading}
                onClick={() => void runTest()}
              >
                {testing ? t('server.preflightTesting') : t('server.preflightTest')}
              </button>
              {showBind && (
                <button
                  type="button"
                  className="hub-btn"
                  disabled={binding}
                  onClick={() => void bindSelected()}
                >
                  {t('server.preflightBind')}
                </button>
              )}
            </>
          )}
          <button type="button" className="hub-btn" onClick={onClose}>
            {t('common.close')}
          </button>
        </>
      }
    >
      <div className="preflight-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'env'}
          className={`hub-btn${tab === 'env' ? ' primary' : ''}`}
          onClick={() => setTab('env')}
        >
          {t('server.preflightEnvTab')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'credential'}
          className={`hub-btn${tab === 'credential' ? ' primary' : ''}`}
          onClick={() => setTab('credential')}
        >
          {t('server.preflightCredentialTab')}
        </button>
      </div>

      {error && <p className="form-msg">{error}</p>}
      {loading && <p className="ylune-help">{t('app.loading')}</p>}

      {tab === 'env' && !loading && (
        <>
          <p className="ylune-help" style={{ marginTop: 0 }}>
            {t('server.envPreflightHint')}
          </p>
          {variables.length === 0 ? (
            <p className="ylune-help">{t('server.envPreflightEmpty')}</p>
          ) : (
            <ul className="grant-preview-list">
              {variables.map((item) => (
                <li key={item.name}>
                  <span className="hub-kbd">{item.name}</span>{' '}
                  <span className={`hub-status ${item.resolved ? 'ok' : 'err'}`}>
                    <i className="hub-dot" />
                    {item.resolved ? t('server.envResolved') : t('server.envMissing')}
                  </span>{' '}
                  <span className="ylune-help">{sourceLabel(item)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'credential' && !loading && (
        <>
          <p className="ylune-help" style={{ marginTop: 0 }}>
            {t('server.preflightSelectHint')}
          </p>
          {credentials.length === 0 ? (
            <p className="ylune-help">{t('server.preflightNoCredentials')}</p>
          ) : (
            <ul className="grant-preview-list preflight-cred-list">
              {credentials.map((item) => {
                const bound = boundIds.includes(item.id);
                const uncovered = missingNeededKeys(contract?.neededKeys || [], item.keys);
                const covered = (contract?.neededKeys || []).length - uncovered.length;
                const total = (contract?.neededKeys || []).length;
                return (
                  <li key={item.id}>
                    <label className="preflight-cred-row">
                      <input
                        type="radio"
                        name="preflight-credential"
                        checked={selectedId === item.id}
                        onChange={() => {
                          setSelectedId(item.id);
                          setTestResult(null);
                        }}
                      />
                      <span>
                        <strong>{item.name}</strong>
                        <span className={`hub-status ${bound ? 'ok' : 'muted'}`}>
                          <i className="hub-dot" />
                          {bound ? t('server.preflightBound') : t('server.preflightUnbound')}
                        </span>
                        {total > 0 && (
                          <span className="ylune-help">
                            {t('server.preflightKeyCoverage', { covered, total })}
                            {uncovered.length > 0
                              ? ` · ${t('server.preflightMissingKeys', { keys: uncovered.join(', ') })}`
                              : ''}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {selected && missing.length > 0 && (
            <p className="ylune-help">{t('server.preflightMissingKeys', { keys: missing.join(', ') })}</p>
          )}
          {testResult && testResult.credentialId === selectedId && (
            <p className={testResult.ok ? 'ylune-help' : 'form-msg'}>
              {testResult.message}
              {testResult.ok
                ? ` · ${t('server.preflightToolCount', { count: testResult.toolCount })}`
                : ''}
            </p>
          )}
        </>
      )}
    </YluneDialog>
  );
};

export default ConnectionPreflightDialog;
