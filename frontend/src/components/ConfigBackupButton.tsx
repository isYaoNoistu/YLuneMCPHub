import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsData } from '@/hooks/useSettingsData';
import { useToast } from '@/contexts/ToastContext';

const ConfigBackupButton = () => {
  const { t } = useTranslation();
  const { exportMCPSettings } = useSettingsData();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

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
      const payload = result.data ?? result;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
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

  return (
    <button type="button" className="hub-btn" onClick={download} disabled={busy}>
      {busy ? t('common.processing') : t('backup.download')}
    </button>
  );
};

export default ConfigBackupButton;
