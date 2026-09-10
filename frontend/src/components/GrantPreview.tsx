import { useTranslation } from 'react-i18next';
import { IGroupServerConfig, Server } from '@/types';
import { countGrantedTools, summarizeGrants } from '@/utils/grantPreview';

interface GrantPreviewProps {
  grants?: IGroupServerConfig[];
  servers: Server[];
  isAdmin?: boolean;
}

const GrantPreview = ({ grants, servers, isAdmin = false }: GrantPreviewProps) => {
  const { t } = useTranslation();
  const rows = summarizeGrants(grants, servers, isAdmin);
  const toolCount = countGrantedTools(rows);

  return (
    <div className="grant-preview">
      <label className="ylune-label">{t('users.grantPreview')}</label>
      <p className="ylune-help" style={{ marginTop: 0 }}>
        {isAdmin
          ? t('users.adminUnrestricted')
          : t('users.grantPreviewHint', { servers: rows.length, tools: toolCount })}
      </p>
      {rows.length === 0 ? (
        <p className="ylune-help">{t('users.grantPreviewEmpty')}</p>
      ) : (
        <ul className="grant-preview-list">
          {rows.map((row) => (
            <li key={row.server}>
              <strong>{row.server}</strong>
              <span>
                {row.allTools
                  ? t('users.grantPreviewAll', { count: row.tools.length })
                  : row.tools.join(', ') || t('users.grantPreviewEmpty')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default GrantPreview;
