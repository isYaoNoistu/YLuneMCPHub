import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Group, GroupFormData, Server } from '@/types';
import { useGroupData } from '@/hooks/useGroupData';
import { useServerData } from '@/hooks/useServerData';
import { isGrantableServer } from '@/utils/serverPermissions';
import { useCostData } from '@/hooks/useCostData';
import GroupFormDialog from './group-form/GroupFormDialog';

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
    setAvailableServers(allServers.filter(isGrantableServer));
  }, [allServers]);

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
    <GroupFormDialog
      title={t('groups.edit')}
      submitLabel={t('common.save')}
      submittingLabel={t('common.submitting')}
      formData={formData}
      setFormData={setFormData}
      availableServers={availableServers}
      serverCosts={serverCosts}
      error={error}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit}
      onCancel={onCancel}
    />
  );
};

export default EditGroupForm;
