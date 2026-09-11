import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useServerData } from '@/hooks/useServerData';
import { Credential, CredentialContract } from '@/types';
import {
  checkCredentialAvailable,
  createCredential,
  deleteCredential,
  getCredentialContracts,
  getCredentials,
  getCredentialValues,
  replaceCredentialSecret,
  setServerCredentials,
  testServerCredential,
  updateCredential,
} from '@/services/credentialService';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import YluneDialog from '@/components/ui/YluneDialog';
import KeyValueEditor, {
  collectFilledPairs,
  emptyPairs,
  keysToEmptyPairs,
  KvPair,
} from '@/components/KeyValueEditor';

const defaultCredentialPairs = (): KvPair[] => [
  { key: 'HOST', value: '' },
  { key: 'PORT', value: '' },
  { key: 'TOKEN', value: '' },
];

const uniqueCredentialName = (base: string, taken: string[]): string => {
  const used = new Set(taken);
  if (!used.has(base)) {
    return base;
  }
  let index = 2;
  while (used.has(`${base}-${index}`)) {
    index += 1;
  }
  return `${base}-${index}`;
};

const pairsForMcp = (contract?: CredentialContract): KvPair[] =>
  contract && contract.neededKeys.length > 0
    ? keysToEmptyPairs(contract.neededKeys)
    : defaultCredentialPairs();

const mcpBindRank = (contract: CredentialContract): number => {
  if (contract.neededKeys.length > 0 && contract.credentialIds.length === 0) {
    return 0;
  }
  if (contract.credentialIds.length > 0) {
    return 1;
  }
  return 2;
};

