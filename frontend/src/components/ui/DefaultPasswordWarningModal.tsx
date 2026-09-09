import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import YluneDialog from './YluneDialog';

interface DefaultPasswordWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DefaultPasswordWarningModal: React.FC<DefaultPasswordWarningModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleGoToSettings = () => {
    onClose();
    navigate('/settings');
    setTimeout(() => {
      const passwordSection = document.querySelector('[data-section="password"]');
      if (passwordSection) {
        passwordSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const clickTarget = passwordSection.querySelector('[role="button"]');
        if (clickTarget && !passwordSection.querySelector('.mt-4')) {
          (clickTarget as HTMLElement).click();
        }
      }
    }, 100);
  };

  return (
    <YluneDialog
      raised
      title={t('auth.defaultPasswordWarning')}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="hub-btn">
            {t('common.cancel')}
          </button>
          <button onClick={handleGoToSettings} className="hub-btn primary" autoFocus>
            {t('auth.goToSettings')}
          </button>
        </>
      }
    >
      <p className="ylune-help" style={{ margin: 0 }}>
        {t('auth.defaultPasswordMessage')}
      </p>
    </YluneDialog>
  );
};

export default DefaultPasswordWarningModal;
