import type { Dispatch, FormEventHandler, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import type { GroupFormData, IGroupServerConfig, Server, ServerCost } from '@/types';
import GroupMembersField from '../GroupMembersField';
import { ServerToolConfig } from '../ServerToolConfig';

interface GroupFormDialogProps {
  title: string;
  submitLabel: string;
  submittingLabel: string;
  formData: GroupFormData;
  setFormData: Dispatch<SetStateAction<GroupFormData>>;
  availableServers: Server[];
  serverCosts: ServerCost[];
  error: string | null;
  isSubmitting: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onCancel: () => void;
}

const GroupFormDialog = ({
  title,
  submitLabel,
  submittingLabel,
  formData,
  setFormData,
  availableServers,
  serverCosts,
  error,
  isSubmitting,
  onSubmit,
  onCancel,
}: GroupFormDialogProps) => {
  const { t } = useTranslation();

  return (
    <div className="ylune-dialog-backdrop">
      <div className="ylune-dialog is-lg">
        <div className="ylune-dialog-head">
          <h2 className="ylune-dialog-title">{title}</h2>
        </div>
        <form className="ylune-dialog-form" onSubmit={onSubmit}>
          <div className="ylune-dialog-body">
            {error && <div className="ylune-error">{error}</div>}
            <div>
              <label className="ylune-label" htmlFor="name">
                {t('groups.name')} <span className="ylune-req">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={(event) =>
                  setFormData((previous) => ({ ...previous, name: event.target.value }))
                }
                className="hub-input"
                placeholder={t('groups.namePlaceholder')}
                required
              />
            </div>

            <GroupMembersField
              value={formData.members || []}
              onChange={(members) => setFormData((previous) => ({ ...previous, members }))}
            />

            <div>
              <label className="ylune-label">{t('groups.configureCapabilities')}</label>
              <ServerToolConfig
                servers={availableServers}
                value={formData.servers as IGroupServerConfig[]}
                onChange={(servers) => setFormData((previous) => ({ ...previous, servers }))}
                serverCosts={serverCosts}
              />
            </div>
          </div>

          <div className="ylune-dialog-foot">
            <button
              type="button"
              onClick={onCancel}
              className="hub-btn"
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </button>
            <button type="submit" className="hub-btn primary" disabled={isSubmitting}>
              {isSubmitting ? submittingLabel : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GroupFormDialog;
