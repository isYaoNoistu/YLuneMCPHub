import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Credential, CredentialContract, ResourceGroup, ResourceTarget } from '@/types';
import {
  checkCredentialAvailable,
  createCredential,
  deleteCredential,
  getCredentialContracts,
  getCredentials,
  replaceCredentialSecret,
  setServerCredentials,
  testServerCredential,
  updateCredential,
} from '@/services/credentialService';
import { getResourceGroups, getResourceTargets } from '@/services/resourceBindingService';
import { useServerData } from '@/hooks/useServerData';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import YluneDialog from '@/components/ui/YluneDialog';
import KeyValueEditor, {
  collectFilledPairs,
  emptyPairs,
  keysToEmptyPairs,
  KvPair,
} from '@/components/KeyValueEditor';
import ResourceTargetPanel from '@/components/ResourceTargetPanel';
import ResourceGroupPanel from '@/components/ResourceGroupPanel';

type TabId = 'credentials' | 'targets' | 'groups';

const CredentialCenterPage = () => {
  const { t } = useTranslation();
  const { auth } = useAuth();
  const isAdmin = auth.user?.isAdmin === true;
  const [tab, setTab] = useState<TabId>('credentials');
  const [available, setAvailable] = useState(false);
  const [items, setItems] = useState<Credential[]>([]);
  const [contracts, setContracts] = useState<CredentialContract[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createPairs, setCreatePairs] = useState<KvPair[]>(emptyPairs(2));
  const [createFromServer, setCreateFromServer] = useState('');
  const [bindOnCreate, setBindOnCreate] = useState(true);
  const [replacing, setReplacing] = useState<Credential | null>(null);
  const [replacePairs, setReplacePairs] = useState<KvPair[]>(emptyPairs(1));
  const [deleting, setDeleting] = useState<Credential | null>(null);
  const [toggling, setToggling] = useState<Credential | null>(null);
  const [binding, setBinding] = useState<Credential | null>(null);
  const [bindServerNames, setBindServerNames] = useState<string[]>([]);
  const [testing, setTesting] = useState<Credential | null>(null);
  const [testServerName, setTestServerName] = useState('');
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [targets, setTargets] = useState<ResourceTarget[]>([]);
  const [groups, setGroups] = useState<ResourceGroup[]>([]);
  const [creatingTarget, setCreatingTarget] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const { allServers } = useServerData();

  const serversForCredential = (id: string) =>
    contracts.filter((contract) => contract.credentialIds.includes(id)).map((row) => row.serverName);

  const load = async () => {
    const storeOn = await checkCredentialAvailable();
    setAvailable(storeOn);
    if (!storeOn) {
      setItems([]);
      setContracts([]);
      return;
    }
    const [credRes, targetRes, groupRes, contractRes] = await Promise.all([
      getCredentials(),
      getResourceTargets(),
      getResourceGroups(),
      getCredentialContracts(),
    ]);
    if (credRes?.success && Array.isArray(credRes.data)) {
      setItems(credRes.data);
      setError(null);
    } else {
      setError(credRes?.message || t('credentials.createError'));
    }
    if (targetRes?.success && Array.isArray(targetRes.data)) {
      setTargets(targetRes.data);
    }
    if (groupRes?.success && Array.isArray(groupRes.data)) {
      setGroups(groupRes.data);
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

  const applyMcpTemplate = (serverName: string) => {
    setCreateFromServer(serverName);
    const contract = contracts.find((row) => row.serverName === serverName);
    if (contract?.neededKeys.length) {
      setCreatePairs(keysToEmptyPairs(contract.neededKeys));
    } else {
      setCreatePairs(emptyPairs(2));
    }
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
    if (result?.success && result.data && bindOnCreate && createFromServer) {
      const current = contracts.find((row) => row.serverName === createFromServer)?.credentialIds || [];
      const bindResult = await setServerCredentials(createFromServer, [...new Set([...current, result.data.id])]);
      if (!bindResult?.success) {
        setBusy(false);
        setError(bindResult?.message || t('credentials.bindError'));
        await load();
        return;
      }
    }
    setBusy(false);
    if (result?.success) {
      setShowCreate(false);
      setCreateName('');
      setCreatePairs(emptyPairs(2));
      setCreateFromServer('');
      setBindOnCreate(true);
      await load();
    } else {
      setError(result?.message || t('credentials.createError'));
    }
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
      setReplacing(null);
      setReplacePairs(emptyPairs(1));
      await load();
    } else {
      setError(result?.message || t('credentials.updateError'));
    }
  };

  const submitBind = async () => {
    if (!binding) return;
    setBusy(true);
    const currentlyBound = serversForCredential(binding.id);
    const nextBound = new Set(bindServerNames);
    const changed = new Set([...currentlyBound, ...bindServerNames]);
    for (const serverName of changed) {
      const contract = contracts.find((row) => row.serverName === serverName);
      const ids = new Set(contract?.credentialIds || []);
      if (nextBound.has(serverName)) {
        ids.add(binding.id);
      } else {
        ids.delete(binding.id);
      }
      const result = await setServerCredentials(serverName, [...ids]);
      if (!result?.success) {
        setBusy(false);
        setError(result?.message || t('credentials.bindError'));
        return;
      }
    }
    setBusy(false);
    setBinding(null);
    await load();
  };

  const submitTest = async () => {
    if (!testing || !testServerName) {
      setTestMessage(t('credentials.selectMcp'));
      return;
    }
    setBusy(true);
    setTestMessage(null);
    const result = await testServerCredential(testServerName, testing.id);
    setBusy(false);
    setTestMessage(result?.message || (result?.success ? t('credentials.testOk') : t('credentials.testFail')));
    if (result?.success) {
      setError(null);
    }
  };

  return (
    <div>
      <div className="hub-page-head">
        <div>
          <h1 className="hub-h1">{t('credentials.title')}</h1>
          <p className="hub-sub">{t('credentials.hint')}</p>
          <p className="ylune-help" style={{ marginBottom: 0 }}>
            {t('credentials.nextStageHint')}
          </p>
        </div>
        <div className="view-actions">
          <button className="hub-btn" onClick={() => void load()} aria-label={t('common.refresh')}>
            <RefreshCw size={13} /> {t('common.refresh')}
          </button>
          {tab === 'credentials' && available && (
            <button
              className="hub-btn primary"
              onClick={() => {
                setShowCreate(true);
                setCreateName('');
                setCreatePairs(emptyPairs(2));
                setCreateFromServer('');
                setBindOnCreate(true);
              }}
            >
              <Plus size={13} /> {t('credentials.add')}
            </button>
          )}
          {tab === 'targets' && (
            <button className="hub-btn primary" onClick={() => setCreatingTarget(true)}>
              <Plus size={13} /> {t('targets.add')}
            </button>
          )}
          {tab === 'groups' && (
            <button className="hub-btn primary" onClick={() => setCreatingGroup(true)}>
              <Plus size={13} /> {t('resourceGroups.add')}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(
          [
            ['credentials', t('credentials.tabCredentials')],
            ['targets', t('credentials.tabTargets')],
            ['groups', t('credentials.tabGroups')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`hub-btn${tab === id ? ' primary' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'targets' && (
        <ResourceTargetPanel
          items={targets}
          onChanged={load}
          creating={creatingTarget}
          onCreatingChange={setCreatingTarget}
        />
      )}
      {tab === 'groups' && (
        <ResourceGroupPanel
          groups={groups}
          targets={targets}
          credentials={items}
          servers={allServers}
          onChanged={load}
          creating={creatingGroup}
          onCreatingChange={setCreatingGroup}
        />
      )}

      {tab === 'credentials' && (
        <>
          {error && (
            <div className="ylune-error" style={{ marginBottom: 12 }}>
              {error}
            </div>
          )}
          {!available ? (
            <div className="hub-card p-6">
              <p className="ylune-help">{t('credentials.unavailable')}</p>
            </div>
          ) : items.length === 0 ? (
            <div className="hub-card">
              <div className="hub-empty">
                <p className="hub-empty-title">{t('credentials.empty')}</p>
                <button
                  type="button"
                  className="hub-empty-link"
                  onClick={() => {
                    setShowCreate(true);
                    setCreateName('');
                    setCreatePairs(emptyPairs(2));
                  }}
                >
                  {t('credentials.addFirst')}
                </button>
              </div>
            </div>
          ) : (
            <div className="hub-card overflow-hidden credentials-table">
              <div className="hub-row head hub-mono">
                <div>{t('credentials.name')}</div>
                <div>{t('credentials.keys')}</div>
                <div>{t('credentials.boundServers')}</div>
                <div>{t('credentials.secretConfigured')}</div>
                <div>{t('credentials.enabled')}</div>
                <div className="text-right">{t('users.actions')}</div>
              </div>
              {items.map((item) => {
                const bound = serversForCredential(item.id);
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
                        ? '—'
                        : bound.map((name) => (
                            <span key={name} className="hub-kbd">
                              {name}
                            </span>
                          ))}
                    </div>
                    <div className="hub-mono">
                      {item.secretConfigured ? t('credentials.masked') : t('credentials.secretMissing')}
                    </div>
                    <div>
                      <button type="button" className="hub-btn" onClick={() => setToggling(item)}>
                        {item.enabled ? t('credentials.enabled') : t('credentials.disabled')}
                      </button>
                    </div>
                    <div className="flex justify-end gap-1 flex-wrap">
                      <button
                        type="button"
                        className="hub-btn"
                        onClick={() => {
                          setBinding(item);
                          setBindServerNames(serversForCredential(item.id));
                        }}
                      >
                        {t('credentials.bind')}
                      </button>
                      <button
                        type="button"
                        className="hub-btn"
                        onClick={() => {
                          setTesting(item);
                          setTestMessage(null);
                          setTestServerName(serversForCredential(item.id)[0] || contracts[0]?.serverName || '');
                        }}
                      >
                        {t('credentials.testWithMcp')}
                      </button>
                      <button
                        type="button"
                        className="hub-btn"
                        onClick={() => {
                          setReplacing(item);
                          setReplacePairs(keysToEmptyPairs(item.keys || []));
                        }}
                      >
                        {t('credentials.replace')}
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
        </>
      )}

      {showCreate && (
        <YluneDialog
          size="lg"
          title={t('credentials.add')}
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button type="button" className="hub-btn" onClick={() => setShowCreate(false)}>
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
          <div>
            <label className="ylune-label">{t('credentials.name')}</label>
            <input
              className="hub-input"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder={t('credentials.namePlaceholder')}
            />
          </div>
          <div>
            <label className="ylune-label">{t('credentials.importFromMcp')}</label>
            <p className="ylune-help">{t('credentials.importFromMcpHint')}</p>
            <select
              className="hub-input"
              value={createFromServer}
              onChange={(event) => applyMcpTemplate(event.target.value)}
            >
              <option value="">{t('credentials.selectMcp')}</option>
              {contracts.map((contract) => (
                <option key={contract.serverName} value={contract.serverName}>
                  {contract.serverName}
                  {contract.neededKeys.length ? ` (${contract.neededKeys.length})` : ''}
                </option>
              ))}
            </select>
          </div>
          {createFromServer && (
            <label className="token-lifetime-option">
              <input
                type="checkbox"
                checked={bindOnCreate}
                onChange={(event) => setBindOnCreate(event.target.checked)}
              />
              {t('credentials.bindAfterCreate')}
            </label>
          )}
          <KeyValueEditor
            pairs={createPairs}
            onChange={setCreatePairs}
            secret
            label={t('credentials.fields')}
            hint={t('credentials.fieldsHint')}
            keyPlaceholder={t('credentials.fieldKeyExample')}
          />
        </YluneDialog>
      )}

      {replacing && (
        <YluneDialog
          size="lg"
          title={`${t('credentials.replace')} · ${replacing.name}`}
          onClose={() => setReplacing(null)}
          footer={
            <>
              <button type="button" className="hub-btn" onClick={() => setReplacing(null)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="hub-btn primary"
                disabled={busy}
                onClick={() => void submitReplace()}
              >
                {t('credentials.replace')}
              </button>
            </>
          }
        >
          <p className="ylune-help" style={{ marginTop: 0 }}>
            {t('credentials.replaceHint')}
          </p>
          <KeyValueEditor
            pairs={replacePairs}
            onChange={setReplacePairs}
            secret
            label={t('credentials.fields')}
            hint={t('credentials.fieldsHint')}
            keyPlaceholder={t('credentials.fieldKeyExample')}
            valuePlaceholder={t('credentials.fieldValueReplace')}
          />
        </YluneDialog>
      )}

      {binding && (
        <YluneDialog
          title={`${t('credentials.bind')} · ${binding.name}`}
          onClose={() => setBinding(null)}
          footer={
            <>
              <button type="button" className="hub-btn" onClick={() => setBinding(null)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="hub-btn primary"
                disabled={busy}
                onClick={() => void submitBind()}
              >
                {t('common.confirm')}
              </button>
            </>
          }
        >
          <p className="ylune-help" style={{ marginTop: 0 }}>
            {t('credentials.bindHint')}
          </p>
          {contracts.length === 0 ? (
            <p className="ylune-help">{t('credentials.noMcpNeeds')}</p>
          ) : (
            contracts.map((contract) => (
              <label key={contract.serverName} className="token-lifetime-option">
                <input
                  type="checkbox"
                  checked={bindServerNames.includes(contract.serverName)}
                  onChange={(event) => {
                    setBindServerNames(
                      event.target.checked
                        ? [...bindServerNames, contract.serverName]
                        : bindServerNames.filter((name) => name !== contract.serverName),
                    );
                  }}
                />
                {contract.serverName}
                {contract.neededKeys.length > 0 ? ` · ${contract.neededKeys.join(', ')}` : ''}
              </label>
            ))
          )}
        </YluneDialog>
      )}

      {testing && (
        <YluneDialog
          title={`${t('credentials.testWithMcp')} · ${testing.name}`}
          onClose={() => setTesting(null)}
          footer={
            <>
              <button type="button" className="hub-btn" onClick={() => setTesting(null)}>
                {t('common.close')}
              </button>
              <button
                type="button"
                className="hub-btn primary"
                disabled={busy || !testServerName}
                onClick={() => void submitTest()}
              >
                {t('credentials.testWithMcp')}
              </button>
            </>
          }
        >
          <label className="ylune-label">{t('credentials.selectMcp')}</label>
          <select
            className="hub-input"
            value={testServerName}
            onChange={(event) => setTestServerName(event.target.value)}
          >
            <option value="">{t('credentials.selectMcp')}</option>
            {contracts.map((contract) => (
              <option key={contract.serverName} value={contract.serverName}>
                {contract.serverName}
              </option>
            ))}
          </select>
          {testMessage && <p className="ylune-help">{testMessage}</p>}
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
