import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGroupData } from '@/hooks/useGroupData';
import { useServerData } from '@/hooks/useServerData';
import { isGrantableServer } from '@/utils/serverPermissions';
import { useCostData } from '@/hooks/useCostData';
import { GroupFormData, Server, IGroupServerConfig } from '@/types';
import GroupFormDialog from './group-form/GroupFormDialog';

interface AddGroupFormProps {
  onAdd: () => void;
  onCancel: () => void;
}

const AddGroupForm = ({ onAdd, onCancel }: AddGroupFormProps) => {
  const { t } = useTranslation();
  const { createGroup } = useGroupData();
  const { allServers } = useServerData();
  const { serverCosts } = useCostData();
  const [availableServers, setAvailableServers] = useState<Server[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<GroupFormData>({
    name: '',
    description: '',
    servers: [] as IGroupServerConfig[],
    members: [],
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

      const result = await createGroup(
        formData.name,
        formData.description,
        formData.servers,
        formData.members || [],
      );
      if (!result || !result.success) {
        setError(result?.message || t('groups.createError'));
        setIsSubmitting(false);
        return;
      }

      onAdd();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsSubmitting(false);
    }
  };

  return (
    <GroupFormDialog
      title={t('groups.addNew')}
      submitLabel={t('common.create')}
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

export default AddGroupForm;
