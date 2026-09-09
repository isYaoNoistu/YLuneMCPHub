import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Download, Upload, AlertCircle, X } from 'lucide-react';
import { Group } from '@/types';
import { useGroupData } from '@/hooks/useGroupData';
import { useServerData } from '@/hooks/useServerData';
import AddGroupForm from '@/components/AddGroupForm';
import EditGroupForm from '@/components/EditGroupForm';
import GroupCard from '@/components/GroupCard';
import GroupImportForm from '@/components/GroupImportForm';
import TemplateExportForm from '@/components/TemplateExportForm';
import TemplateImportForm from '@/components/TemplateImportForm';
import { useCostData } from '@/hooks/useCostData';
import { useAuth } from '@/contexts/AuthContext';

const GroupsPage: React.FC = () => {
  const { t } = useTranslation();
  const { auth } = useAuth();
  const isAdmin = auth.user?.isAdmin === true;
  const {
    groups,
    loading: groupsLoading,
    error: groupError,
    setError: setGroupError,
    deleteGroup,
    triggerRefresh,
  } = useGroupData();
  const { allServers } = useServerData({ refreshOnMount: true });
  const { groupCosts, refetch: refetchCost } = useCostData();

  // Re-fetch context footprint whenever group definitions or server connection state change.
  useEffect(() => {
    refetchCost();
  }, [groups, allServers, refetchCost]);

  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [showTemplateExport, setShowTemplateExport] = useState(false);
  const [showTemplateImport, setShowTemplateImport] = useState(false);

  const handleDeleteGroup = async (groupId: string) => {
    const result = await deleteGroup(groupId);
    if (!result || !result.success) {
      setGroupError(result?.message || t('groups.deleteError'));
    }
  };

  return (
    <div>
      <div className="hub-page-head">
        <div>
          <h1 className="hub-h1">{t('pages.groups.title')}</h1>
          <p className="hub-sub">
            <span className="hub-num">{groups.length}</span> {t('nav.groups')}
            {' · '}
            {t(isAdmin ? 'groups.pageHintAdmin' : 'groups.pageHint')}
          </p>
        </div>
        {isAdmin && (
          <div className="view-actions">
            <button className="hub-btn" onClick={() => setShowImportForm(true)}>
              <Upload size={13} /> {t('groupImport.button')}
            </button>
            <button className="hub-btn" onClick={() => setShowTemplateExport(true)}>
              <Download size={13} /> {t('template.exportButton')}
            </button>
            <button className="hub-btn" onClick={() => setShowTemplateImport(true)}>
              <Upload size={13} /> {t('template.importButton')}
            </button>
            <button className="hub-btn primary" onClick={() => setShowAddForm(true)}>
              <Plus size={13} /> {t('groups.add')}
            </button>
          </div>
        )}
      </div>

      {groupError && (
        <div className="ylune-banner is-danger flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle size={14} className="flex-shrink-0" />
            <span className="truncate text-[13px]">{groupError}</span>
          </div>
          <button className="hub-icon-btn sm" onClick={() => setGroupError(null)}>
            <X size={13} />
          </button>
        </div>
      )}

      {groupsLoading ? (
        <div className="hub-card p-6 text-center" style={{ color: 'var(--hub-ink-3)' }}>
          {t('app.loading')}
        </div>
      ) : groups.length === 0 ? (
        <div className="hub-card">
          <div className="hub-empty">
            <div className="hub-empty-icon">
              <Plus size={18} />
            </div>
            <p className="hub-empty-title">
              {isAdmin ? t('groups.noGroups') : t('groups.noMemberGroups')}
            </p>
            {isAdmin && (
              <button type="button" onClick={() => setShowAddForm(true)} className="hub-empty-link">
                {t('groups.addNew')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="group-grid">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              servers={allServers}
              onEdit={setEditingGroup}
              onDelete={handleDeleteGroup}
              cost={groupCosts.find((c) => c.id === group.id)}
              canManage={isAdmin}
            />
          ))}
          {isAdmin && (
          <button type="button" onClick={() => setShowAddForm(true)} className="group-add">
            <span className="group-add-plus" aria-hidden="true">
              <Plus size={16} />
            </span>
            <b>{t('groups.add')}</b>
            <span className="mono">{t('groups.addNew')}</span>
          </button>
          )}
        </div>
      )}

      {showAddForm && (
        <AddGroupForm
          onAdd={() => {
            setShowAddForm(false);
            triggerRefresh();
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {showImportForm && (
        <GroupImportForm
          onSuccess={() => {
            setShowImportForm(false);
            triggerRefresh();
          }}
          onCancel={() => setShowImportForm(false)}
        />
      )}

      {editingGroup && (
        <EditGroupForm
          group={editingGroup}
          onEdit={() => {
            setEditingGroup(null);
            triggerRefresh();
          }}
          onCancel={() => setEditingGroup(null)}
        />
      )}

      {showTemplateExport && (
        <TemplateExportForm groups={groups} onCancel={() => setShowTemplateExport(false)} />
      )}

      {showTemplateImport && (
        <TemplateImportForm
          onSuccess={() => {
            setShowTemplateImport(false);
            triggerRefresh();
          }}
          onCancel={() => setShowTemplateImport(false)}
        />
      )}
    </div>
  );
};

export default GroupsPage;
