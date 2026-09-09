import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Group, GroupFormData, Server, IGroupServerConfig } from '@/types';
import { useGroupData } from '@/hooks/useGroupData';
import { useServerData } from '@/hooks/useServerData';
import { useCostData } from '@/hooks/useCostData';
import { ServerToolConfig } from './ServerToolConfig';
import GroupMembersField from './GroupMembersField';

interface EditGroupFormProps {
  group: Group;
  onEdit: () => void;
  onCancel: () => void;
}

const EditGroupForm = ({ group, onEdit, onCancel }: EditGroupFormProps) => {
  const { t } = useTranslation();
  const { updateGroup } = useGroupData();
  const { allServers } = useServerData();
  const { serverCosts } = useCostData();
  const [availableServers, setAvailableServers] = useState<Server[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<GroupFormData>({
    name: group.name,
    description: group.description || '',
    servers: group.servers || [],
    members: group.members || [],
  });

  useEffect(() => {
    // Filter available servers (enabled only)
    setAvailableServers(allServers.filter((server) => server.enabled !== false));
  }, [allServers]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (!formData.name.trim()) {
        setError(t('groups.nameRequired'));
        setIsSubmitting(false);
        return;
      }

      const result = await updateGroup(group.id, {
        name: formData.name,
        description: formData.description,
        servers: formData.servers,
        members: formData.members || [],
      });

      if (!result || !result.success) {
        setError(result?.message || t('groups.updateError'));
        setIsSubmitting(false);
        return;
      }

      onEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ylune-dialog-backdrop">
      <div className="ylune-dialog is-lg">
        <div className="ylune-dialog-head">
          <h2 className="ylune-dialog-title">{t('groups.edit')}</h2>
        </div>
        <form className="ylune-dialog-form" onSubmit={handleSubmit}>
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
                  onChange={handleChange}
                  className="hub-input"
                  placeholder={t('groups.namePlaceholder')}
                  required
                />
              </div>

              <GroupMembersField
                value={formData.members || []}
                onChange={(members) => setFormData((prev) => ({ ...prev, members }))}
              />

              <div>
                <label className="ylune-label">
                  {t('groups.configureCapabilities')}
                </label>
                <ServerToolConfig
                  servers={availableServers}
                  value={formData.servers as IGroupServerConfig[]}
                  onChange={(servers) => setFormData((prev) => ({ ...prev, servers }))}
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
            <button
              type="submit"
              className="hub-btn primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? t('common.submitting') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditGroupForm;
