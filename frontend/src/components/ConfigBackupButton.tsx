import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsData } from '@/hooks/useSettingsData';
import { useToast } from '@/contexts/ToastContext';
import { apiPost } from '@/utils/fetchInterceptor';
import { TemplateDryRunResult } from '@/types';

const ConfigBackupButton = () => {
  const { t } = useTranslation();
  const { exportMCPSettings } = useSettingsData();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [payload, setPayload] = useState<unknown>(null);
  const [dryRun, setDryRun] = useState<TemplateDryRunResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const download = async () => {
    setBusy(true);
    try {
      const result = await exportMCPSettings();
      if (!result) {
        return;
      }
      if (result.success === false) {
        showToast(result.message || t('backup.failed'), 'error');
        return;
      }
      const next = result.data ?? result;
      const blob = new Blob([JSON.stringify(next, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ylune-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast(t('backup.success'), 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('backup.failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      setPayload(parsed);
      const response = await apiPost('/templates/import/dry-run', parsed);
      if (response?.success && response.data) {
        setDryRun(response.data as TemplateDryRunResult);
      } else {
        showToast(response?.message || t('backup.dryRunFailed'), 'error');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('template.parseError'), 'error');
    }
  };

  const apply = async () => {
    if (!payload) return;
    setBusy(true);
    try {
      const response = await apiPost('/templates/import', payload);
      if (response?.success) {
        showToast(t('backup.restoreSuccess'), 'success');
        setPayload(null);
        setDryRun(null);
      } else {
        showToast(response?.message || t('backup.restoreFailed'), 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="hub-btn" onClick={() => void download()} disabled={busy}>
        {busy ? t('common.processing') : t('backup.download')}
      </button>
      <button type="button" className="hub-btn" onClick={() => fileRef.current?.click()} disabled={busy}>
        {t('backup.restore')}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onFile(file);
          event.target.value = '';
        }}
      />
      {dryRun && (
        <div className="hub-card" style={{ padding: 12, width: '100%' }}>
          <p className="ylune-help" style={{ marginTop: 0 }}>
            {t('template.dryRunSummary', {
              added: dryRun.added,
              changed: dryRun.changed,
              removed: dryRun.removed,
            })}
          </p>
          <div className="flex gap-2">
            <button type="button" className="hub-btn" onClick={() => { setPayload(null); setDryRun(null); }}>
              {t('common.cancel')}
            </button>
            <button type="button" className="hub-btn primary" disabled={busy} onClick={() => void apply()}>
              {t('backup.apply')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigBackupButton;
