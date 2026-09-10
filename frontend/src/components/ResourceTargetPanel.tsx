import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { ResourceTarget } from '@/types';
import {
  createResourceTarget,
  deleteResourceTarget,
  updateResourceTarget,
} from '@/services/resourceBindingService';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import YluneDialog from '@/components/ui/YluneDialog';
import KeyValueEditor, { collectFilledPairs, emptyPairs, KvPair } from '@/components/KeyValueEditor';

interface Props {
  items: ResourceTarget[];
  onChanged: () => Promise<void>;
  creating: boolean;
  onCreatingChange: (open: boolean) => void;
}

const ResourceTargetPanel = ({ items, onChanged, creating, onCreatingChange }: Props) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [pairs, setPairs] = useState<KvPair[]>(emptyPairs(2));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<ResourceTarget | null>(null);

  const closeCreate = () => {
    onCreatingChange(false);
    setName('');
    setPairs(emptyPairs(2));
  };

  const submit = async () => {
    if (!name.trim()) {
      setError(t('targets.nameRequired'));
      return;
    }
    const collected = collectFilledPairs(pairs);
    if ('error' in collected) {
      setError(t('targets.configRequired'));
      return;
    }
    setBusy(true);
    const result = await createResourceTarget({
      name: name.trim(),
      type: 'custom',
      enabled: true,
      config: collected.fields,
    });
    setBusy(false);
    if (result?.success) {
      closeCreate();
      await onChanged();
    } else {
      setError(result?.message || t('targets.createError'));
    }
  };

  return (
    <>
      {error && (
        <div className="ylune-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}
      {items.length === 0 ? (
        <div className="hub-card">
          <div className="hub-empty">
            <p className="hub-empty-title">{t('targets.empty')}</p>
            <button type="button" className="hub-empty-link" onClick={() => onCreatingChange(true)}>
              {t('targets.add')}
            </button>
          </div>
        </div>
      ) : (
        <div className="hub-card overflow-hidden targets-table">
          <div className="hub-row head hub-mono">
            <div>{t('targets.name')}</div>
            <div>{t('targets.config')}</div>
            <div>{t('credentials.enabled')}</div>
            <div className="text-right">{t('users.actions')}</div>
          </div>
          {items.map((item) => (
            <div key={item.id} className="hub-row hover">
              <div className="hub-mono">{item.name}</div>
              <div className="hub-key-chips">
                {Object.keys(item.config || {}).length === 0
                  ? '—'
                  : Object.entries(item.config).map(([key, value]) => (
                      <span key={key} className="hub-kbd" title={`${key}=${value}`}>
                        {key}={value}
                      </span>
                    ))}
              </div>
              <div>
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
              </div>
              <div className="flex justify-end gap-1">
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

      {creating && (
        <YluneDialog
          size="lg"
          title={t('targets.add')}
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
            {t('targets.hint')}
          </p>
          <div>
            <label className="ylune-label">{t('targets.name')}</label>
            <input
              className="hub-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <KeyValueEditor
            pairs={pairs}
            onChange={setPairs}
            label={t('targets.config')}
            hint={t('targets.configHint')}
            keyPlaceholder={t('targets.fieldKeyExample')}
            valuePlaceholder={t('targets.fieldValueExample')}
          />
        </YluneDialog>
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
