import { useTranslation } from 'react-i18next';
import YluneDialog from './YluneDialog';

interface PastExpiryAlertProps {
  isOpen: boolean;
  onClose: () => void;
}

const PastExpiryAlert = ({ isOpen, onClose }: PastExpiryAlertProps) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <YluneDialog
      raised
      size="sm"
      title={t('users.tokenCustomInPastTitle')}
      onClose={onClose}
      footer={
        <button type="button" className="hub-btn primary" onClick={onClose} autoFocus>
          {t('common.confirm')}
        </button>
      }
    >
      <p className="ylune-help" style={{ margin: 0 }}>
        {t('users.tokenCustomInPast')}
      </p>
    </YluneDialog>
  );
};

export default PastExpiryAlert;
