import { useTranslation } from 'react-i18next'
import YluneDialog from './YluneDialog'

interface DeleteDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  serverName: string
  isGroup?: boolean
  isUser?: boolean
}

const DeleteDialog = ({ isOpen, onClose, onConfirm, serverName, isGroup = false, isUser = false }: DeleteDialogProps) => {
  const { t } = useTranslation()

  if (!isOpen) return null

  return (
    <YluneDialog
      title={
        isUser
          ? t('users.confirmDelete')
          : isGroup
            ? t('groups.confirmDelete')
            : t('server.confirmDelete')
      }
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="hub-btn">
            {t('common.cancel')}
          </button>
          <button onClick={onConfirm} className="hub-btn danger">
            {t('common.delete')}
          </button>
        </>
      }
    >
      <p className="ylune-help" style={{ margin: 0 }}>
        {isUser
          ? t('users.deleteWarning', { username: serverName })
          : isGroup
            ? t('groups.deleteWarning', { name: serverName })
            : t('server.deleteWarning', { name: serverName })}
      </p>
    </YluneDialog>
  )
}

export default DeleteDialog
