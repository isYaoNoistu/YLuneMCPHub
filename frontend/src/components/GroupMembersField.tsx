import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserData } from '@/hooks/useUserData';
import {
  deselectShareUsers,
  filterShareUsers,
  getSelectableShareUsers,
  selectShareUsers,
} from '../utils/shareUserSelection';

interface GroupMembersFieldProps {
  value: string[];
  onChange: (members: string[]) => void;
}

const GroupMembersField = ({ value, onChange }: GroupMembersFieldProps) => {
  const { t } = useTranslation();
  const { users, loading, error } = useUserData();
  const [search, setSearch] = useState('');
  const selected = new Set(value);

  const candidates = useMemo(() => {
    return getSelectableShareUsers(
      value,
      users.map((user) => user.username).filter((username): username is string => Boolean(username)),
    );
  }, [users, value]);

  const filtered = useMemo(() => filterShareUsers(candidates, search), [candidates, search]);

  const toggle = (username: string) => {
    onChange(
      selected.has(username)
        ? deselectShareUsers(value, [username])
        : selectShareUsers(value, [username]),
    );
  };

  const selectFiltered = () => {
    onChange(selectShareUsers(value, filtered));
  };

  const deselectFiltered = () => {
    onChange(deselectShareUsers(value, filtered));
  };

  return (
    <div className="ylune-panel">
      <div className="ylune-panel-title">{t('groups.members')}</div>
      <p className="ylune-help">{t('groups.membersHelp')}</p>
      {loading && <p className="ylune-help">{t('groups.membersLoading')}</p>}
      {error && <p className="ylune-error">{error}</p>}
      {!loading && !error && candidates.length === 0 && (
        <p className="ylune-help">{t('groups.noMemberCandidates')}</p>
      )}
      {candidates.length > 0 && (
        <>
          <div className="ylune-field">
            <label htmlFor="group-member-search" className="ylune-label">
              {t('groups.memberSearch')}
            </label>
            <input
              id="group-member-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('groups.memberSearchPlaceholder')}
              className="hub-input"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={selectFiltered}
                disabled={filtered.length === 0 || filtered.every((name) => selected.has(name))}
                className="hub-btn sm"
              >
                {t('groups.selectAllMembers')}
              </button>
              <button
                type="button"
                onClick={deselectFiltered}
                disabled={filtered.every((name) => !selected.has(name))}
                className="hub-btn sm"
              >
                {t('groups.deselectAllMembers')}
              </button>
            </div>
          </div>
          {filtered.length === 0 ? (
            <p className="ylune-help">{t('groups.noMatchingMembers')}</p>
          ) : (
            <div className="ylune-pair">
              {filtered.map((username) => (
                <label key={username} className="ylune-check">
                  <input
                    type="checkbox"
                    checked={selected.has(username)}
                    onChange={() => toggle(username)}
                  />
                  <span>{username}</span>
                </label>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GroupMembersField;
