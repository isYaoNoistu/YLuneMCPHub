import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiPost } from '@/utils/fetchInterceptor';
import { Group, ConfigTemplate } from '@/types';
import YluneDialog from './ui/YluneDialog';

interface TemplateExportFormProps {
  groups: Group[];
  onCancel: () => void;
}

const TemplateExportForm: React.FC<TemplateExportFormProps> = ({ groups, onCancel }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [includeDisabled, setIncludeDisabled] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
    );
  };

  const handleSelectAll = () => {
    if (selectedGroupIds.length === groups.length) {
      setSelectedGroupIds([]);
    } else {
      setSelectedGroupIds(groups.map((g) => g.id));
    }
  };

  const handleExport = async () => {
    if (!name.trim()) {
      setError(t('template.nameRequired'));
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      const result = await apiPost('/templates/export', {
        name: name.trim(),
        description: description.trim() || undefined,
        groupIds: selectedGroupIds.length > 0 ? selectedGroupIds : undefined,
        includeDisabledServers: includeDisabled,
      });

      if (result.success && result.data) {
        const template: ConfigTemplate = result.data;
        const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${template.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.mcphub-template.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        onCancel();
      } else {
        setError(result.message || t('template.exportFailed'));
      }
    } catch (err) {
      console.error('Export error:', err);
      setError(t('template.exportFailed'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <YluneDialog
      size="lg"
      title={t('template.exportTitle')}
      onClose={onCancel}
      footer={
        <>
          <button type="button" onClick={onCancel} className="hub-btn">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || !name.trim()}
            className="hub-btn primary"
          >
            {isExporting ? t('template.exporting') : t('template.export')}
          </button>
        </>
      }
    >
        {error && <div className="ylune-error">{error}</div>}

        <div>
          <div>
            <label className="ylune-label">
              {t('template.name')} <span className="ylune-req">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="hub-input"
              placeholder={t('template.namePlaceholder')}
            />
          </div>

          <div>
            <label className="ylune-label">
              {t('template.description')}
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="hub-input"
              placeholder={t('template.descriptionPlaceholder')}
            />
          </div>

          <div>
            <div className="ylune-inline">
              <label className="ylune-label" style={{ marginBottom: 0 }}>
                {t('template.selectGroups')}
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="ylune-link-btn"
              >
                {selectedGroupIds.length === groups.length
                  ? t('template.deselectAll')
                  : t('template.selectAll')}
              </button>
            </div>
            <p className="ylune-help">{t('template.selectGroupsHelp')}</p>
            <div className="border border-gray-200 dark:border-gray-700 rounded-md max-h-48 overflow-y-auto">
              {groups.map((group) => (
                <label
                  key={group.id}
                  className="flex items-center px-3 py-2 hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedGroupIds.includes(group.id)}
                    onChange={() => handleToggleGroup(group.id)}
                    className="mr-3 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">{group.name}</span>
                    {group.description && (
                      <span className="text-xs text-gray-500 ml-2">{group.description}</span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <label className="ylune-check">
            <input
              type="checkbox"
              checked={includeDisabled}
              onChange={(e) => setIncludeDisabled(e.target.checked)}
            />
            {t('template.includeDisabled')}
          </label>
        </div>

        <p className="ylune-help">{t('template.exportNote')}</p>
    </YluneDialog>
  );
};

export default TemplateExportForm;
