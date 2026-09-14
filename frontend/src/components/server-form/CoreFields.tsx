import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { ServerFormData } from '@/types';
import {
  isValidServerName,
  SERVER_NAME_MAX_LENGTH,
  SERVER_NAME_PATTERN,
} from '../../utils/serverName';
import type { ServerType } from './types';

interface BasicInfoFieldsProps {
  formData: ServerFormData;
  enforceNamePattern: boolean;
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export const BasicInfoFields = ({
  formData,
  enforceNamePattern,
  onInputChange,
}: BasicInfoFieldsProps) => {
  const { t } = useTranslation();

  return (
    <div>
      <h3 className="ylune-section">{t('server.sectionBasicInfo', 'Basic Info')}</h3>

      <div className="space-y-4">
        <div>
          <label className="ylune-label" htmlFor="name">
            {t('server.name')}
          </label>
          <input
            type="text"
            name="name"
            id="name"
            value={formData.name}
            onChange={onInputChange}
            className="hub-input"
            placeholder="e.g.: time-mcp"
            pattern={enforceNamePattern ? SERVER_NAME_PATTERN.source : undefined}
            maxLength={enforceNamePattern ? SERVER_NAME_MAX_LENGTH : undefined}
            title={t('server.nameInvalid')}
            required
          />
          {formData.name && enforceNamePattern && !isValidServerName(formData.name) && (
            <p className="ylune-help">{t('server.nameInvalid')}</p>
          )}
        </div>

        <div>
          <label className="ylune-label" htmlFor="description">
            {t('server.description')}
          </label>
          <input
            type="text"
            name="description"
            id="description"
            value={formData.description || ''}
            onChange={onInputChange}
            className="hub-input"
            placeholder={t('server.descriptionPlaceholder')}
          />
        </div>
      </div>
    </div>
  );
};

interface ServerTypeFieldsProps {
  serverType: ServerType;
  onServerTypeChange: (type: ServerType) => void;
}

export const ServerTypeFields = ({
  serverType,
  onServerTypeChange,
}: ServerTypeFieldsProps) => {
  const { t } = useTranslation();

  return (
    <div className="mb-4">
      <label className="ylune-label">{t('server.type')}</label>
      <div className="ylune-seg" role="radiogroup" aria-label={t('server.type')}>
        <label className={serverType === 'stdio' ? 'is-on' : ''} htmlFor="command">
          <input
            type="radio"
            id="command"
            name="serverType"
            value="command"
            checked={serverType === 'stdio'}
            onChange={() => onServerTypeChange('stdio')}
          />
          {t('server.typeStdio')}
        </label>
        <label className={serverType === 'sse' ? 'is-on' : ''} htmlFor="url">
          <input
            type="radio"
            id="url"
            name="serverType"
            value="url"
            checked={serverType === 'sse'}
            onChange={() => onServerTypeChange('sse')}
          />
          {t('server.typeSse')}
        </label>
        <label
          className={serverType === 'streamable-http' ? 'is-on' : ''}
          htmlFor="streamable-http"
        >
          <input
            type="radio"
            id="streamable-http"
            name="serverType"
            value="streamable-http"
            checked={serverType === 'streamable-http'}
            onChange={() => onServerTypeChange('streamable-http')}
          />
          {t('server.typeStreamableHttp')}
        </label>
        <label className={serverType === 'openapi' ? 'is-on' : ''} htmlFor="openapi">
          <input
            type="radio"
            id="openapi"
            name="serverType"
            value="openapi"
            checked={serverType === 'openapi'}
            onChange={() => onServerTypeChange('openapi')}
          />
          {t('server.typeOpenapi')}
        </label>
      </div>
    </div>
  );
};
