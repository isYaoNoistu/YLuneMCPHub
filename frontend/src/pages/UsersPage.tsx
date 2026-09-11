import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User } from '@/types';
import { useUserData } from '@/hooks/useUserData';
import { useServerData } from '@/hooks/useServerData';
import { useAuth } from '@/contexts/AuthContext';
import { countGrantedTools, summarizeGrants } from '@/utils/grantPreview';
import { isExpiredUser, isExpiringSoon } from '@/utils/expiryCenter';
import { copyUserGrants } from '@/services/opsService';
import AddUserForm from '@/components/AddUserForm';
import AddAdminForm from '@/components/AddAdminForm';
import AddDemoForm from '@/components/AddDemoForm';
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
  const [showAddForm, setShowAddForm] = useState<'mcp' | 'admin' | 'demo' | null>(null);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const { allServers } = useServerData();
  const [rotatingUser, setRotatingUser] = useState<User | null>(null);
  const [rotatedToken, setRotatedToken] = useState<{ username: string; token: string } | null>(
    null,
  );
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'ok' | 'expiring' | 'expired' | 'noGrants' | 'admin'>(
    'all',
  );
  const [copyingUser, setCopyingUser] = useState<User | null>(null);
  const [copyFrom, setCopyFrom] = useState('');

  const filteredUsers = users.filter((user) => {
    const haystack = `${user.username} ${user.remark || ''}`.toLowerCase();
    if (query.trim() && !haystack.includes(query.trim().toLowerCase())) {
      return false;
    }
    const mcpOn = user.mcpEnabled !== false;
    const expired = isExpiredUser(user);
    const expiring = isExpiringSoon(user, 7);
    const noGrants = !user.isAdmin && !user.demo && (!user.grants || user.grants.length === 0);
    if (filter === 'ok') return mcpOn && !expired && !expiring;
    if (filter === 'expiring') return expiring;
    if (filter === 'expired') return expired;
    if (filter === 'noGrants') return noGrants;
    if (filter === 'admin') return Boolean(user.isAdmin);
    return true;
  });

  if (!currentUser?.isAdmin) {
    return (
      <div className="hub-card p-6 text-center" style={{ color: 'var(--hub-err)' }}>
        {t('users.adminRequired')}
      </div>
    );
  }

  return (
    <div className="hub-page-stack">
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
          <button className="hub-btn" onClick={() => setShowAddForm('mcp')}>
            <Plus size={13} /> {t('users.addMcp')}
          </button>
          <button className="hub-btn" onClick={() => setShowAddForm('demo')}>
            <Plus size={13} /> {t('users.addDemo')}
          </button>
          <button className="hub-btn primary" onClick={() => setShowAddForm('admin')}>
            <Plus size={13} /> {t('users.addAdmin')}
          </button>
        </div>
      </div>

      {userError && (
        <div
          className="hub-card flex items-center justify-between gap-3"
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

      <div className="users-toolbar">
        <input
          className="hub-input"
          style={{ maxWidth: 280 }}
          placeholder={t('users.searchPlaceholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {(
          [
            ['all', t('users.filterAll')],
            ['ok', t('users.filterOk')],
            ['expiring', t('users.filterExpiring')],
            ['expired', t('users.filterExpired')],
            ['noGrants', t('users.filterNoGrants')],
            ['admin', t('users.filterAdmin')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`hub-btn${filter === id ? ' primary' : ''}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {usersLoading ? (
        <div className="hub-card p-10 text-center" style={{ color: 'var(--hub-ink-3)' }}>
          {t('app.loading')}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="hub-card">
          <div className="hub-empty">
            <div className="hub-empty-icon">
              <UserIcon size={18} />
            </div>
            <p className="hub-empty-title">{t('users.noUsers')}</p>
            <button type="button" onClick={() => setShowAddForm('mcp')} className="hub-empty-link">
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
            <div>{t('users.mcpSnippet')}</div>
            <div className="text-right">{t('users.actions')}</div>
          </div>
          {filteredUsers.map((user) => {
            const isCurrentUser = currentUser?.username === user.username;
            const mcpOn = user.mcpEnabled !== false;
            const expired = mcpOn && user.expired === true;
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
                      {user.demo && (
                        <span className="hub-tag muted" style={{ fontSize: 10 }}>
                          {t('users.roleDemo')}
                        </span>
                      )}
                      {user.isAdmin && !user.demo && (
                        <span className="hub-tag accent" style={{ fontSize: 10 }}>
                          {user.mcpEnabled === false ? t('users.roleConsole') : t('users.roleBoth')}
                        </span>
                      )}
                      {!user.isAdmin && !user.demo && (
                        <span className="hub-tag muted" style={{ fontSize: 10 }}>
                          {t('users.roleMcp')}
                        </span>
                      )}
                      {expired && (
                        <span className="hub-tag muted" style={{ fontSize: 10 }}>
                          {t('users.tokenExpired')}
                        </span>
                      )}
                    </div>
                    <span className="ylune-help" style={{ margin: '2px 0 0', display: 'block' }}>
                      {user.demo
                        ? t('users.demoHint')
                        : user.isAdmin
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
                    {!user.demo && mcpOn
                      ? !user.tokenExpiresAt
                        ? t('users.tokenNeverExpires')
                        : t('users.tokenValidUntil', {
                            time: new Date(user.tokenExpiresAt).toLocaleString(),
                          })
                      : user.demo
                        ? t('users.demoNoKey')
                        : t('users.adminNoMcp')}
                  </span>
                </div>
                <div className="min-w-0">
                  {user.demo ? (
                    <span className="ylune-help">{t('users.demoNoKey')}</span>
                  ) : mcpOn ? (
                    <SecretReveal
                      variant="plain"
                      value={user.token}
                      emptyLabel={t('users.tokenMissing')}
                    />
                  ) : (
                    <span className="ylune-help">{t('users.adminNoMcp')}</span>
                  )}
                </div>
                <div className="min-w-0">
                  {user.demo ? (
                    <span className="ylune-help">—</span>
                  ) : mcpOn && user.token ? (
                    <McpJsonPanel username={user.username} token={user.token} compact />
                  ) : (
                    <span className="ylune-help">—</span>
                  )}
                </div>
                <div className="flex justify-end gap-1">
                  {mcpOn && !user.demo && (
                    <button
                      onClick={() => {
                        setCopyingUser(user);
                        setCopyFrom('');
                      }}
                      className="hub-icon-btn sm"
                      title={t('users.copyGrants')}
                    >
                      <RefreshCw size={13} />
                    </button>
                  )}
                  {mcpOn && !user.demo && (
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
                  {mcpOn && !user.demo && (
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

      {showAddForm === 'mcp' && (
        <AddUserForm
          onAdd={() => {
            setShowAddForm(null);
            triggerRefresh();
          }}
          onCancel={() => setShowAddForm(null)}
        />
      )}
      {showAddForm === 'admin' && (
        <AddAdminForm
          onAdd={() => {
            setShowAddForm(null);
            triggerRefresh();
          }}
          onCancel={() => setShowAddForm(null)}
        />
      )}
      {showAddForm === 'demo' && (
        <AddDemoForm
          onAdd={() => {
            setShowAddForm(null);
            triggerRefresh();
          }}
          onCancel={() => setShowAddForm(null)}
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

      {copyingUser && (
        <div className="ylune-dialog-backdrop">
          <div className="ylune-dialog">
            <div className="ylune-dialog-head">
              <h2 className="ylune-dialog-title">
                {t('users.copyGrants')} · {copyingUser.username}
              </h2>
            </div>
            <div className="ylune-dialog-body">
              <p className="ylune-help" style={{ marginTop: 0 }}>
                {t('users.copyGrantsHint', { username: copyingUser.username })}
              </p>
              <label className="ylune-label">{t('users.copyFrom')}</label>
              <select
                className="hub-input"
                value={copyFrom}
                onChange={(event) => setCopyFrom(event.target.value)}
              >
                <option value="">{t('users.copyFrom')}</option>
                {users
                  .filter((user) => user.username !== copyingUser.username)
                  .map((user) => (
                    <option key={user.username} value={user.username}>
                      {user.username}
                    </option>
                  ))}
              </select>
            </div>
            <div className="ylune-dialog-foot">
              <button type="button" className="hub-btn" onClick={() => setCopyingUser(null)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="hub-btn primary"
                disabled={!copyFrom}
                onClick={async () => {
                  const result = await copyUserGrants(copyingUser.username, copyFrom);
                  if (result?.success) {
                    setCopyingUser(null);
                    triggerRefresh();
                  } else {
                    setUserError(result?.message || t('users.updateError'));
                  }
                }}
              >
                {t('users.copyGrants')}
              </button>
            </div>
          </div>
        </div>
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
