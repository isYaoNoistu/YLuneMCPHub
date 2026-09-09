import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ServerForm from './ServerForm'
import { apiPost } from '../utils/fetchInterceptor'
import { detectVariables } from '../utils/variableDetection'

interface AddServerFormProps {
  onAdd: () => void
}

const AddServerForm = ({ onAdd }: AddServerFormProps) => {
  const { t } = useTranslation()
  const [modalVisible, setModalVisible] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmationVisible, setConfirmationVisible] = useState(false)
  const [pendingPayload, setPendingPayload] = useState<any>(null)
  const [detectedVariables, setDetectedVariables] = useState<string[]>([])

  const toggleModal = () => {
    setModalVisible(!modalVisible)
    setError(null) // Clear any previous errors when toggling modal
    setConfirmationVisible(false) // Close confirmation dialog
    setPendingPayload(null) // Clear pending payload
  }

  const handleConfirmSubmit = async () => {
    if (pendingPayload) {
      await submitServer(pendingPayload)
      setConfirmationVisible(false)
      setPendingPayload(null)
    }
  }

  const submitServer = async (payload: any) => {
    try {
      setError(null)
      const result = await apiPost('/servers', payload)

      if (!result.success) {
        // Use specific error message from the response if available
        if (result && result.message) {
          setError(result.message)
        } else {
          setError(t('server.addError'))
        }
        return
      }

      setModalVisible(false)
      onAdd()
    } catch (err) {
      console.error('Error adding server:', err)

      // Use friendly error messages based on error type
      if (!navigator.onLine) {
        setError(t('errors.network'))
      } else if (err instanceof TypeError && (
        err.message.includes('NetworkError') ||
        err.message.includes('Failed to fetch')
      )) {
        setError(t('errors.serverConnection'))
      } else {
        setError(t('errors.serverAdd'))
      }
    }
  }

  const handleSubmit = async (payload: any) => {
    try {
      // Check for variables in the payload
      const variables = detectVariables(payload)

      if (variables.length > 0) {
        // Show confirmation dialog
        setDetectedVariables(variables)
        setPendingPayload(payload)
        setConfirmationVisible(true)
      } else {
        // Submit directly if no variables found
        await submitServer(payload)
      }
    } catch (err) {
      console.error('Error processing server submission:', err)
      setError(t('errors.serverAdd'))
    }
  }

  return (
    <div>
      <button
        onClick={toggleModal}
        className="hub-btn primary"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
        {t('server.add')}
      </button>

      {modalVisible && (
        <div className="ylune-dialog-backdrop">
          <ServerForm
            onSubmit={handleSubmit}
            onCancel={toggleModal}
            modalTitle={t('server.addServer')}
            formError={error}
          />
        </div>
      )}

      {confirmationVisible && (
        <div className="ylune-dialog-backdrop is-raised">
          <div className="ylune-dialog">
            <div className="ylune-dialog-head">
              <h3 className="ylune-dialog-title">{t('server.confirmVariables')}</h3>
            </div>
            <div className="ylune-dialog-body">
            <p className="ylune-help" style={{ margin: 0 }}>
              {t('server.variablesDetected')}
            </p>
            <div className="ylune-preview">
              <h4>{t('server.detectedVariables')}</h4>
              <ul className="ylune-help" style={{ margin: 0, paddingLeft: 18 }}>
                {detectedVariables.map((variable, index) => (
                  <li key={index} className="hub-mono">
                    ${`{${variable}}`}
                  </li>
                ))}
              </ul>
            </div>
            <p className="ylune-help">
              {t('server.confirmVariablesMessage')}
            </p>
            </div>
            <div className="ylune-dialog-foot">
              <button
                onClick={() => {
                  setConfirmationVisible(false)
                  setPendingPayload(null)
                }}
                className="hub-btn"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleConfirmSubmit}
                className="hub-btn primary"
              >
                {t('server.confirmAndAdd')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AddServerForm