const CredentialCenterPage = () => {
  const { t } = useTranslation();
  const { auth } = useAuth();
  const { triggerRefresh } = useServerData();
  const isAdmin = auth.user?.isAdmin === true;
  const [available, setAvailable] = useState(false);
  const [items, setItems] = useState<Credential[]>([]);
  const [contracts, setContracts] = useState<CredentialContract[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createBindTo, setCreateBindTo] = useState('');
  const [createName, setCreateName] = useState('');
  const [createPairs, setCreatePairs] = useState<KvPair[]>(defaultCredentialPairs());
  const [existingPick, setExistingPick] = useState<Record<string, string>>({});
  const [replacing, setReplacing] = useState<Credential | null>(null);
  const [replacePairs, setReplacePairs] = useState<KvPair[]>(emptyPairs(1));
  const [replaceLoading, setReplaceLoading] = useState(false);
  const replaceRequest = useRef(0);
  const [deleting, setDeleting] = useState<Credential | null>(null);
  const [toggling, setToggling] = useState<Credential | null>(null);
  const [testStatus, setTestStatus] = useState<{
    serverName: string;
    credentialId: string;
    ok: boolean;
    message: string;
  } | null>(null);
  const load = async () => {
    const storeOn = await checkCredentialAvailable();
    setAvailable(storeOn);
    if (!storeOn) {
      setItems([]);
      setContracts([]);
      return;
    }
    const [credRes, contractRes] = await Promise.all([getCredentials(), getCredentialContracts()]);
    if (credRes?.success && Array.isArray(credRes.data)) {
      setItems(credRes.data);
      setError(null);
    } else {
      setError(credRes?.message || t('credentials.createError'));
    }
    if (contractRes?.success && Array.isArray(contractRes.data)) {
      setContracts(contractRes.data);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      void load();
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="hub-card p-6 text-center" style={{ color: 'var(--hub-err)' }}>
        {t('credentials.adminRequired')}
      </div>
    );
  }

  const boundServersOf = (credentialId: string) =>
    contracts
      .filter((contract) => contract.credentialIds.includes(credentialId))
      .map((contract) => contract.serverName);

  const openCreate = (serverName = '') => {
    setCreating(true);
    setCreateBindTo(serverName);
    setCreateName(
      uniqueCredentialName(serverName || 'readonly-prod', items.map((item) => item.name)),
    );
    setCreatePairs(pairsForMcp(contracts.find((row) => row.serverName === serverName)));
    setError(null);
  };

  const closeCreate = () => {
    setCreating(false);
    setCreateBindTo('');
  };

  const submitCreate = async () => {
    if (!createName.trim()) {
      setError(t('credentials.nameRequired'));
      return;
    }
    const collected = collectFilledPairs(createPairs);
    if ('error' in collected) {
      setError(t('credentials.fieldsRequired'));
      return;
    }
    setBusy(true);
    const result = await createCredential({
      name: createName.trim(),
      fields: collected.fields,
    });
    if (!result?.success || !result.data) {
      setBusy(false);
      setError(result?.message || t('credentials.createError'));
      return;
    }
    if (createBindTo) {
      const current = contracts.find((row) => row.serverName === createBindTo)?.credentialIds || [];
      const bindResult = await setServerCredentials(createBindTo, [...new Set([...current, result.data.id])]);
      if (!bindResult?.success) {
        setBusy(false);
        setError(bindResult?.message || t('credentials.bindError'));
        closeCreate();
        await load();
        return;
      }
    }
    setBusy(false);
    closeCreate();
    await load();
    triggerRefresh();
  };

  const closeReplace = () => {
    replaceRequest.current += 1;
    setReplacing(null);
    setReplacePairs(emptyPairs(1));
    setReplaceLoading(false);
  };

  const openReplace = async (item: Credential) => {
    const request = ++replaceRequest.current;
    setReplacing(item);
    setReplacePairs(keysToEmptyPairs(item.keys || []));
    setReplaceLoading(true);
    setError(null);
    const result = await getCredentialValues(item.id);
    if (request !== replaceRequest.current) {
      return;
    }
    setReplaceLoading(false);
    if (!result?.success || !Array.isArray(result.data?.pairs)) {
      setError(result?.message || t('credentials.loadValuesError'));
      return;
    }
    setReplacePairs(result.data.pairs.length ? result.data.pairs : keysToEmptyPairs(item.keys || []));
  };

  const submitReplace = async () => {
    if (!replacing) return;
    const collected = collectFilledPairs(replacePairs);
    if ('error' in collected) {
      setError(t('credentials.fieldsRequired'));
      return;
    }
    setBusy(true);
    const result = await replaceCredentialSecret(replacing.id, { fields: collected.fields });
    setBusy(false);
    if (result?.success) {
      closeReplace();
      await load();
    } else {
      setError(result?.message || t('credentials.updateError'));
    }
  };

  const bindExisting = async (serverName: string, credentialId: string) => {
    if (!credentialId) {
      return;
    }
    const current = contracts.find((row) => row.serverName === serverName)?.credentialIds || [];
    setBusy(true);
    const result = await setServerCredentials(serverName, [...new Set([...current, credentialId])]);
    setBusy(false);
    setExistingPick((prev) => ({ ...prev, [serverName]: '' }));
    if (!result?.success) {
      setError(result?.message || t('credentials.bindError'));
      return;
    }
    await load();
    triggerRefresh();
  };

  const unbindSelected = async (serverName: string, credentialId: string) => {
    if (!credentialId) {
      return;
    }
    const current = contracts.find((row) => row.serverName === serverName)?.credentialIds || [];
    setBusy(true);
    const result = await setServerCredentials(
      serverName,
      current.filter((id) => id !== credentialId),
    );
    setBusy(false);
    if (!result?.success) {
      setError(result?.message || t('credentials.bindError'));
      return;
    }
    await load();
  };

  const runTest = async (serverName: string, credentialId: string) => {
    if (!credentialId) {
      setTestStatus({ serverName, credentialId: '', ok: false, message: t('credentials.noneBound') });
      return;
    }
    setBusy(true);
    setTestStatus(null);
    const result = await testServerCredential(serverName, credentialId);
    setBusy(false);
    setTestStatus({
      serverName,
      credentialId,
      ok: Boolean(result?.success),
      message: result?.message || (result?.success ? t('credentials.testOk') : t('credentials.testFail')),
    });
    if (result?.success) {
      triggerRefresh();
    }
  };

  const sortedContracts = [...contracts].sort((left, right) => {
    const rank = mcpBindRank(left) - mcpBindRank(right);
    if (rank !== 0) {
      return rank;
    }
    return left.serverName.localeCompare(right.serverName);
  });

  return (
    <div className="hub-page-stack cred-center">
      <div className="hub-page-head">
        <div>
          <h1 className="hub-h1">{t('credentials.title')}</h1>
          <p className="hub-sub">{t('credentials.hint')}</p>
        </div>
        <div className="view-actions">
          <button className="hub-btn" onClick={() => void load()} aria-label={t('common.refresh')}>
            <RefreshCw size={13} /> {t('common.refresh')}
          </button>
          {available && (
            <button className="hub-btn primary" onClick={() => openCreate()}>
              <Plus size={13} /> {t('credentials.add')}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="ylune-error">
          {error}
        </div>
      )}
      {!available ? (
            <div className="hub-card p-6">
              <p className="ylune-help">{t('credentials.unavailable')}</p>
            </div>
          ) : (
            <div className="cred-center-stack">
              {items.length === 0 ? (
                <div className="hub-card">
                  <div className="hub-empty">
                    <p className="hub-empty-title">{t('credentials.empty')}</p>
                    <button type="button" className="hub-btn primary" onClick={() => openCreate()}>
                      <Plus size={13} /> {t('credentials.addFirst')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="hub-card overflow-hidden credentials-table">
                  <div className="hub-row head hub-mono">
                    <div>{t('credentials.name')}</div>
                    <div>{t('credentials.keys')}</div>
                    <div>{t('credentials.boundServers')}</div>
                    <div className="text-right">{t('users.actions')}</div>
                  </div>
                  {items.map((item) => {
                    const bound = boundServersOf(item.id);
                    return (
                      <div key={item.id} className="hub-row hover">
                        <div className="hub-mono">{item.name}</div>
                        <div className="hub-key-chips">
                          {(item.keys || []).length === 0
                            ? '—'
                            : item.keys.map((key) => (
                                <span key={key} className="hub-kbd">
                                  {key}
                                </span>
                              ))}
                        </div>
                        <div className="hub-key-chips">
                          {bound.length === 0
                            ? t('credentials.noBind')
                            : bound.map((serverName) => (
                                <span key={serverName} className="hub-tag muted">
                                  {serverName}
                                </span>
                              ))}
                        </div>
                        <div className="flex justify-end gap-1 flex-wrap">
                          <button
                            type="button"
                            className="hub-btn"
                            onClick={() => void openReplace(item)}
                          >
                            {t('credentials.replace')}
                          </button>
                          <button type="button" className="hub-btn" onClick={() => setToggling(item)}>
                            {item.enabled ? t('credentials.disabled') : t('credentials.enabled')}
                          </button>
                          <button
                            type="button"
                            className="hub-icon-btn sm"
                            title={t('credentials.delete')}
                            style={{ color: 'var(--hub-err)' }}
                            onClick={() => setDeleting(item)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {sortedContracts.length > 0 && (
                <div className="hub-card overflow-hidden">
                  <div className="mcp-bind-intro">
                    <div className="ylune-server-name">{t('credentials.bindSection')}</div>
                    <p className="ylune-help">{t('credentials.bindSectionHint')}</p>
                  </div>
                  {sortedContracts.map((contract) => {
                    const candidates = items.filter(
                      (item) => item.enabled && !contract.credentialIds.includes(item.id),
                    );
                    const declared = contract.neededKeys.length > 0;
                    const bound = contract.credentials.length > 0;
                    const quiet = !declared && !bound;
                    return (
                      <div
                        key={contract.serverName}
                        className={`mcp-bind-card${quiet ? ' is-quiet' : ''}`}
                      >
                        <div className="mcp-bind-head">
                          <div className="mcp-bind-title">
                            <div className="mcp-bind-name">{contract.serverName}</div>
                            <div className="mcp-bind-flags">
                              {contract.enabled === false && (
                                <span className="hub-tag muted">{t('credentials.serverDisabled')}</span>
                              )}
                              {bound ? (
                                <span className="hub-status ok">
                                  <span className="hub-dot" />
                                  {t('credentials.boundCount', { count: contract.credentials.length })}
                                </span>
                              ) : declared ? (
                                <span className="hub-status warn">
                                  <span className="hub-dot" />
                                  {t('credentials.needsUnbound')}
                                </span>
                              ) : (
                                <span className="hub-status muted">
                                  <span className="hub-dot" />
                                  {t('credentials.needsUndeclared')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mcp-bind-add">
                            {candidates.length > 0 && (
                              <select
                                className="hub-input"
                                value={existingPick[contract.serverName] || ''}
                                disabled={busy}
                                onChange={(event) => {
                                  const credentialId = event.target.value;
                                  setExistingPick((prev) => ({
                                    ...prev,
                                    [contract.serverName]: credentialId,
                                  }));
                                  void bindExisting(contract.serverName, credentialId);
                                }}
                              >
                                <option value="">{t('credentials.useExisting')}</option>
                                {candidates.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.name}
                                  </option>
                                ))}
                              </select>
                            )}
                            <button
                              type="button"
                              className="hub-btn"
                              onClick={() => openCreate(contract.serverName)}
                            >
                              {t('credentials.createAndBind')}
                            </button>
                          </div>
                        </div>
                        {declared ? (
                          <div className="mcp-cred-keys">
                            <span className="mcp-cred-keys-label">{t('credentials.needsDeclared')}</span>
                            {contract.neededKeys.map((key) => (
                              <span key={key} className="hub-kbd">
                                {key}
                              </span>
                            ))}
                          </div>
                        ) : quiet ? (
                          <p className="ylune-help">{t('credentials.needsUndeclaredHint')}</p>
                        ) : null}
                        {contract.credentials.length > 0 && (
                          <div className="mcp-bind-list">
                            {contract.credentials.map((credential) => (
                              <div key={credential.id} className="mcp-bind-item">
                                <div className="mcp-bind-cred">
                                  <span className="mcp-bind-cred-label">{t('credentials.boundItem')}</span>
                                  <span className="hub-mono">{credential.name}</span>
                                  {(credential.keys || []).length > 0 && (
                                    <span className="hub-key-chips">
                                      {credential.keys.map((key) => (
                                        <span key={key} className="hub-kbd">
                                          {key}
                                        </span>
                                      ))}
                                    </span>
                                  )}
                                </div>
                                <div className="mcp-bind-item-actions">
                                  <button
                                    type="button"
                                    className="hub-btn"
                                    disabled={busy}
                                    onClick={() => void runTest(contract.serverName, credential.id)}
                                  >
                                    {t('credentials.testWithMcp')}
                                  </button>
                                  <button
                                    type="button"
                                    className="hub-btn"
                                    disabled={busy}
                                    onClick={() => void unbindSelected(contract.serverName, credential.id)}
                                  >
                                    {t('credentials.unbind')}
                                  </button>
                                </div>
                                {testStatus?.serverName === contract.serverName &&
                                  testStatus.credentialId === credential.id && (
                                    <p
                                      className={`mcp-cred-status ${testStatus.ok ? 'ylune-help' : 'ylune-error'}`}
                                    >
                                      {testStatus.message}
                                    </p>
                                  )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

      {creating && (
        <YluneDialog
          size="lg"
          title={
            createBindTo
              ? t('credentials.createFor', { server: createBindTo })
              : t('credentials.add')
          }
          onClose={closeCreate}
          footer={
            <>
              <button type="button" className="hub-btn" onClick={closeCreate}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="hub-btn primary"
                disabled={busy}
                onClick={() => void submitCreate()}
              >
                {t('common.create')}
              </button>
            </>
          }
        >
          <p className="ylune-help" style={{ marginTop: 0 }}>
            {t('credentials.createStandaloneHint')}
          </p>
          {error ? <p className="ylune-error">{error}</p> : null}
          <div className="ylune-field">
            <label className="ylune-label">{t('credentials.name')}</label>
            <input
              className="hub-input"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder={t('credentials.namePlaceholder')}
            />
          </div>
          <div className="ylune-field">
            <label className="ylune-label">{t('credentials.optionalBind')}</label>
            <select
              className="hub-input"
              value={createBindTo}
              onChange={(event) => {
                const serverName = event.target.value;
                setCreateBindTo(serverName);
                if (createPairs.every((row) => row.value === '')) {
                  setCreatePairs(pairsForMcp(contracts.find((row) => row.serverName === serverName)));
                }
              }}
            >
              <option value="">{t('credentials.noBind')}</option>
              {sortedContracts.map((contract) => {
                const parts = [contract.serverName];
                if (contract.enabled === false) {
                  parts.push(t('credentials.serverDisabled'));
                }
                if (contract.neededKeys.length > 0) {
                  parts.push(t('credentials.needCount', { count: contract.neededKeys.length }));
                }
                return (
                  <option key={contract.serverName} value={contract.serverName}>
                    {parts.join(' · ')}
                  </option>
                );
              })}
            </select>
          </div>
          <KeyValueEditor
            pairs={createPairs}
            onChange={setCreatePairs}
            label={t('credentials.fields')}
            hint={
              (contracts.find((row) => row.serverName === createBindTo)?.neededKeys.length || 0) > 0
                ? t('credentials.importFromMcpHint')
                : t('credentials.fieldsHint')
            }
            keyPlaceholder={t('credentials.fieldKeyExample')}
          />
        </YluneDialog>
      )}

      {replacing && (
        <YluneDialog
          size="lg"
          title={`${t('credentials.replace')} · ${replacing.name}`}
          onClose={closeReplace}
          footer={
            <>
              <button type="button" className="hub-btn" onClick={closeReplace}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="hub-btn primary"
                disabled={busy || replaceLoading}
                onClick={() => void submitReplace()}
              >
                {t('credentials.replace')}
              </button>
            </>
          }
        >
          {error ? <p className="ylune-error">{error}</p> : null}
          <KeyValueEditor
            pairs={replacePairs}
            onChange={setReplacePairs}
            disabled={replaceLoading}
            label={t('credentials.fields')}
            hint={replaceLoading ? t('credentials.replaceLoading') : t('credentials.replaceHint')}
            keyPlaceholder={t('credentials.fieldKeyExample')}
            valuePlaceholder={t('credentials.fieldValue')}
          />
        </YluneDialog>
      )}

      <ConfirmDialog
        isOpen={!!toggling}
        onClose={() => setToggling(null)}
        title={toggling?.enabled ? t('credentials.disabled') : t('credentials.enabled')}
        message={toggling?.name || ''}
        confirmText={t('common.confirm')}
        onConfirm={async () => {
          if (!toggling) return;
          const result = await updateCredential(toggling.id, { enabled: !toggling.enabled });
          setToggling(null);
          if (result?.success) {
            await load();
          } else {
            setError(result?.message || t('credentials.updateError'));
          }
        }}
      />

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        title={t('credentials.delete')}
        message={t('credentials.deleteWarning', { name: deleting?.name || '' })}
        confirmText={t('common.delete')}
        variant="danger"
        onConfirm={async () => {
          if (!deleting) return;
          const result = await deleteCredential(deleting.id);
          setDeleting(null);
          if (result?.success) {
            await load();
          } else {
            setError(result?.message || t('credentials.deleteError'));
          }
        }}
      />
    </div>
  );
};

export default CredentialCenterPage;
