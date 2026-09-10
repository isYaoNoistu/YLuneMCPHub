import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { Credential, ResourceGroup, ResourceGroupItem, ResourceTarget, Server } from '@/types';
import {
  createResourceGroup,
  deleteResourceGroup,
  updateResourceGroup,
} from '@/services/resourceBindingService';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import YluneDialog from '@/components/ui/YluneDialog';

interface Props {
  groups: ResourceGroup[];
  targets: ResourceTarget[];
  credentials: Credential[];
  servers: Server[];
  onChanged: () => Promise<void>;
  creating: boolean;
  onCreatingChange: (open: boolean) => void;
}

const emptyItem = (): ResourceGroupItem => ({
  serverName: '',
  targetId: '',
  credentialId: '',
  alias: '',
  enabled: true,
});

const ResourceGroupPanel = ({
  groups,
  targets,
  credentials,
  servers,
  onChanged,
  creating,
  onCreatingChange,
}: Props) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<ResourceGroupItem[]>([emptyItem()]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<ResourceGroup | null>(null);

  const closeCreate = () => {
    onCreatingChange(false);
    setName('');
    setDescription('');
    setItems([emptyItem()]);
  };

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
      closeCreate();
      await onChanged();
    } else {
      setError(result?.message || t('resourceGroups.createError'));
    }
  };

  const targetName = (id: string) => targets.find((row) => row.id === id)?.name || id;
  const credentialName = (id: string) => credentials.find((row) => row.id === id)?.name || id;

  return (
    <>
      {error && (
        <div className="ylune-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}
      {groups.length === 0 ? (
        <div className="hub-card">
          <div className="hub-empty">
            <p className="hub-empty-title">{t('resourceGroups.empty')}</p>
            <button type="button" className="hub-empty-link" onClick={() => onCreatingChange(true)}>
              {t('resourceGroups.add')}
            </button>
          </div>
        </div>
      ) : (
        <div className="hub-card overflow-hidden resource-groups-table">
          <div className="hub-row head hub-mono">
            <div>{t('resourceGroups.name')}</div>
            <div>{t('resourceGroups.bindings')}</div>
            <div>{t('credentials.enabled')}</div>
            <div className="text-right">{t('users.actions')}</div>
          </div>
          {groups.map((group) => (
            <div key={group.id} className="hub-row hover">
              <div>
                <div className="hub-mono">{group.name}</div>
                <p className="ylune-help" style={{ margin: '4px 0 0' }}>
                  {group.description || t('resourceGroups.noDescription')}
                </p>
              </div>
              <div className="hub-key-chips">
                {group.items.length === 0
                  ? '—'
                  : group.items.map((item) => (
                      <span
                        key={item.id || `${item.serverName}-${item.targetId}-${item.credentialId}`}
                        className="hub-kbd"
                      >
                        {item.serverName} → {item.alias || targetName(item.targetId)} /{' '}
                        {credentialName(item.credentialId)}
                      </span>
                    ))}
              </div>
              <div>
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
              </div>
              <div className="flex justify-end">
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
          ))}
        </div>
      )}

      {creating && (
        <YluneDialog
          size="lg"
          title={t('resourceGroups.add')}
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
                onClick={() => void submit()}
              >
                {t('common.create')}
              </button>
            </>
          }
        >
          <p className="ylune-help" style={{ marginTop: 0 }}>
            {t('resourceGroups.hint')}
          </p>
          <div>
            <label className="ylune-label">{t('resourceGroups.name')}</label>
            <input className="hub-input" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <label className="ylune-label">{t('resourceGroups.description')}</label>
            <input
              className="hub-input"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          {items.map((item, index) => (
            <div key={index} className="resource-binding-block">
              <label className="ylune-label">{t('resourceGroups.binding', { n: index + 1 })}</label>
              <div className="resource-binding-row">
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
              </div>
              <input
                className="hub-input"
                style={{ marginTop: 8 }}
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
        </YluneDialog>
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
