import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User } from '@/types';
import { useUserData } from '@/hooks/useUserData';
import { useServerData } from '@/hooks/useServerData';
import { useAuth } from '@/contexts/AuthContext';
import { countGrantedTools, summarizeGrants } from '@/utils/grantPreview';
import AddUserForm from '@/components/AddUserForm';
import EditUserForm from '@/components/EditUserForm';
import { Edit3, Trash2, User as UserIcon, Plus, AlertCircle, X, RefreshCw, Clock, KeyRound } from 'lucide-react';
import ExpiryCenter from '@/components/ExpiryCenter';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import YluneDialog from '@/components/ui/YluneDialog';
import TokenLifetimeFields, {
  TokenLifetimeValue,
  isCustomExpiryInPast,
  isCustomExpiryMissing,
  toExpiryPayload,
} from '@/components/TokenLifetimeFields';
import DeleteDialog from '@/components/ui/DeleteDialog';
import PastExpiryAlert from '@/components/ui/PastExpiryAlert';
import SecretReveal from '@/components/ui/SecretReveal';
import McpJsonPanel from '@/components/McpJsonPanel';

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
    updateUser,
    rotateUserToken,
    triggerRefresh,
  } = useUserData();

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [renewingUser, setRenewingUser] = useState<User | null>(null);
  const [renewLifetime, setRenewLifetime] = useState<TokenLifetimeValue>('7d');
  const [renewCustomAt, setRenewCustomAt] = useState('');
  const [renewBusy, setRenewBusy] = useState(false);
  const [pastAlertOpen, setPastAlertOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const { allServers } = useServerData();
  const [rotatingUser, setRotatingUser] = useState<User | null>(null);
  const [rotatedToken, setRotatedToken] = useState<{ username: string; token: string } | null>(
    null,
  );

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
          <p className="ylune-help" style={{ marginBottom: 0 }}>
            {t('users.pageHint')}
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

      <ExpiryCenter
        users={users}
        onRenew={(user) => {
          setRenewingUser(user);
          setRenewLifetime(user.expired ? '7d' : '30d');
          setRenewCustomAt('');
        }}
      />

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
            <div>{t('users.tokenLifetime')}</div>
            <div>{t('users.token')}</div>
            <div>mcp.json</div>
            <div className="text-right">{t('users.actions')}</div>
          </div>
          {users.map((user) => {
            const isCurrentUser = currentUser?.username === user.username;
            const expired = user.expired === true;
            const grantRows = summarizeGrants(user.grants, allServers, user.isAdmin);
            return (
              <div
                key={user.username}
                className={`hub-row hover${expired ? ' is-expired' : ''}`}
              >
                <div className="flex items-start gap-3 min-w-0">
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
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
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
                      {expired && (
                        <span className="hub-tag muted" style={{ fontSize: 10 }}>
                          {t('users.tokenExpired')}
                        </span>
                      )}
                    </div>
                    <span className="ylune-help" style={{ margin: '2px 0 0', display: 'block' }}>
                      {user.isAdmin
                        ? t('users.adminUnrestricted')
                        : t('users.grantPreviewHint', {
                            servers: grantRows.length,
                            tools: countGrantedTools(grantRows),
                          })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center min-w-0">
                  <span
                    className="truncate"
                    style={{ fontSize: 13, color: user.remark ? 'var(--hub-ink)' : 'var(--hub-ink-3)' }}
                  >
                    {user.remark || '—'}
                  </span>
                </div>
                <div className="flex items-center min-w-0">
                  <span
                    className="truncate"
                    style={{
                      fontSize: 12,
                      color: expired ? 'var(--hub-err)' : 'var(--hub-ink-3)',
                    }}
                  >
                    {user.isAdmin || !user.tokenExpiresAt
                      ? t('users.tokenNeverExpires')
                      : t('users.tokenValidUntil', {
                          time: new Date(user.tokenExpiresAt).toLocaleString(),
                        })}
                  </span>
                </div>
                <div className="min-w-0">
                  <SecretReveal
                    variant="plain"
                    value={user.token}
                    emptyLabel={t('users.tokenMissing')}
                  />
                </div>
                <div className="min-w-0">
                  <McpJsonPanel username={user.username} token={user.token} compact />
                </div>
                <div className="flex justify-end gap-1">
                  {!user.isAdmin && (
                    <button
                      onClick={() => {
                        setRenewingUser(user);
                        setRenewLifetime(expired ? '7d' : '30d');
                        setRenewCustomAt('');
                      }}
                      className="hub-icon-btn sm"
                      title={t('users.renew')}
                    >
                      <Clock size={13} />
                    </button>
                  )}
                  {!user.isAdmin && (
                    <button
                      onClick={() => setRotatingUser(user)}
                      className="hub-icon-btn sm"
                      title={t('users.rotate')}
                    >
                      <KeyRound size={13} />
                    </button>
                  )}
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

      {renewingUser && (
        <div className="ylune-dialog-backdrop">
          <div className="ylune-dialog">
            <div className="ylune-dialog-head">
              <h2 className="ylune-dialog-title">
                {t('users.renew')} · {renewingUser.username}
              </h2>
            </div>
            <div className="ylune-dialog-body">
              <p className="ylune-help" style={{ marginTop: 0 }}>
                {t('users.renewHint')}
              </p>
              <TokenLifetimeFields
                lifetime={renewLifetime}
                customAt={renewCustomAt}
                onLifetimeChange={setRenewLifetime}
                onCustomAtChange={setRenewCustomAt}
                disabled={renewBusy}
              />
            </div>
            <div className="ylune-dialog-foot">
              <button
                type="button"
                className="hub-btn"
                disabled={renewBusy}
                onClick={() => setRenewingUser(null)}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="hub-btn primary"
                disabled={renewBusy}
                onClick={async () => {
                  if (isCustomExpiryMissing(renewLifetime, renewCustomAt)) {
                    setUserError(t('users.tokenCustomRequired'));
                    return;
                  }
                  if (isCustomExpiryInPast(renewLifetime, renewCustomAt)) {
                    setPastAlertOpen(true);
                    return;
                  }
                  setRenewBusy(true);
                  const result = await updateUser(
                    renewingUser.username,
                    toExpiryPayload(renewLifetime, renewCustomAt),
                  );
                  setRenewBusy(false);
                  if (result?.success) {
                    setRenewingUser(null);
                    triggerRefresh();
                  } else {
                    setUserError(result?.message || t('users.updateError'));
                  }
                }}
              >
                {t('users.renew')}
              </button>
            </div>
          </div>
        </div>
      )}

      <PastExpiryAlert isOpen={pastAlertOpen} onClose={() => setPastAlertOpen(false)} />

      <ConfirmDialog
        isOpen={!!rotatingUser}
        onClose={() => setRotatingUser(null)}
        title={t('users.rotate')}
        message={t('users.rotateHint', { username: rotatingUser?.username || '' })}
        confirmText={t('users.rotate')}
        variant="danger"
        onConfirm={async () => {
          if (!rotatingUser) return;
          const username = rotatingUser.username;
          const result = await rotateUserToken(username);
          setRotatingUser(null);
          if (result?.success && result.data?.token) {
            setRotatedToken({ username, token: result.data.token });
          } else {
            setUserError(result?.message || t('users.rotateError'));
          }
        }}
      />

      {rotatedToken && (
        <YluneDialog
          raised
          title={t('users.rotateSuccess')}
          onClose={() => setRotatedToken(null)}
          footer={
            <button type="button" className="hub-btn primary" onClick={() => setRotatedToken(null)}>
              {t('common.close')}
            </button>
          }
        >
          <p className="ylune-help" style={{ marginTop: 0 }}>
            {t('users.rotateSuccessHint')}
          </p>
          <SecretReveal value={rotatedToken.token} emptyLabel={t('users.tokenMissing')} />
          <div style={{ marginTop: 12 }}>
            <McpJsonPanel username={rotatedToken.username} token={rotatedToken.token} />
          </div>
        </YluneDialog>
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
