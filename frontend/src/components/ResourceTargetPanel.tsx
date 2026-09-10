import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { ResourceTarget, ResourceTargetType } from '@/types';
import {
  createResourceTarget,
  deleteResourceTarget,
  updateResourceTarget,
} from '@/services/resourceBindingService';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const emptyForm = () => ({
  name: '',
  type: 'postgresql' as ResourceTargetType,
  host: '',
  port: '5432',
  database: '',
  url: '',
  enabled: true,
});

interface Props {
  items: ResourceTarget[];
  onChanged: () => Promise<void>;
}

const ResourceTargetPanel = ({ items, onChanged }: Props) => {
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<ResourceTarget | null>(null);

  const submit = async () => {
    if (!form.name.trim()) {
      setError(t('targets.nameRequired'));
      return;
    }
    setBusy(true);
    const result = await createResourceTarget({
      name: form.name.trim(),
      type: form.type,
      enabled: true,
      config:
        form.type === 'postgresql'
          ? { host: form.host.trim(), port: Number(form.port) || 5432, database: form.database.trim() }
          : { url: form.url.trim() },
    });
    setBusy(false);
    if (result?.success) {
      setShowCreate(false);
      setForm(emptyForm());
      await onChanged();
    } else {
      setError(result?.message || t('targets.createError'));
    }
  };

  return (
    <>
      {error && <div className="ylune-error" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="flex justify-end mb-3">
        <button type="button" className="hub-btn primary" onClick={() => setShowCreate(true)}>
          <Plus size={13} /> {t('targets.add')}
        </button>
      </div>
      {items.length === 0 ? (
        <div className="hub-card">
          <div className="hub-empty">
            <p className="hub-empty-title">{t('targets.empty')}</p>
          </div>
        </div>
      ) : (
        <div className="hub-card overflow-hidden">
          <div className="hub-row head hub-mono">
            <div>{t('targets.name')}</div>
            <div>{t('targets.type')}</div>
            <div>{t('targets.where')}</div>
            <div className="text-right">{t('users.actions')}</div>
          </div>
          {items.map((item) => (
            <div key={item.id} className="hub-row hover">
              <div className="hub-mono">{item.name}</div>
              <div>{item.type}</div>
              <div className="hub-mono">
                {item.config.host
                  ? `${item.config.host}:${item.config.port || 5432}/${item.config.database || ''}`
                  : item.config.url || '—'}
              </div>
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  className="hub-btn"
                  onClick={async () => {
                    await updateResourceTarget(item.id, { enabled: !item.enabled });
                    await onChanged();
                  }}
                >
                  {item.enabled ? t('credentials.enabled') : t('credentials.disabled')}
                </button>
                <button
                  type="button"
                  className="hub-icon-btn sm"
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

      {showCreate && (
        <div className="ylune-dialog-backdrop">
          <div className="ylune-dialog">
            <div className="ylune-dialog-head">
              <h2 className="ylune-dialog-title">{t('targets.add')}</h2>
            </div>
            <div className="ylune-dialog-body">
              <p className="ylune-help" style={{ marginTop: 0 }}>
                {t('targets.hint')}
              </p>
              <label className="ylune-label">{t('targets.name')}</label>
              <input
                className="hub-input"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
              <label className="ylune-label">{t('targets.type')}</label>
              <select
                className="hub-input"
                value={form.type}
                onChange={(event) =>
                  setForm({ ...form, type: event.target.value as ResourceTargetType })
                }
              >
                <option value="postgresql">PostgreSQL</option>
                <option value="http">HTTP</option>
                <option value="custom">{t('targets.typeCustom')}</option>
              </select>
              {form.type === 'postgresql' ? (
                <>
                  <label className="ylune-label">{t('credentials.testHost')}</label>
                  <input
                    className="hub-input"
                    value={form.host}
                    onChange={(event) => setForm({ ...form, host: event.target.value })}
                  />
                  <label className="ylune-label">{t('credentials.testPort')}</label>
                  <input
                    className="hub-input"
                    value={form.port}
                    onChange={(event) => setForm({ ...form, port: event.target.value })}
                  />
                  <label className="ylune-label">{t('credentials.testDatabase')}</label>
                  <input
                    className="hub-input"
                    value={form.database}
                    onChange={(event) => setForm({ ...form, database: event.target.value })}
                  />
                </>
              ) : (
                <>
                  <label className="ylune-label">URL</label>
                  <input
                    className="hub-input"
                    value={form.url}
                    onChange={(event) => setForm({ ...form, url: event.target.value })}
                  />
                </>
              )}
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
        title={t('targets.delete')}
        message={deleting?.name || ''}
        confirmText={t('common.delete')}
        variant="danger"
        onConfirm={async () => {
          if (!deleting) return;
          await deleteResourceTarget(deleting.id);
          setDeleting(null);
          await onChanged();
        }}
      />
    </>
  );
};

export default ResourceTargetPanel;
