import { useTranslation } from 'react-i18next';
import type { EnvVar, OpenApiToolStats, ServerFormData } from '@/types';
import { OPENAPI_STATS_WARN_TOKENS, formatBytes, formatTokens } from '../../utils/contextCost';
import type { OpenApiSecurityNotice } from '../../utils/openApiSecurityPrefill';
import type { KeyValueField, SetServerFormData } from './types';

interface OpenApiTransportFieldsProps {
  formData: ServerFormData;
  setFormData: SetServerFormData;
  isEdit: boolean;
  openApiSourcePresent: boolean;
  openApiStats: OpenApiToolStats | null;
  openApiStatsLoading: boolean;
  openApiStatsUnavailable: boolean;
  openApiSecurityNotice: OpenApiSecurityNotice | null;
  securityDetectionLoading: boolean;
  headerVars: EnvVar[];
  onMarkSecurityTouched: () => void;
  onDetectSecurity: () => Promise<void>;
  onAddHeaderVar: () => void;
  onHeaderVarChange: (index: number, field: KeyValueField, value: string) => void;
  onRemoveHeaderVar: (index: number) => void;
}

const OpenApiTransportFields = ({
  formData,
  setFormData,
  isEdit,
  openApiSourcePresent,
  openApiStats,
  openApiStatsLoading,
  openApiStatsUnavailable,
  openApiSecurityNotice,
  securityDetectionLoading,
  headerVars,
  onMarkSecurityTouched,
  onDetectSecurity,
  onAddHeaderVar,
  onHeaderVarChange,
  onRemoveHeaderVar,
}: OpenApiTransportFieldsProps) => {
  const { t } = useTranslation();

  return (
    <>
      {/* Input Mode Selection */}
      <div className="mb-4">
        <label className="ylune-label">{t('server.openapi.inputMode')}</label>
        <div className="flex space-x-4">
          <div>
            <input
              type="radio"
              id="input-mode-url"
              name="inputMode"
              value="url"
              checked={formData.openapi?.inputMode === 'url'}
              onChange={() =>
                setFormData((prev) => ({
                  ...prev,
                  openapi: { ...prev.openapi!, inputMode: 'url' },
                }))
              }
              className="mr-1"
            />
            <label htmlFor="input-mode-url">{t('server.openapi.inputModeUrl')}</label>
          </div>
          <div>
            <input
              type="radio"
              id="input-mode-schema"
              name="inputMode"
              value="schema"
              checked={formData.openapi?.inputMode === 'schema'}
              onChange={() =>
                setFormData((prev) => ({
                  ...prev,
                  openapi: { ...prev.openapi!, inputMode: 'schema' },
                }))
              }
              className="mr-1"
            />
            <label htmlFor="input-mode-schema">{t('server.openapi.inputModeSchema')}</label>
          </div>
        </div>
      </div>

      {/* URL Input */}
      {formData.openapi?.inputMode === 'url' && (
        <div className="mb-4">
          <label className="ylune-label" htmlFor="openapi-url">
            {t('server.openapi.specUrl')}
          </label>
          <input
            type="url"
            name="openapi-url"
            id="openapi-url"
            value={formData.openapi?.url || ''}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                openapi: { ...prev.openapi!, url: e.target.value },
              }))
            }
            className="hub-input"
            placeholder="e.g.: https://api.example.com/openapi.json"
            required={formData.openapi?.inputMode === 'url'}
          />
        </div>
      )}

      {/* Schema Input */}
      {formData.openapi?.inputMode === 'schema' && (
        <div className="mb-4">
          <label className="ylune-label" htmlFor="openapi-schema">
            {t('server.openapi.schema')}
          </label>
          <textarea
            name="openapi-schema"
            id="openapi-schema"
            rows={10}
            value={formData.openapi?.schema || ''}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                openapi: { ...prev.openapi!, schema: e.target.value },
              }))
            }
            className="hub-input area mono"
            placeholder={`{
  "openapi": "3.1.0",
  "info": {
    "title": "API",
    "version": "1.0.0"
  },
  "servers": [
    {
      "url": "https://api.example.com"
    }
  ],
  "paths": {
    ...
  }
}`}
            required={formData.openapi?.inputMode === 'schema'}
          />
          <p className="ylune-help">{t('server.openapi.schemaHelp')}</p>
        </div>
      )}

      {!isEdit && openApiSourcePresent && (
        <div className="ylune-banner mb-4" aria-live="polite">
          {openApiStatsLoading ? (
            <p>{t('server.openapi.statsMeasuring')}</p>
          ) : openApiStats ? (
            <>
              <p>
                {t('server.openapi.statsSummary', {
                  toolCount: openApiStats.toolCount,
                  bytes: formatBytes(openApiStats.definitionsBytes),
                  tokens: formatTokens(openApiStats.estimatedTokens),
                })}
              </p>
              {openApiStats.estimatedTokens >= OPENAPI_STATS_WARN_TOKENS && (
                <p className="ylune-help">{t('server.openapi.statsWarning')}</p>
              )}
            </>
          ) : openApiStatsUnavailable ? (
            <p>{t('server.openapi.statsUnavailable')}</p>
          ) : null}
        </div>
      )}

      {/* Security Configuration */}
      <div className="mb-4" onChange={onMarkSecurityTouched}>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-[var(--hub-ink-2)]">
            {t('server.openapi.security')}
          </label>
          <button
            type="button"
            onClick={() => void onDetectSecurity()}
            disabled={securityDetectionLoading || openApiStatsLoading || !openApiSourcePresent}
            className="hub-btn text-xs !h-7 !px-2"
          >
            {securityDetectionLoading || openApiStatsLoading
              ? t('server.openapi.securityDetecting')
              : t('server.openapi.securityDetect')}
          </button>
        </div>
        <select
          value={formData.openapi?.securityType || 'none'}
          onChange={(e) =>
            setFormData((prev) => {
              return {
                ...prev,
                openapi: {
                  ...prev.openapi,
                  securityType: e.target.value as any,
                  url: prev.openapi?.url || '',
                },
              };
            })
          }
          className="hub-input"
        >
          <option value="none">{t('server.openapi.securityNone')}</option>
          <option value="apiKey">{t('server.openapi.securityApiKey')}</option>
          <option value="http">{t('server.openapi.securityHttp')}</option>
          <option value="oauth2">{t('server.openapi.securityOAuth2')}</option>
          <option value="openIdConnect">{t('server.openapi.securityOpenIdConnect')}</option>
        </select>
        {openApiSecurityNotice && (
          <p
            className={`mt-2 text-xs ${
              openApiSecurityNotice.kind === 'warning'
                ? 'text-yellow-700 dark:text-yellow-300'
                : 'text-blue-700 dark:text-blue-300'
            }`}
          >
            {t(
              `server.openapi.${openApiSecurityNotice.messageKey}`,
              openApiSecurityNotice.values,
            )}
          </p>
        )}
      </div>

      {/* API Key Configuration */}
      {formData.openapi?.securityType === 'apiKey' && (
        <div className="mb-4 p-4 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800">
          <h4 className="text-sm font-medium mb-3 text-[var(--hub-ink-2)]">
            {t('server.openapi.apiKeyConfig')}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[var(--hub-ink-2)] mb-1">
                {t('server.openapi.apiKeyName')}
              </label>
              <input
                type="text"
                value={formData.openapi?.apiKeyName || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    openapi: {
                      ...prev.openapi,
                      apiKeyName: e.target.value,
                      url: prev.openapi?.url || '',
                    },
                  }))
                }
                className="hub-input"
                placeholder="Authorization"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--hub-ink-2)] mb-1">
                {t('server.openapi.apiKeyIn')}
              </label>
              <select
                value={formData.openapi?.apiKeyIn || 'header'}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    openapi: {
                      ...prev.openapi,
                      apiKeyIn: e.target.value as any,
                      url: prev.openapi?.url || '',
                    },
                  }))
                }
                className="hub-input"
              >
                <option value="header">{t('server.openapi.apiKeyInHeader')}</option>
                <option value="query">{t('server.openapi.apiKeyInQuery')}</option>
                <option value="cookie">{t('server.openapi.apiKeyInCookie')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                {t('server.openapi.apiKeyValue')}
              </label>
              <input
                type="password"
                value={formData.openapi?.apiKeyValue || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    openapi: {
                      ...prev.openapi,
                      apiKeyValue: e.target.value,
                      url: prev.openapi?.url || '',
                    },
                  }))
                }
                className="hub-input"
                placeholder="your-api-key"
              />
            </div>
          </div>
        </div>
      )}

      {/* HTTP Authentication Configuration */}
      {formData.openapi?.securityType === 'http' && (
        <div className="mb-4 p-4 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800">
          <h4 className="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
            {t('server.openapi.httpAuthConfig')}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                {t('server.openapi.httpScheme')}
              </label>
              <select
                value={formData.openapi?.httpScheme || 'bearer'}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    openapi: {
                      ...prev.openapi,
                      httpScheme: e.target.value as any,
                      url: prev.openapi?.url || '',
                    },
                  }))
                }
                className="hub-input"
              >
                <option value="basic">{t('server.openapi.httpSchemeBasic')}</option>
                <option value="bearer">{t('server.openapi.httpSchemeBearer')}</option>
                <option value="digest">{t('server.openapi.httpSchemeDigest')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                {t('server.openapi.httpCredentials')}
              </label>
              <input
                type="password"
                value={formData.openapi?.httpCredentials || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    openapi: {
                      ...prev.openapi,
                      httpCredentials: e.target.value,
                      url: prev.openapi?.url || '',
                    },
                  }))
                }
                className="hub-input"
                placeholder={
                  formData.openapi?.httpScheme === 'basic'
                    ? 'user:password or base64'
                    : 'bearer-token'
                }
              />
              {formData.openapi?.httpScheme === 'basic' && (
                <p className="ylune-help">{t('server.openapi.httpCredentialsBasicHint')}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OpenID Connect Configuration */}
      {formData.openapi?.securityType === 'openIdConnect' && (
        <div className="mb-4 p-4 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800">
          <h4 className="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
            {t('server.openapi.openIdConnectConfig')}
          </h4>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                {t('server.openapi.openIdConnectUrl')}
              </label>
              <input
                type="url"
                value={formData.openapi?.openIdConnectUrl || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    openapi: {
                      ...prev.openapi,
                      openIdConnectUrl: e.target.value,
                      url: prev.openapi?.url || '',
                    },
                  }))
                }
                className="hub-input"
                placeholder="https://example.com/.well-known/openid_configuration"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                {t('server.openapi.openIdConnectToken')}
              </label>
              <input
                type="password"
                value={formData.openapi?.openIdConnectToken || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    openapi: {
                      ...prev.openapi,
                      openIdConnectToken: e.target.value,
                      url: prev.openapi?.url || '',
                    },
                  }))
                }
                className="hub-input"
                placeholder="id-token"
              />
            </div>
          </div>
        </div>
      )}

      {/* OAuth2 Configuration */}
      {formData.openapi?.securityType === 'oauth2' && (
        <div className="mb-4 p-4 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800">
          <h4 className="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
            {t('server.openapi.oauth2Config')}
          </h4>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                {t('server.oauth.tokenEndpoint')}
              </label>
              <input
                type="url"
                value={formData.openapi?.oauth2TokenUrl || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    openapi: {
                      ...prev.openapi,
                      oauth2TokenUrl: e.target.value,
                      url: prev.openapi?.url || '',
                    },
                  }))
                }
                className="hub-input"
                placeholder="https://example.com/oauth/token"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                {t('server.oauth.clientId')}
              </label>
              <input
                type="text"
                value={formData.openapi?.oauth2ClientId || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    openapi: {
                      ...prev.openapi,
                      oauth2ClientId: e.target.value,
                      url: prev.openapi?.url || '',
                    },
                  }))
                }
                className="hub-input"
                placeholder="client-id"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                {t('server.oauth.clientSecret')}
              </label>
              <input
                type="password"
                value={formData.openapi?.oauth2ClientSecret || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    openapi: {
                      ...prev.openapi,
                      oauth2ClientSecret: e.target.value,
                      url: prev.openapi?.url || '',
                    },
                  }))
                }
                className="hub-input"
                placeholder="client-secret"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                {t('server.openapi.oauth2Token')}
              </label>
              <input
                type="password"
                value={formData.openapi?.oauth2Token || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    openapi: {
                      ...prev.openapi,
                      oauth2Token: e.target.value,
                      url: prev.openapi?.url || '',
                    },
                  }))
                }
                className="hub-input"
                placeholder="access-token"
              />
            </div>
          </div>
        </div>
      )}

      {/* Specification Download Security (#1079) */}
      <div className="mb-4">
        <div className="flex items-center mb-1">
          <input
            type="checkbox"
            id="openapiSpecSecurity"
            checked={(formData.openapi?.specSecurityType || 'none') !== 'none'}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                openapi: {
                  ...prev.openapi,
                  url: prev.openapi?.url || '',
                  specSecurityType: e.target.checked ? 'http' : 'none',
                },
              }))
            }
            className="mr-2"
          />
          <label
            htmlFor="openapiSpecSecurity"
            className="text-gray-700 dark:text-gray-300 text-sm font-medium"
          >
            {t('server.openapi.specSecurityToggle')}
          </label>
        </div>
        <p className="text-xs text-gray-500 ml-6">{t('server.openapi.specSecurityHelp')}</p>
        {(formData.openapi?.specSecurityType || 'none') !== 'none' && (
          <div className="mt-2 ml-6 p-4 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800">
            <div className="mb-3">
              <label className="block text-xs text-gray-600 mb-1">
                {t('server.openapi.security')}
              </label>
              <select
                value={formData.openapi?.specSecurityType || 'http'}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    openapi: {
                      ...prev.openapi,
                      url: prev.openapi?.url || '',
                      specSecurityType: e.target.value as any,
                    },
                  }))
                }
                className="hub-input"
              >
                <option value="http">{t('server.openapi.securityHttp')}</option>
                <option value="apiKey">{t('server.openapi.securityApiKey')}</option>
                <option value="oauth2">{t('server.openapi.securityOAuth2')}</option>
              </select>
            </div>

            {formData.openapi?.specSecurityType === 'http' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    {t('server.openapi.httpScheme')}
                  </label>
                  <select
                    value={formData.openapi?.specHttpScheme || 'basic'}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        openapi: {
                          ...prev.openapi,
                          url: prev.openapi?.url || '',
                          specHttpScheme: e.target.value as any,
                        },
                      }))
                    }
                    className="hub-input"
                  >
                    <option value="basic">{t('server.openapi.httpSchemeBasic')}</option>
                    <option value="bearer">{t('server.openapi.httpSchemeBearer')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    {t('server.openapi.httpCredentials')}
                  </label>
                  <input
                    type="password"
                    value={formData.openapi?.specHttpCredentials || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        openapi: {
                          ...prev.openapi,
                          url: prev.openapi?.url || '',
                          specHttpCredentials: e.target.value,
                        },
                      }))
                    }
                    className="hub-input"
                    placeholder={
                      formData.openapi?.specHttpScheme === 'basic'
                        ? 'user:password or base64'
                        : 'bearer-token'
                    }
                  />
                </div>
              </div>
            )}

            {formData.openapi?.specSecurityType === 'apiKey' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    {t('server.openapi.apiKeyName')}
                  </label>
                  <input
                    type="text"
                    value={formData.openapi?.specApiKeyName || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        openapi: {
                          ...prev.openapi,
                          url: prev.openapi?.url || '',
                          specApiKeyName: e.target.value,
                        },
                      }))
                    }
                    className="hub-input"
                    placeholder="X-API-Key"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    {t('server.openapi.apiKeyIn')}
                  </label>
                  <select
                    value={formData.openapi?.specApiKeyIn || 'header'}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        openapi: {
                          ...prev.openapi,
                          url: prev.openapi?.url || '',
                          specApiKeyIn: e.target.value as any,
                        },
                      }))
                    }
                    className="hub-input"
                  >
                    <option value="header">{t('server.openapi.apiKeyInHeader')}</option>
                    <option value="query">{t('server.openapi.apiKeyInQuery')}</option>
                    <option value="cookie">{t('server.openapi.apiKeyInCookie')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    {t('server.openapi.apiKeyValue')}
                  </label>
                  <input
                    type="password"
                    value={formData.openapi?.specApiKeyValue || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        openapi: {
                          ...prev.openapi,
                          url: prev.openapi?.url || '',
                          specApiKeyValue: e.target.value,
                        },
                      }))
                    }
                    className="hub-input"
                  />
                </div>
              </div>
            )}

            {formData.openapi?.specSecurityType === 'oauth2' && (
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  {t('server.openapi.oauth2Token')}
                </label>
                <input
                  type="password"
                  value={formData.openapi?.specOauth2Token || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      openapi: {
                        ...prev.openapi,
                        url: prev.openapi?.url || '',
                        specOauth2Token: e.target.value,
                      },
                    }))
                  }
                  className="hub-input"
                  placeholder="access-token"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cookie Session Handling */}
      <div className="mb-4">
        <div className="flex items-center mb-1">
          <input
            type="checkbox"
            id="openapiCookieSession"
            checked={formData.openapi?.cookieSession || false}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                openapi: {
                  ...prev.openapi,
                  passthroughHeaders: prev.openapi?.passthroughHeaders || '',
                  url: prev.openapi?.url || '',
                  cookieSession: e.target.checked,
                },
              }))
            }
            className="mr-2"
          />
          <label
            htmlFor="openapiCookieSession"
            className="text-gray-700 dark:text-gray-300 text-sm font-medium"
          >
            {t('server.openapi.cookieSession', 'Cookie Session Handling')}
          </label>
        </div>
        <p className="text-xs text-gray-500 ml-6">
          {t(
            'server.openapi.cookieSessionHelp',
            'Capture Set-Cookie from upstream login responses and replay them on later calls within the same downstream session. Isolated per MCP session; not persisted.',
          )}
        </p>
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <label className="ylune-label">{t('server.headers')}</label>
          <button type="button" onClick={onAddHeaderVar} className="hub-icon-btn">
            +
          </button>
        </div>
        {headerVars.length === 0 && (
          <div className="ylune-kv-empty">{t('server.headersEmpty')}</div>
        )}
        {headerVars.map((headerVar, index) => (
          <div key={index} className="ylune-kv-row">
            <input
              type="text"
              value={headerVar.key}
              onChange={(e) => onHeaderVarChange(index, 'key', e.target.value)}
              className="hub-input"
              placeholder="Authorization"
            />
            <span>:</span>
            <input
              type="text"
              value={headerVar.value}
              onChange={(e) => onHeaderVarChange(index, 'value', e.target.value)}
              className="hub-input"
              placeholder="Bearer token..."
            />
            <button
              type="button"
              onClick={() => onRemoveHeaderVar(index)}
              className="hub-icon-btn sm"
              aria-label="remove"
            >
              -
            </button>
          </div>
        ))}
      </div>
    </>
  );
};

export default OpenApiTransportFields;
