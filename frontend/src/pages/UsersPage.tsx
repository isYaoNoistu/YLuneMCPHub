import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User } from '@/types';
import { useUserData } from '@/hooks/useUserData';
import { useAuth } from '@/contexts/AuthContext';
import AddUserForm from '@/components/AddUserForm';
import EditUserForm from '@/components/EditUserForm';
import { Edit3, Trash2, User as UserIcon, Plus, AlertCircle, X, RefreshCw } from 'lucide-react';
import DeleteDialog from '@/components/ui/DeleteDialog';
import SecretReveal from '@/components/ui/SecretReveal';

const UsersPage: React.FC = () => {
  const { t } = useTranslation();
  const { auth } = useAuth();
  const currentUser = auth.user;
  const {
    users,
    loading: usersLoading,
    error: userError,
    setError: setUserError,
    deleteUser,
    triggerRefresh,
  } = useUserData();

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  if (!currentUser?.isAdmin) {
    return (
      <div className="hub-card p-6 text-center" style={{ color: 'var(--hub-err)' }}>
        {t('users.adminRequired')}
      </div>
    );
  }

  return (
    <div>
      <div className="hub-page-head">
        <div>
          <h1 className="hub-h1">{t('pages.users.title')}</h1>
          <p className="hub-sub">
            <span className="hub-num">{users.length}</span> {t('nav.users')}
          </p>
        </div>
        <div className="view-actions">
          <button
            className="hub-btn"
            onClick={() => triggerRefresh()}
            aria-label={t('common.refresh')}
          >
            <RefreshCw size={13} /> {t('common.refresh')}
          </button>
          <button className="hub-btn primary" onClick={() => setShowAddForm(true)}>
            <Plus size={13} /> {t('users.add')}
          </button>
        </div>
      </div>

      {userError && (
        <div
          className="hub-card flex items-center justify-between gap-3 mb-4"
          style={{
            padding: '10px 14px',
            borderColor: 'oklch(0.85 0.1 25)',
            background: 'oklch(0.97 0.03 25)',
            color: 'oklch(0.4 0.18 25)',
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle size={14} className="flex-shrink-0" />
            <span className="truncate text-[13px]">{userError}</span>
          </div>
          <button className="hub-icon-btn sm" onClick={() => setUserError(null)}>
            <X size={13} />
          </button>
        </div>
      )}

      {usersLoading ? (
        <div className="hub-card p-10 text-center" style={{ color: 'var(--hub-ink-3)' }}>
          {t('app.loading')}
        </div>
      ) : users.length === 0 ? (
        <div className="hub-card">
          <div className="hub-empty">
            <div className="hub-empty-icon">
              <UserIcon size={18} />
            </div>
            <p className="hub-empty-title">{t('users.noUsers')}</p>
            <button type="button" onClick={() => setShowAddForm(true)} className="hub-empty-link">
              {t('users.addFirst')}
            </button>
          </div>
        </div>
      ) : (
        <div className="hub-card overflow-hidden users-table">
          <div className="hub-row head hub-mono">
            <div>{t('users.username')}</div>
            <div>{t('users.remark')}</div>
            <div>{t('users.token')}</div>
            <div className="text-right">{t('users.actions')}</div>
          </div>
          {users.map((user) => {
            const isCurrentUser = currentUser?.username === user.username;
            return (
              <div
                key={user.username}
                className="hub-row hover"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="grid place-items-center flex-shrink-0 hub-mono"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      background: 'var(--hub-bg-2)',
                      border: '1px solid var(--hub-line)',
                      color: 'var(--hub-ink-2)',
                      fontWeight: 600,
                      fontSize: 12,
                    }}
                  >
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <span
                    className="hub-mono truncate"
                    style={{ fontSize: 13, color: 'var(--hub-ink)' }}
                  >
                    {user.username}
                  </span>
                  {isCurrentUser && (
                    <span className="hub-tag accent" style={{ fontSize: 10 }}>
                      {t('users.currentUser')}
                    </span>
                  )}
                </div>
                <div className="flex items-center min-w-0">
                  <span
                    className="truncate"
                    style={{ fontSize: 13, color: user.remark ? 'var(--hub-ink)' : 'var(--hub-ink-3)' }}
                  >
                    {user.remark || '—'}
                  </span>
                </div>
                <div className="min-w-0">
                  <SecretReveal
                    variant="plain"
                    value={user.token}
                    emptyLabel={t('users.tokenMissing')}
                  />
                </div>
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => setEditingUser(user)}
                    className="hub-icon-btn sm"
                    title={t('users.edit')}
                  >
                    <Edit3 size={13} />
                  </button>
                  {!isCurrentUser && (
                    <button
                      onClick={() => setUserToDelete(user.username)}
                      className="hub-icon-btn sm"
                      title={t('users.delete')}
                      style={{ color: 'var(--hub-err)' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddForm && (
        <AddUserForm
          onAdd={() => {
            setShowAddForm(false);
            triggerRefresh();
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {editingUser && (
        <EditUserForm
          user={editingUser}
          onEdit={() => {
            setEditingUser(null);
            triggerRefresh();
          }}
          onCancel={() => setEditingUser(null)}
        />
      )}

      <DeleteDialog
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={async () => {
          if (userToDelete) {
            const result = await deleteUser(userToDelete);
            if (!result?.success) {
              setUserError(result?.message || t('users.deleteError'));
            }
            setUserToDelete(null);
          }
        }}
        serverName={userToDelete || ''}
        isGroup={false}
        isUser={true}
      />
    </div>
  );
};

export default UsersPage;
