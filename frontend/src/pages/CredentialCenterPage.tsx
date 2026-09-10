import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Credential, CredentialFormData, CredentialType, ResourceGroup, ResourceTarget } from '@/types';
import {
  checkCredentialAvailable,
  createCredential,
  deleteCredential,
  getCredentials,
  replaceCredentialSecret,
  testCredential,
  updateCredential,
} from '@/services/credentialService';
import { getResourceGroups, getResourceTargets } from '@/services/resourceBindingService';
import { useServerData } from '@/hooks/useServerData';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ResourceTargetPanel from '@/components/ResourceTargetPanel';
import ResourceGroupPanel from '@/components/ResourceGroupPanel';

type TabId = 'credentials' | 'targets' | 'groups';

const emptyForm = (): CredentialFormData => ({
  name: '',
  type: 'postgresql',
  username: '',
  password: '',
  token: '',
  enabled: true,
});

const CredentialCenterPage = () => {
  const { t } = useTranslation();
  const { auth } = useAuth();
  const isAdmin = auth.user?.isAdmin === true;
  const [tab, setTab] = useState<TabId>('credentials');
  const [available, setAvailable] = useState(false);
  const [items, setItems] = useState<Credential[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CredentialFormData>(emptyForm());
  const [replacing, setReplacing] = useState<Credential | null>(null);
  const [replaceForm, setReplaceForm] = useState({ username: '', password: '', token: '' });
  const [testing, setTesting] = useState<Credential | null>(null);
  const [probe, setProbe] = useState({ host: '', port: '5432', database: '' });
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Credential | null>(null);
  const [toggling, setToggling] = useState<Credential | null>(null);
  const [targets, setTargets] = useState<ResourceTarget[]>([]);
  const [groups, setGroups] = useState<ResourceGroup[]>([]);
  const { allServers } = useServerData();

  const load = async () => {
    const storeOn = await checkCredentialAvailable();
    setAvailable(storeOn);
    if (!storeOn) {
      setItems([]);
      return;
    }
    const [credRes, targetRes, groupRes] = await Promise.all([
      getCredentials(),
      getResourceTargets(),
      getResourceGroups(),
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

  const typeLabel = (type: CredentialType) => {
    if (type === 'postgresql') return t('credentials.typePostgresql');
    if (type === 'token') return t('credentials.typeToken');
    return t('credentials.typeBasic');
  };

  const submitCreate = async () => {
    if (!form.name.trim()) {
      setError(t('credentials.nameRequired'));
      return;
    }
    if (form.type === 'token' ? !form.token?.trim() : !form.username?.trim() || !form.password) {
      setError(t('credentials.secretRequired'));
      return;
    }
    setBusy(true);
    const result = await createCredential({
      name: form.name.trim(),
      type: form.type,
      username: form.username,
      password: form.password,
      token: form.token,
    });
    setBusy(false);
    if (result?.success) {
      setShowCreate(false);
      setForm(emptyForm());
      await load();
    } else {
      setError(result?.message || t('credentials.createError'));
    }
  };

  const submitReplace = async () => {
    if (!replacing) return;
    if (
      replacing.type === 'token'
        ? !replaceForm.token.trim()
        : !replaceForm.username.trim() || !replaceForm.password
    ) {
      setError(t('credentials.secretRequired'));
      return;
    }
    setBusy(true);
    const result = await replaceCredentialSecret(replacing.id, replaceForm);
    setBusy(false);
    if (result?.success) {
      setReplacing(null);
      setReplaceForm({ username: '', password: '', token: '' });
      await load();
    } else {
      setError(result?.message || t('credentials.updateError'));
    }
  };

  const submitTest = async () => {
    if (!testing) return;
    setBusy(true);
    setTestMessage(null);
    const result = await testCredential(
      testing.id,
      testing.type === 'postgresql'
        ? {
            host: probe.host.trim(),
            port: Number(probe.port) || 5432,
            database: probe.database.trim(),
          }
        : {},
    );
    setBusy(false);
    setTestMessage(result?.message || (result?.success ? t('credentials.testSuccess') : t('credentials.testFailed')));
  };

  return (
    <div>
      <div className="hub-page-head">
        <div>
          <h1 className="hub-h1">{t('credentials.title')}</h1>
          <p className="ylune-help" style={{ marginBottom: 0 }}>
            {t('credentials.hint')}
          </p>
        </div>
        <div className="view-actions">
          <button className="hub-btn" onClick={() => void load()} aria-label={t('common.refresh')}>
            <RefreshCw size={13} /> {t('common.refresh')}
          </button>
          {tab === 'credentials' && (
            <button className="hub-btn primary" onClick={() => setShowCreate(true)}>
              <Plus size={13} /> {t('credentials.add')}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
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

      {tab === 'targets' && <ResourceTargetPanel items={targets} onChanged={load} />}
      {tab === 'groups' && (
        <ResourceGroupPanel
          groups={groups}
          targets={targets}
          credentials={items}
          servers={allServers}
          onChanged={load}
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
                <button type="button" className="hub-empty-link" onClick={() => setShowCreate(true)}>
                  {t('credentials.addFirst')}
                </button>
              </div>
            </div>
          ) : (
            <div className="hub-card overflow-hidden credentials-table">
              <div className="hub-row head hub-mono">
                <div>{t('credentials.name')}</div>
                <div>{t('credentials.type')}</div>
                <div>{t('credentials.username')}</div>
                <div>{t('credentials.password')}</div>
                <div>{t('credentials.enabled')}</div>
                <div className="text-right">{t('users.actions')}</div>
              </div>
              {items.map((item) => (
                <div key={item.id} className="hub-row hover">
                  <div className="hub-mono">{item.name}</div>
                  <div>{typeLabel(item.type)}</div>
                  <div>{item.username || '—'}</div>
                  <div className="hub-mono">
                    {item.secretConfigured ? t('credentials.masked') : t('credentials.secretMissing')}
                  </div>
                  <div>
                    <button
                      type="button"
                      className="hub-btn"
                      onClick={() => setToggling(item)}
                    >
                      {item.enabled ? t('credentials.enabled') : t('credentials.disabled')}
                    </button>
                  </div>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      className="hub-btn"
                      onClick={() => {
                        setReplacing(item);
                        setReplaceForm({ username: item.username || '', password: '', token: '' });
                      }}
                    >
                      {t('credentials.replace')}
                    </button>
                    <button
                      type="button"
                      className="hub-btn"
                      onClick={() => {
                        setTesting(item);
                        setProbe({ host: '', port: '5432', database: '' });
                        setTestMessage(null);
                      }}
                    >
                      {t('credentials.test')}
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
              ))}
            </div>
          )}
        </>
      )}

      {showCreate && (
        <div className="ylune-dialog-backdrop">
          <div className="ylune-dialog">
            <div className="ylune-dialog-head">
              <h2 className="ylune-dialog-title">{t('credentials.add')}</h2>
            </div>
            <div className="ylune-dialog-body">
              <label className="ylune-label">{t('credentials.name')}</label>
              <input
                className="hub-input"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder={t('credentials.namePlaceholder')}
              />
              <label className="ylune-label">{t('credentials.type')}</label>
              <select
                className="hub-input"
                value={form.type}
                onChange={(event) =>
                  setForm({ ...form, type: event.target.value as CredentialType })
                }
              >
                <option value="postgresql">{t('credentials.typePostgresql')}</option>
                <option value="token">{t('credentials.typeToken')}</option>
                <option value="basic">{t('credentials.typeBasic')}</option>
              </select>
              {form.type === 'token' ? (
                <>
                  <label className="ylune-label">{t('credentials.token')}</label>
                  <input
                    className="hub-input"
                    type="password"
                    autoComplete="off"
                    value={form.token}
                    onChange={(event) => setForm({ ...form, token: event.target.value })}
                  />
                </>
              ) : (
                <>
                  <label className="ylune-label">{t('credentials.username')}</label>
                  <input
                    className="hub-input"
                    value={form.username}
                    onChange={(event) => setForm({ ...form, username: event.target.value })}
                  />
                  <label className="ylune-label">{t('credentials.password')}</label>
                  <input
                    className="hub-input"
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                  />
                </>
              )}
            </div>
            <div className="ylune-dialog-foot">
              <button type="button" className="hub-btn" onClick={() => setShowCreate(false)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="hub-btn primary" disabled={busy} onClick={() => void submitCreate()}>
                {t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {replacing && (
        <div className="ylune-dialog-backdrop">
          <div className="ylune-dialog">
            <div className="ylune-dialog-head">
              <h2 className="ylune-dialog-title">
                {t('credentials.replace')} · {replacing.name}
              </h2>
            </div>
            <div className="ylune-dialog-body">
              <p className="ylune-help" style={{ marginTop: 0 }}>
                {t('credentials.replaceHint')}
              </p>
              {replacing.type === 'token' ? (
                <>
                  <label className="ylune-label">{t('credentials.token')}</label>
                  <input
                    className="hub-input"
                    type="password"
                    autoComplete="off"
                    value={replaceForm.token}
                    onChange={(event) => setReplaceForm({ ...replaceForm, token: event.target.value })}
                  />
                </>
              ) : (
                <>
                  <label className="ylune-label">{t('credentials.username')}</label>
                  <input
                    className="hub-input"
                    value={replaceForm.username}
                    onChange={(event) =>
                      setReplaceForm({ ...replaceForm, username: event.target.value })
                    }
                  />
                  <label className="ylune-label">{t('credentials.password')}</label>
                  <input
                    className="hub-input"
                    type="password"
                    autoComplete="new-password"
                    value={replaceForm.password}
                    onChange={(event) =>
                      setReplaceForm({ ...replaceForm, password: event.target.value })
                    }
                  />
                </>
              )}
            </div>
            <div className="ylune-dialog-foot">
              <button type="button" className="hub-btn" onClick={() => setReplacing(null)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="hub-btn primary" disabled={busy} onClick={() => void submitReplace()}>
                {t('credentials.replace')}
              </button>
            </div>
          </div>
        </div>
      )}

      {testing && (
        <div className="ylune-dialog-backdrop">
          <div className="ylune-dialog">
            <div className="ylune-dialog-head">
              <h2 className="ylune-dialog-title">
                {t('credentials.test')} · {testing.name}
              </h2>
            </div>
            <div className="ylune-dialog-body">
              <p className="ylune-help" style={{ marginTop: 0 }}>
                {testing.type === 'postgresql'
                  ? t('credentials.testHint')
                  : t('credentials.testSkipped')}
              </p>
              {testing.type === 'postgresql' && (
                <>
                  <label className="ylune-label">{t('credentials.testHost')}</label>
                  <input
                    className="hub-input"
                    value={probe.host}
                    onChange={(event) => setProbe({ ...probe, host: event.target.value })}
                  />
                  <label className="ylune-label">{t('credentials.testPort')}</label>
                  <input
                    className="hub-input"
                    value={probe.port}
                    onChange={(event) => setProbe({ ...probe, port: event.target.value })}
                  />
                  <label className="ylune-label">{t('credentials.testDatabase')}</label>
                  <input
                    className="hub-input"
                    value={probe.database}
                    onChange={(event) => setProbe({ ...probe, database: event.target.value })}
                  />
                </>
              )}
              {testMessage && <p className="ylune-help">{testMessage}</p>}
            </div>
            <div className="ylune-dialog-foot">
              <button type="button" className="hub-btn" onClick={() => setTesting(null)}>
                {t('common.close')}
              </button>
              <button type="button" className="hub-btn primary" disabled={busy} onClick={() => void submitTest()}>
                {t('credentials.test')}
              </button>
            </div>
          </div>
        </div>
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
