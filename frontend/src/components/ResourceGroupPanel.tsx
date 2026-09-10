import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Credential, ResourceGroup, ResourceGroupItem, ResourceTarget, Server } from '@/types';
import {
  createResourceGroup,
  deleteResourceGroup,
  updateResourceGroup,
} from '@/services/resourceBindingService';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface Props {
  groups: ResourceGroup[];
  targets: ResourceTarget[];
  credentials: Credential[];
  servers: Server[];
  onChanged: () => Promise<void>;
}

const emptyItem = (): ResourceGroupItem => ({
  serverName: '',
  targetId: '',
  credentialId: '',
  alias: '',
  enabled: true,
});

const ResourceGroupPanel = ({ groups, targets, credentials, servers, onChanged }: Props) => {
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<ResourceGroupItem[]>([emptyItem()]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<ResourceGroup | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError(t('resourceGroups.nameRequired'));
      return;
    }
    setBusy(true);
    const result = await createResourceGroup({
      name: name.trim(),
      description,
      items: items.filter((item) => item.serverName && item.targetId && item.credentialId),
    });
    setBusy(false);
    if (result?.success) {
      setShowCreate(false);
      setName('');
      setDescription('');
      setItems([emptyItem()]);
      await onChanged();
    } else {
      setError(result?.message || t('resourceGroups.createError'));
    }
  };

  return (
    <>
      {error && <div className="ylune-error" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="flex justify-end mb-3">
        <button type="button" className="hub-btn primary" onClick={() => setShowCreate(true)}>
          <Plus size={13} /> {t('resourceGroups.add')}
        </button>
      </div>
      {groups.length === 0 ? (
        <div className="hub-card">
          <div className="hub-empty">
            <p className="hub-empty-title">{t('resourceGroups.empty')}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.id} className="hub-card" style={{ padding: 16 }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="hub-card-title">{group.name}</h3>
                  <p className="ylune-help">{group.description || t('resourceGroups.noDescription')}</p>
                  <ul className="grant-preview-list">
                    {group.items.map((item) => (
                      <li key={item.id || `${item.serverName}-${item.targetId}`}>
                        {item.serverName} → {item.alias || item.targetId} / {item.credentialId.slice(0, 8)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="hub-btn"
                    onClick={async () => {
                      await updateResourceGroup(group.id, { enabled: !group.enabled });
                      await onChanged();
                    }}
                  >
                    {group.enabled ? t('credentials.enabled') : t('credentials.disabled')}
                  </button>
                  <button
                    type="button"
                    className="hub-icon-btn sm"
                    style={{ color: 'var(--hub-err)' }}
                    onClick={() => setDeleting(group)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="ylune-dialog-backdrop">
          <div className="ylune-dialog is-lg">
            <div className="ylune-dialog-head">
              <h2 className="ylune-dialog-title">{t('resourceGroups.add')}</h2>
            </div>
            <div className="ylune-dialog-body">
              <p className="ylune-help" style={{ marginTop: 0 }}>
                {t('resourceGroups.hint')}
              </p>
              <label className="ylune-label">{t('resourceGroups.name')}</label>
              <input className="hub-input" value={name} onChange={(event) => setName(event.target.value)} />
              <label className="ylune-label">{t('resourceGroups.description')}</label>
              <input
                className="hub-input"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              {items.map((item, index) => (
                <div key={index} className="grid gap-2" style={{ marginTop: 12 }}>
                  <label className="ylune-label">{t('resourceGroups.binding', { n: index + 1 })}</label>
                  <select
                    className="hub-input"
                    value={item.serverName}
                    onChange={(event) => {
                      const next = [...items];
                      next[index] = { ...item, serverName: event.target.value };
                      setItems(next);
                    }}
                  >
                    <option value="">{t('lab.pickServer')}</option>
                    {servers.map((server) => (
                      <option key={server.name} value={server.name}>
                        {server.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="hub-input"
                    value={item.targetId}
                    onChange={(event) => {
                      const next = [...items];
                      next[index] = { ...item, targetId: event.target.value };
                      setItems(next);
                    }}
                  >
                    <option value="">{t('targets.pick')}</option>
                    {targets.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="hub-input"
                    value={item.credentialId}
                    onChange={(event) => {
                      const next = [...items];
                      next[index] = { ...item, credentialId: event.target.value };
                      setItems(next);
                    }}
                  >
                    <option value="">{t('credentials.pick')}</option>
                    {credentials.map((credential) => (
                      <option key={credential.id} value={credential.id}>
                        {credential.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="hub-input"
                    placeholder={t('resourceGroups.alias')}
                    value={item.alias || ''}
                    onChange={(event) => {
                      const next = [...items];
                      next[index] = { ...item, alias: event.target.value };
                      setItems(next);
                    }}
                  />
                </div>
              ))}
              <button type="button" className="hub-btn" onClick={() => setItems([...items, emptyItem()])}>
                {t('resourceGroups.addBinding')}
              </button>
            </div>
            <div className="ylune-dialog-foot">
              <button type="button" className="hub-btn" onClick={() => setShowCreate(false)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="hub-btn primary" disabled={busy} onClick={() => void submit()}>
                {t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        title={t('resourceGroups.delete')}
        message={deleting?.name || ''}
        confirmText={t('common.delete')}
        variant="danger"
        onConfirm={async () => {
          if (!deleting) return;
          await deleteResourceGroup(deleting.id);
          setDeleting(null);
          await onChanged();
        }}
      />
    </>
  );
};

export default ResourceGroupPanel;
