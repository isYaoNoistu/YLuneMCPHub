import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { Switch } from '@/components/ui/ToggleGroup';
import type { BearerKey } from '@/types';

interface BearerKeyRowProps {
  keyData: BearerKey;
  loading: boolean;
  availableServers: { value: string; label: string }[];
  availableGroups: { value: string; label: string }[];
  isAdmin: boolean;
  onSave: (
    id: string,
    payload: {
      name: string;
      enabled: boolean;
      accessType: 'all' | 'groups' | 'servers' | 'custom';
      allowedGroups: string;
      allowedServers: string;
    },
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const BearerKeyRow: React.FC<BearerKeyRowProps> = ({
  keyData,
  loading,
  availableServers,
  availableGroups,
  isAdmin,
  onSave,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(keyData.name);
  const [enabled, setEnabled] = useState<boolean>(keyData.enabled);
  const [accessType, setAccessType] = useState<'all' | 'groups' | 'servers' | 'custom'>(
    keyData.accessType || 'all',
  );
  const [selectedGroups, setSelectedGroups] = useState<string[]>(keyData.allowedGroups || []);
  const [selectedServers, setSelectedServers] = useState<string[]>(keyData.allowedServers || []);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setName(keyData.name);
      setEnabled(keyData.enabled);
      setAccessType(keyData.accessType || 'all');
      setSelectedGroups(keyData.allowedGroups || []);
      setSelectedServers(keyData.allowedServers || []);
    }
  }, [keyData, isEditing]);

  const { showToast } = useToast();
  const isSystemKey = (keyData.kind ?? 'system') === 'system';

  const handleSave = async () => {
    if (isSystemKey && accessType === 'groups' && selectedGroups.length === 0) {
      showToast(t('settings.selectAtLeastOneGroup') || 'Please select at least one group', 'error');
      return;
    }
    if (isSystemKey && accessType === 'servers' && selectedServers.length === 0) {
      showToast(
        t('settings.selectAtLeastOneServer') || 'Please select at least one server',
        'error',
      );
      return;
    }
    if (
      isSystemKey &&
      accessType === 'custom' &&
      selectedGroups.length === 0 &&
      selectedServers.length === 0
    ) {
      showToast(
        t('settings.selectAtLeastOneGroupOrServer') ||
          'Please select at least one group or server',
        'error',
      );
      return;
    }

    setSaving(true);
    try {
      await onSave(keyData.id, {
        name,
        enabled,
        accessType,
        allowedGroups: selectedGroups.join(', '),
        allowedServers: selectedServers.join(', '),
      });
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t('settings.deleteBearerKeyConfirm') || 'Delete this key?')) {
      return;
    }
    setDeleting(true);
    try {
      await onDelete(keyData.id);
    } finally {
      setDeleting(false);
    }
  };

  const isGroupsMode = accessType === 'groups';
  const isCustomMode = accessType === 'custom';

  const formatAccessTypeDisplay = (key: BearerKey): string => {
    if ((key.kind ?? 'system') === 'user') {
      return `${t('settings.bearerKeyAccessUserVisibility') || 'User visibility'}${key.owner ? ` · ${key.owner}` : ''}`;
    }
    if (key.accessType === 'all') {
      return t('settings.bearerKeyAccessAll') || 'All Resources';
    }
    if (key.accessType === 'groups') {
      return `${t('settings.bearerKeyAccessGroups') || 'Groups'}: ${key.allowedGroups}`;
    }
    if (key.accessType === 'servers') {
      return `${t('settings.bearerKeyAccessServers') || 'Servers'}: ${key.allowedServers}`;
    }
    if (key.accessType === 'custom') {
      const parts: string[] = [];
      if (key.allowedGroups && key.allowedGroups.length > 0) {
        parts.push(`${t('settings.bearerKeyAccessGroups') || 'Groups'}: ${key.allowedGroups}`);
      }
      if (key.allowedServers && key.allowedServers.length > 0) {
        parts.push(
          `${t('settings.bearerKeyAccessServers') || 'Servers'}: ${key.allowedServers}`,
        );
      }
      return `${t('settings.bearerKeyAccessCustom') || 'Custom'}: ${parts.join('; ')}`;
    }
    return '';
  };

  if (isEditing) {
    return (
      <tr>
        <td colSpan={5} className="p-0">
          <div className="settings-edit-panel">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
              <div className="md:col-span-3">
                <label className="block text-sm settings-label mb-1">
                  {t('settings.bearerKeyName') || 'Name'}
                </label>
                <input
                  type="text"
                  className="hub-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="md:col-span-9">
                <label className="block text-sm settings-label mb-1">
                  {t('settings.bearerKeyToken') || 'Token'}
                </label>
                <div
                  className="ylune-help"
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                  }}
                >
                  {keyData.token}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <div className="w-40">
                <label className="block text-sm settings-label mb-1">
                  {t('settings.bearerKeyEnabled') || 'Status'}
                </label>
                <div className="settings-row" style={{ padding: 0, border: 0, gap: 10 }}>
                  <span className={`hub-status ${enabled ? 'ok' : 'muted'}`}>
                    {enabled ? 'Active' : 'Inactive'}
                  </span>
                  <Switch
                    disabled={loading}
                    checked={enabled}
                    onCheckedChange={(checked) => setEnabled(checked)}
                  />
                </div>
              </div>

              {isAdmin && isSystemKey && (
                <div className="w-48">
                  <label className="block text-sm settings-label mb-1">
                    {t('settings.bearerKeyAccessType') || 'Access scope'}
                  </label>
                  <select
                    className="hub-input"
                    value={accessType}
                    onChange={(e) =>
                      setAccessType(e.target.value as 'all' | 'groups' | 'servers' | 'custom')
                    }
                    disabled={loading}
                  >
                    <option value="all">
                      {t('settings.bearerKeyAccessAll') || 'All Resources'}
                    </option>
                    <option value="groups">
                      {t('settings.bearerKeyAccessGroups') || 'Specific Groups'}
                    </option>
                    <option value="servers">
                      {t('settings.bearerKeyAccessServers') || 'Specific Servers'}
                    </option>
                    <option value="custom">
                      {t('settings.bearerKeyAccessCustom') || 'Custom (Groups & Servers)'}
                    </option>
                  </select>
                </div>
              )}

              {isAdmin && isSystemKey && !isCustomMode && (
                <div className="flex-1 min-w-[200px]">
                  <label
                    className={`ylune-label${accessType === 'all' ? ' is-muted' : ''}`}
                  >
                    {isGroupsMode
                      ? t('settings.bearerKeyAllowedGroups') || 'Allowed groups'
                      : t('settings.bearerKeyAllowedServers') || 'Allowed servers'}
                  </label>
                  <MultiSelect
                    options={isGroupsMode ? availableGroups : availableServers}
                    selected={isGroupsMode ? selectedGroups : selectedServers}
                    onChange={isGroupsMode ? setSelectedGroups : setSelectedServers}
                    placeholder={
                      isGroupsMode
                        ? t('settings.selectGroups') || 'Select groups...'
                        : t('settings.selectServers') || 'Select servers...'
                    }
                    disabled={loading || accessType === 'all'}
                  />
                </div>
              )}

              {isAdmin && isSystemKey && isCustomMode && (
                <>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm settings-label mb-1">
                      {t('settings.bearerKeyAllowedGroups') || 'Allowed groups'}
                    </label>
                    <MultiSelect
                      options={availableGroups}
                      selected={selectedGroups}
                      onChange={setSelectedGroups}
                      placeholder={t('settings.selectGroups') || 'Select groups...'}
                      disabled={loading}
                    />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm settings-label mb-1">
                      {t('settings.bearerKeyAllowedServers') || 'Allowed servers'}
                    </label>
                    <MultiSelect
                      options={availableServers}
                      selected={selectedServers}
                      onChange={setSelectedServers}
                      placeholder={t('settings.selectServers') || 'Select servers...'}
                      disabled={loading}
                    />
                  </div>
                </>
              )}

              <div className="settings-actions">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="hub-btn"
                >
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={loading || saving}
                  className="hub-btn primary"
                >
                  {saving ? t('common.saving') || 'Saving...' : t('common.save') || 'Save'}
                </button>
              </div>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{keyData.name}</td>
      <td className="font-mono">
        {keyData.token.length > 12
          ? `${keyData.token.substring(0, 8)}...${keyData.token.substring(keyData.token.length - 4)}`
          : keyData.token}
      </td>
      <td>
        <span className={`hub-status ${keyData.enabled ? 'ok' : 'muted'}`}>
          <span className="hub-dot" />
          {keyData.enabled ? t('common.active') || 'Active' : t('common.inactive') || 'Inactive'}
        </span>
      </td>
      <td>{formatAccessTypeDisplay(keyData)}</td>
      <td>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="hub-icon-btn sm"
          title={t('common.edit') || 'Edit'}
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="hub-icon-btn sm"
          title={t('common.delete') || 'Delete'}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
};

export default BearerKeyRow;
