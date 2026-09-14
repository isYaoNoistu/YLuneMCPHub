import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Server, EnvVar, ServerFormData, OpenApiToolStats } from '@/types';
import { apiGet, apiPost } from '../utils/fetchInterceptor';
import { buildServerPayload } from '../utils/serverFormPayload';
import {
  deselectShareUsers,
  filterShareUsers,
  getSelectableShareUsers,
  selectShareUsers,
} from '../utils/shareUserSelection.js';
import {
  applyDeclaredSecurityPrefill,
  buildOpenApiSecurityNotice,
  type OpenApiSecurityNotice,
} from '../utils/openApiSecurityPrefill';
import {
  getOpenApiSource,
  isOpenApiSourceReady,
  shouldAutoAnalyzeOpenApiSource,
} from '../utils/openApiSourceAnalysis';
import {
  isReservedServerName,
  isValidServerName,
} from '../utils/serverName';
import { BasicInfoFields, ServerTypeFields } from './server-form/CoreFields';
import OpenApiTransportFields from './server-form/OpenApiTransportFields';
import RemoteTransportFields from './server-form/RemoteTransportFields';
import StdioTransportFields from './server-form/StdioTransportFields';
import type { ServerType } from './server-form/types';

interface ServerFormProps {
  onSubmit: (payload: any) => void;
  onCancel: () => void;
  initialData?: Server | null;
  modalTitle: string;
  formError?: string | null;
}

const ServerForm = ({
  onSubmit,
  onCancel,
  initialData = null,
  modalTitle,
  formError = null,
}: ServerFormProps) => {
  const { t } = useTranslation();

  // Native `pattern`/`maxLength` on the name field are enforced on create and
  // on edit of an already-valid name. Editing a legacy (invalid) name without
  // changing it stays allowed, mirroring the backend create/rename-only rule.
  const enforceNamePattern = !initialData?.name || isValidServerName(initialData.name);

  // Determine the initial server type from the initialData
  const getInitialServerType = () => {
    if (!initialData || !initialData.config) return 'stdio';

    if (initialData.config.type) {
      return initialData.config.type; // Use explicit type if available
    } else if (initialData.config.url) {
      return 'sse'; // Fallback to SSE if URL exists
    } else {
      return 'stdio'; // Default to stdio
    }
  };

  const getInitialServerEnvVars = (data: Server | null): EnvVar[] => {
    if (!data || !data.config || !data.config.env) return [];

    return Object.entries(data.config.env).map(([key, value]) => ({
      key,
      value,
      description: '', // You can set a default description if needed
    }));
  };

  const getInitialOAuthConfig = (data: Server | null): ServerFormData['oauth'] => {
    const oauth = data?.config?.oauth;
    return {
      clientId: oauth?.clientId || '',
      clientSecret: oauth?.clientSecret || '',
      scopes: oauth?.scopes ? oauth.scopes.join(' ') : '',
      accessToken: oauth?.accessToken || '',
      refreshToken: oauth?.refreshToken || '',
      authorizationEndpoint: oauth?.authorizationEndpoint || '',
      tokenEndpoint: oauth?.tokenEndpoint || '',
      resource: oauth?.resource || '',
    };
  };

  const [serverType, setServerType] = useState<ServerType>(getInitialServerType());

  const [formData, setFormData] = useState<ServerFormData>({
    name: (initialData && initialData.name) || '',
    description: (initialData && initialData.config && initialData.config.description) || '',
    url: (initialData && initialData.config && initialData.config.url) || '',
    command: (initialData && initialData.config && initialData.config.command) || '',
    arguments:
      initialData && initialData.config && initialData.config.args
        ? Array.isArray(initialData.config.args)
          ? initialData.config.args.join(' ')
          : String(initialData.config.args)
        : '',
    args: (initialData && initialData.config && initialData.config.args) || [],
    type: getInitialServerType(), // Initialize the type field
    env: getInitialServerEnvVars(initialData),
    headers: [],
    passthroughHeaders: initialData?.config?.passthroughHeaders?.join(', ') || '',
    visibility: (initialData?.config?.visibility ?? 'private') as 'private' | 'group' | 'public',
    sharedWithUsers: initialData?.config?.sharedWithUsers || [],
    options: {
      timeout:
        (initialData &&
          initialData.config &&
          initialData.config.options &&
          initialData.config.options.timeout) ||
        60000,
      resetTimeoutOnProgress: initialData?.config?.options?.resetTimeoutOnProgress ?? true,
      maxTotalTimeout:
        (initialData &&
          initialData.config &&
          initialData.config.options &&
          initialData.config.options.maxTotalTimeout) ||
        undefined,
    },
    oauth: getInitialOAuthConfig(initialData),
    // KeepAlive configuration initialization
    keepAlive: {
      enabled: initialData?.config?.enableKeepAlive === true,
      interval: initialData?.config?.keepAliveInterval || 60000,
    },
    // Per-session client isolation initialization
    perSessionClient: initialData?.config?.perSessionClient === true,
    // Proxychains proxy config: round-trip the stored value so editing the
    // server does not silently drop it (there is no in-form editor for it).
    proxy: initialData?.config?.proxy,
    // On-demand spawning initialization
    startOnDemand: initialData?.config?.startOnDemand === true,
    idleTimeoutMs: initialData?.config?.idleTimeoutMs ?? 300000,
    // OpenAPI configuration initialization
    openapi:
      initialData && initialData.config && initialData.config.openapi
        ? {
            url: initialData.config.openapi.url || '',
            schema: initialData.config.openapi.schema
              ? JSON.stringify(initialData.config.openapi.schema, null, 2)
              : '',
            inputMode: initialData.config.openapi.url
              ? 'url'
              : initialData.config.openapi.schema
                ? 'schema'
                : 'url',
            version: initialData.config.openapi.version || '3.1.0',
            securityType: initialData.config.openapi.security?.type || 'none',
            // API Key initialization
            apiKeyName: initialData.config.openapi.security?.apiKey?.name || '',
            apiKeyIn: initialData.config.openapi.security?.apiKey?.in || 'header',
            apiKeyValue: initialData.config.openapi.security?.apiKey?.value || '',
            // HTTP auth initialization
            httpScheme: initialData.config.openapi.security?.http?.scheme || 'bearer',
            httpCredentials: initialData.config.openapi.security?.http?.credentials || '',
            // OAuth2 initialization
            oauth2TokenUrl: initialData.config.openapi.security?.oauth2?.tokenUrl || '',
            oauth2ClientId: initialData.config.openapi.security?.oauth2?.clientId || '',
            oauth2ClientSecret: initialData.config.openapi.security?.oauth2?.clientSecret || '',
            oauth2Token: initialData.config.openapi.security?.oauth2?.token || '',
            // OpenID Connect initialization
            openIdConnectUrl: initialData.config.openapi.security?.openIdConnect?.url || '',
            openIdConnectToken: initialData.config.openapi.security?.openIdConnect?.token || '',
            // Spec-download security initialization (#1079)
            specSecurityType: ['apiKey', 'http', 'oauth2'].includes(
              initialData.config.openapi.specSecurity?.type as string,
            )
              ? (initialData.config.openapi.specSecurity!.type as 'apiKey' | 'http' | 'oauth2')
              : 'none',
            specApiKeyName: initialData.config.openapi.specSecurity?.apiKey?.name || '',
            specApiKeyIn: initialData.config.openapi.specSecurity?.apiKey?.in || 'header',
            specApiKeyValue: initialData.config.openapi.specSecurity?.apiKey?.value || '',
            specHttpScheme:
              initialData.config.openapi.specSecurity?.http?.scheme === 'bearer'
                ? 'bearer'
                : 'basic',
            specHttpCredentials: initialData.config.openapi.specSecurity?.http?.credentials || '',
            specOauth2Token: initialData.config.openapi.specSecurity?.oauth2?.token || '',
            // Passthrough headers initialization
            passthroughHeaders: initialData.config.openapi.passthroughHeaders
              ? initialData.config.openapi.passthroughHeaders.join(', ')
              : '',
            cookieSession: initialData.config.openapi.cookieSession === true,
          }
        : {
            inputMode: 'url',
            url: '',
            schema: '',
            version: '3.1.0',
            securityType: 'none',
            specSecurityType: 'none',
            passthroughHeaders: '',
            cookieSession: false,
          },
  });

  const [shareCandidates, setShareCandidates] = useState<string[]>([]);
  const [shareCandidatesLoading, setShareCandidatesLoading] = useState(false);
  const [shareCandidatesError, setShareCandidatesError] = useState(false);
  const [shareUserSearch, setShareUserSearch] = useState('');

  useEffect(() => {
    if (formData.visibility !== 'group' || !initialData?.name) {
      return;
    }

    let cancelled = false;
    setShareCandidatesLoading(true);
    setShareCandidatesError(false);

    void apiGet<{ success: boolean; data?: string[] }>(
      `/servers/${encodeURIComponent(initialData.name)}/share-candidates`,
    )
      .then((response) => {
        if (cancelled) return;

        if (response.success && Array.isArray(response.data)) {
          setShareCandidates(response.data);
        } else {
          setShareCandidatesError(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setShareCandidatesError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setShareCandidatesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [formData.visibility, initialData?.name]);

  const selectableShareUsers = getSelectableShareUsers(
    formData.sharedWithUsers || [],
    shareCandidates,
  );
  const filteredShareUsers = filterShareUsers(selectableShareUsers, shareUserSearch);
  const selectedShareUsers = new Set(formData.sharedWithUsers || []);
  const allFilteredShareUsersSelected =
    filteredShareUsers.length > 0 &&
    filteredShareUsers.every((username) => selectedShareUsers.has(username));
  const noFilteredShareUsersSelected =
    filteredShareUsers.length === 0 ||
    filteredShareUsers.every((username) => !selectedShareUsers.has(username));

  const toggleSharedUser = (username: string) => {
    setFormData((previous) => {
      const selected = new Set(previous.sharedWithUsers || []);
      if (selected.has(username)) {
        selected.delete(username);
      } else {
        selected.add(username);
      }
      return { ...previous, sharedWithUsers: Array.from(selected) };
    });
  };

  const selectFilteredShareUsers = () => {
    setFormData((previous) => ({
      ...previous,
      sharedWithUsers: selectShareUsers(previous.sharedWithUsers || [], filteredShareUsers),
    }));
  };

  const deselectFilteredShareUsers = () => {
    setFormData((previous) => ({
      ...previous,
      sharedWithUsers: deselectShareUsers(previous.sharedWithUsers || [], filteredShareUsers),
    }));
  };

  const [envVars, setEnvVars] = useState<EnvVar[]>(
    initialData && initialData.config && initialData.config.env
      ? Object.entries(initialData.config.env).map(([key, value]) => ({ key, value }))
      : [],
  );

  const [headerVars, setHeaderVars] = useState<EnvVar[]>(
    initialData && initialData.config && initialData.config.headers
      ? Object.entries(initialData.config.headers).map(([key, value]) => ({ key, value }))
      : [],
  );

  // ── OpenAPI source analysis (#1082, #1093) ────────────────────────────────
  // Analyze a new OpenAPI source while the form is being filled. The result is
  // advisory and is shown inline, so submitting the form does not replace the
  // user's current state with a stale async payload.
  const [openApiStats, setOpenApiStats] = useState<OpenApiToolStats | null>(null);
  const [openApiStatsLoading, setOpenApiStatsLoading] = useState(false);
  const [openApiStatsUnavailable, setOpenApiStatsUnavailable] = useState(false);
  const openApiStatsRequestId = useRef(0);
  const analyzedOpenApiSourceKey = useRef<string | null>(null);
  const automaticSecurityAnalysisDone = useRef(false);
  const openApiSecurityTouched = useRef(Boolean(initialData));
  const openApiFormDataRef = useRef(formData);
  openApiFormDataRef.current = formData;
  const openApiEnvVarsRef = useRef(envVars);
  openApiEnvVarsRef.current = envVars;
  const openApiHeaderVarsRef = useRef(headerVars);
  openApiHeaderVarsRef.current = headerVars;
  const [openApiSecurityNotice, setOpenApiSecurityNotice] = useState<OpenApiSecurityNotice | null>(
    null,
  );
  const [securityDetectionLoading, setSecurityDetectionLoading] = useState(false);

  const [isRequestOptionsExpanded, setIsRequestOptionsExpanded] = useState<boolean>(false);
  const [isOAuthSectionExpanded, setIsOAuthSectionExpanded] = useState<boolean>(false);
  const [isKeepAliveSectionExpanded, setIsKeepAliveSectionExpanded] = useState<boolean>(false);
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!initialData;

  const markOpenApiSecurityTouched = () => {
    openApiSecurityTouched.current = true;
    setOpenApiSecurityNotice(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Transform space-separated arguments string into array
  const handleArgsChange = (value: string) => {
    const args = value.split(' ').filter((arg) => arg.trim() !== '');
    setFormData({ ...formData, arguments: value, args });
  };

  const updateServerType = (type: ServerType) => {
    setServerType(type);
    setFormData((prev) => ({ ...prev, type }));
  };

  const handleEnvVarChange = (index: number, field: 'key' | 'value', value: string) => {
    const newEnvVars = [...envVars];
    newEnvVars[index][field] = value;
    setEnvVars(newEnvVars);
  };

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
  };

  const removeEnvVar = (index: number) => {
    const newEnvVars = [...envVars];
    newEnvVars.splice(index, 1);
    setEnvVars(newEnvVars);
  };

  const handleHeaderVarChange = (index: number, field: 'key' | 'value', value: string) => {
    const newHeaderVars = [...headerVars];
    newHeaderVars[index][field] = value;
    setHeaderVars(newHeaderVars);
  };

  const addHeaderVar = () => {
    setHeaderVars([...headerVars, { key: '', value: '' }]);
  };

  const removeHeaderVar = (index: number) => {
    const newHeaderVars = [...headerVars];
    newHeaderVars.splice(index, 1);
    setHeaderVars(newHeaderVars);
  };

  const handleOAuthChange = <K extends keyof NonNullable<ServerFormData['oauth']>>(
    field: K,
    value: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      oauth: {
        ...(prev.oauth || {}),
        [field]: value,
      },
    }));
  };

  // Handle options changes
  const handleOptionsChange = (
    field: 'timeout' | 'resetTimeoutOnProgress' | 'maxTotalTimeout',
    value: number | boolean | undefined,
  ) => {
    setFormData((prev) => ({
      ...prev,
      options: {
        ...prev.options,
        [field]: value,
      },
    }));
  };

  // Shared probe used by automatic source analysis and the explicit retry
  // button. Returns the preview data (including the declared security scheme)
  // or null when the spec cannot be analyzed.
  const runOpenApiSecurityDetection = async (
    payload: ReturnType<typeof buildServerPayload>,
  ): Promise<OpenApiToolStats | null> => {
    try {
      const response = await apiPost<{ success: boolean; data?: OpenApiToolStats }>(
        '/servers/openapi/tool-stats',
        { config: payload.config },
        { signal: AbortSignal.timeout(60000) },
      );
      return response.success && response.data ? response.data : null;
    } catch {
      // The form remains usable when the advisory request fails.
      return null;
    }
  };

  const analyzeOpenApiSource = async (
    payload: ReturnType<typeof buildServerPayload>,
    sourceKey: string,
    options: { allowSecurityPrefill: boolean; consumeAutomaticAnalysis: boolean },
  ) => {
    const requestId = ++openApiStatsRequestId.current;
    setOpenApiStatsLoading(true);
    setOpenApiStatsUnavailable(false);

    const data = await runOpenApiSecurityDetection(payload);
    if (openApiStatsRequestId.current !== requestId) return;

    if (!data) {
      setOpenApiStatsUnavailable(true);
      setOpenApiStatsLoading(false);
      return;
    }

    analyzedOpenApiSourceKey.current = sourceKey;
    setOpenApiStats(data);

    const latestFormData = openApiFormDataRef.current;
    const securityTouched = openApiSecurityTouched.current;
    const declared = data.declaredSecurity;
    const canPrefillSecurity =
      options.allowSecurityPrefill &&
      !securityTouched &&
      !isEdit &&
      !automaticSecurityAnalysisDone.current;

    if (options.consumeAutomaticAnalysis) {
      automaticSecurityAnalysisDone.current = true;
    }

    const nextFormData =
      declared?.declared && declared.supported && canPrefillSecurity
        ? applyDeclaredSecurityPrefill(latestFormData, declared, securityTouched)
        : latestFormData;

    if (nextFormData !== latestFormData) {
      openApiFormDataRef.current = nextFormData;
      setFormData(nextFormData);
    }

    setOpenApiSecurityNotice(
      buildOpenApiSecurityNotice(latestFormData, declared, {
        includeNotDeclared: true,
        securityTouched,
      }),
    );
    setOpenApiStatsLoading(false);
  };

  // Explicit retry button for cases where automatic analysis failed or the
  // user wants to inspect the current source again.
  const detectOpenApiSecurity = async () => {
    setSecurityDetectionLoading(true);
    try {
      const payload = buildServerPayload({ formData, serverType, envVars, headerVars });
      await analyzeOpenApiSource(payload, getOpenApiSource(formData).key, {
        allowSecurityPrefill: !isEdit && !openApiSecurityTouched.current,
        consumeAutomaticAnalysis: false,
      });
    } catch {
      // Advisory only.
    } finally {
      setSecurityDetectionLoading(false);
    }
  };

  const openApiSource = getOpenApiSource(formData);
  const openApiSourcePresent = serverType === 'openapi' && isOpenApiSourceReady(openApiSource);

  useEffect(() => {
    openApiStatsRequestId.current += 1;
    setOpenApiStats(null);
    setOpenApiStatsUnavailable(false);
    setOpenApiStatsLoading(false);
    setOpenApiSecurityNotice(null);

    if (
      !shouldAutoAnalyzeOpenApiSource({
        isEdit,
        serverType,
        source: openApiSource,
        analyzedSourceKey: analyzedOpenApiSourceKey.current,
      })
    ) {
      return;
    }

    setOpenApiStatsLoading(true);
    const timeoutId = window.setTimeout(() => {
      const payload = buildServerPayload({
        formData: openApiFormDataRef.current,
        serverType,
        envVars: openApiEnvVarsRef.current,
        headerVars: openApiHeaderVarsRef.current,
      });
      void analyzeOpenApiSource(payload, openApiSource.key, {
        allowSecurityPrefill: true,
        consumeAutomaticAnalysis: true,
      });
    }, 600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isEdit, openApiSource.key, serverType]);

  // Submit handler for server configuration
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Server names become part of downstream tool identifiers, so they must
    // satisfy the MCP tool-name charset. Mirror the backend rule: enforce on
    // create and on rename, but let a no-op edit of a legacy (invalid) name
    // through so existing working installations can still be maintained.
    const isNameChanging = !initialData?.name || formData.name !== initialData.name;
    if (isNameChanging && isReservedServerName(formData.name)) {
      setError(t('server.nameReserved'));
      return;
    }
    if (isNameChanging && !isValidServerName(formData.name)) {
      setError(t('server.nameInvalid'));
      return;
    }

    try {
      const payload = buildServerPayload({
        formData,
        serverType,
        envVars,
        headerVars,
      });

      onSubmit(payload);
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="ylune-dialog is-lg">
        <div className="ylune-dialog-head">
        <h2 className="ylune-dialog-title">{modalTitle}</h2>
        <button type="button" onClick={onCancel} className="hub-icon-btn" aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="ylune-dialog-form">
        <div className="ylune-dialog-body">
        {(error || formError) && <div className="ylune-error">{formError || error}</div>}
        {/* ─── Section 1: Basic Info ─── */}
        <BasicInfoFields
          formData={formData}
          enforceNamePattern={enforceNamePattern}
          onInputChange={handleInputChange}
        />

        {/* ─── Section 2: Connection ─── */}
        <div className="mb-5">
          <h3 className="ylune-section">
            {t('server.sectionConnection', 'Connection')}
          </h3>

          <ServerTypeFields serverType={serverType} onServerTypeChange={updateServerType} />

          <div>
            {serverType === 'openapi' ? (
              <OpenApiTransportFields
                formData={formData}
                setFormData={setFormData}
                isEdit={isEdit}
                openApiSourcePresent={openApiSourcePresent}
                openApiStats={openApiStats}
                openApiStatsLoading={openApiStatsLoading}
                openApiStatsUnavailable={openApiStatsUnavailable}
                openApiSecurityNotice={openApiSecurityNotice}
                securityDetectionLoading={securityDetectionLoading}
                headerVars={headerVars}
                onMarkSecurityTouched={markOpenApiSecurityTouched}
                onDetectSecurity={detectOpenApiSecurity}
                onAddHeaderVar={addHeaderVar}
                onHeaderVarChange={handleHeaderVarChange}
                onRemoveHeaderVar={removeHeaderVar}
              />
            ) : serverType === 'sse' || serverType === 'streamable-http' ? (
              <RemoteTransportFields
                serverType={serverType}
                formData={formData}
                headerVars={headerVars}
                envVars={envVars}
                onInputChange={handleInputChange}
                onAddHeaderVar={addHeaderVar}
                onHeaderVarChange={handleHeaderVarChange}
                onRemoveHeaderVar={removeHeaderVar}
                onAddEnvVar={addEnvVar}
                onEnvVarChange={handleEnvVarChange}
                onRemoveEnvVar={removeEnvVar}
              />
            ) : (
              <StdioTransportFields
                formData={formData}
                envVars={envVars}
                onCommandChange={(value) => setFormData({ ...formData, command: value })}
                onArgsChange={handleArgsChange}
                onAddEnvVar={addEnvVar}
                onEnvVarChange={handleEnvVarChange}
                onRemoveEnvVar={removeEnvVar}
              />
            )}
          </div>
        </div>

        <div className={`ylune-fold${isAdvancedExpanded ? ' is-open' : ''}`}>
          <button
            type="button"
            className="ylune-disclosure"
            onClick={() => setIsAdvancedExpanded(!isAdvancedExpanded)}
          >
            <span>{t('server.sectionAdvanced', 'Advanced Options')}</span>
            <span>{isAdvancedExpanded ? '▾' : '▸'}</span>
          </button>

          {isAdvancedExpanded && (
            <div className="ylune-fold-body">
              <div className="ylune-field">
                <label className="ylune-label" htmlFor="visibility">
                  {t('server.visibility', 'Visibility')}
                </label>
                <select
                  id="visibility"
                  name="visibility"
                  value={formData.visibility || 'private'}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      visibility: e.target.value as 'private' | 'group' | 'public',
                    }))
                  }
                  className="hub-input"
                >
                  <option value="private">
                    {t('server.visibilityPrivate', 'Private — only the owner and admins')}
                  </option>
                  <option value="group">
                    {t('server.visibilityGroup', 'Shared — selected users only')}
                  </option>
                  <option value="public">
                    {t('server.visibilityPublic', 'Public — every authenticated user')}
                  </option>
                </select>
                <p className="ylune-help">
                  {t(
                    'server.visibilityDescription',
                    'Controls which non-admin users can discover and call this server. Admins always have access.',
                  )}
                </p>

                {formData.visibility === 'group' && (
                  <div className="ylune-panel">
                    <div className="ylune-panel-title">{t('server.shareWithUsers', 'Share with users')}</div>
                    <p className="ylune-help">
                      {t(
                        'server.shareWithUsersDescription',
                        'Selected users can discover and call this server, but cannot manage its configuration.',
                      )}
                    </p>

                    {!initialData?.name ? (
                      <p className="ylune-help">{t('server.shareAfterCreate', 'Save the server before selecting users.')}</p>
                    ) : (
                      <>
                        {shareCandidatesLoading && (
                          <p className="ylune-help">{t('server.shareCandidatesLoading', 'Loading users...')}</p>
                        )}
                        {shareCandidatesError && (
                          <p className="ylune-error">{t('server.shareCandidatesError', 'Failed to load users.')}</p>
                        )}
                        {!shareCandidatesLoading &&
                          !shareCandidatesError &&
                          selectableShareUsers.length === 0 && (
                            <p className="ylune-help">{t('server.noShareCandidates', 'No other users are available.')}</p>
                          )}
                        {selectableShareUsers.length > 0 && (
                          <>
                            <div className="ylune-field">
                              <label htmlFor="share-user-search" className="ylune-label">
                                {t('server.shareUserSearchLabel', 'Search users')}
                              </label>
                              <input
                                id="share-user-search"
                                type="search"
                                value={shareUserSearch}
                                onChange={(event) => setShareUserSearch(event.target.value)}
                                placeholder={t(
                                  'server.shareUserSearchPlaceholder',
                                  'Search usernames...',
                                )}
                                className="hub-input"
                              />
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={selectFilteredShareUsers}
                                  disabled={allFilteredShareUsersSelected}
                                  className="hub-btn sm"
                                >
                                  {t('server.selectAllShareUsers', 'Select all')}
                                </button>
                                <button
                                  type="button"
                                  onClick={deselectFilteredShareUsers}
                                  disabled={noFilteredShareUsersSelected}
                                  className="hub-btn sm"
                                >
                                  {t('server.deselectAllShareUsers', 'Deselect all')}
                                </button>
                              </div>
                            </div>
                            {filteredShareUsers.length === 0 ? (
                              <p className="ylune-help">
                                {t('server.noMatchingShareUsers', 'No users match your search.')}
                              </p>
                            ) : (
                              <div className="ylune-pair">
                                {filteredShareUsers.map((username) => (
                                  <label key={username} className="ylune-check">
                                    <input
                                      type="checkbox"
                                      checked={selectedShareUsers.has(username)}
                                      onChange={() => toggleSharedUser(username)}
                                    />
                                    <span>{username}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="ylune-field">
                <label className="ylune-label">
                  {t('server.openapi.passthroughHeaders')}
                </label>
                {serverType === 'openapi' ? (
                  <input
                    type="text"
                    value={formData.openapi?.passthroughHeaders || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        openapi: {
                          ...prev.openapi,
                          passthroughHeaders: e.target.value,
                          url: prev.openapi?.url || '',
                        },
                      }))
                    }
                    className="hub-input"
                    placeholder="Authorization, X-API-Key, X-Custom-Header"
                  />
                ) : (
                  <input
                    type="text"
                    value={formData.passthroughHeaders || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        passthroughHeaders: e.target.value,
                      }))
                    }
                    className="hub-input"
                    placeholder="Authorization, X-Custom-User-Id"
                  />
                )}
                <p className="ylune-help">{t('server.openapi.passthroughHeadersHelp')}</p>
              </div>

              {serverType !== 'openapi' && (
                <div className={`ylune-fold${isOAuthSectionExpanded ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="ylune-disclosure"
                    onClick={() => setIsOAuthSectionExpanded(!isOAuthSectionExpanded)}
                  >
                    <span>{t('server.oauth.sectionTitle')}</span>
                    <span>{isOAuthSectionExpanded ? '▾' : '▸'}</span>
                  </button>
                  {isOAuthSectionExpanded && (
                    <div className="ylune-fold-body">
                      <p className="ylune-help">{t('server.oauth.sectionDescription')}</p>
                      <div className="ylune-pair">
                        <div className="ylune-field">
                          <label className="ylune-label">{t('server.oauth.clientId')}</label>
                          <input
                            type="text"
                            value={formData.oauth?.clientId || ''}
                            onChange={(e) => handleOAuthChange('clientId', e.target.value)}
                            className="hub-input"
                            placeholder="client id"
                            autoComplete="off"
                          />
                        </div>
                        <div className="ylune-field">
                          <label className="ylune-label">{t('server.oauth.clientSecret')}</label>
                          <input
                            type="password"
                            value={formData.oauth?.clientSecret || ''}
                            onChange={(e) => handleOAuthChange('clientSecret', e.target.value)}
                            className="hub-input"
                            placeholder="client secret"
                            autoComplete="off"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {serverType !== 'openapi' && (
                <div className={`ylune-fold${isRequestOptionsExpanded ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="ylune-disclosure"
                    onClick={() => setIsRequestOptionsExpanded(!isRequestOptionsExpanded)}
                  >
                    <span>{t('server.requestOptions')}</span>
                    <span>{isRequestOptionsExpanded ? '▾' : '▸'}</span>
                  </button>
                  {isRequestOptionsExpanded && (
                    <div className="ylune-fold-body">
                      <div className="ylune-pair">
                        <div className="ylune-field">
                          <label className="ylune-label" htmlFor="timeout">
                            {t('server.timeout')}
                          </label>
                          <input
                            type="number"
                            id="timeout"
                            value={formData.options?.timeout || 60000}
                            onChange={(e) =>
                              handleOptionsChange('timeout', parseInt(e.target.value) || 60000)
                            }
                            className="hub-input"
                            placeholder="30000"
                            min="1000"
                            max="300000"
                          />
                          <p className="ylune-help">{t('server.timeoutDescription')}</p>
                        </div>
                        <div className="ylune-field">
                          <label className="ylune-label" htmlFor="maxTotalTimeout">
                            {t('server.maxTotalTimeout')}
                          </label>
                          <input
                            type="number"
                            id="maxTotalTimeout"
                            value={formData.options?.maxTotalTimeout || ''}
                            onChange={(e) =>
                              handleOptionsChange(
                                'maxTotalTimeout',
                                e.target.value ? parseInt(e.target.value) : undefined,
                              )
                            }
                            className="hub-input"
                            placeholder="Optional"
                            min="1000"
                          />
                          <p className="ylune-help">{t('server.maxTotalTimeoutDescription')}</p>
                        </div>
                      </div>
                      <div className="ylune-check-block">
                        <input
                          type="checkbox"
                          id="resetTimeoutOnProgress"
                          checked={formData.options?.resetTimeoutOnProgress ?? true}
                          onChange={(e) =>
                            handleOptionsChange('resetTimeoutOnProgress', e.target.checked)
                          }
                        />
                        <label htmlFor="resetTimeoutOnProgress">
                          {t('server.resetTimeoutOnProgress')}
                        </label>
                        <p className="ylune-help">{t('server.resetTimeoutOnProgressDescription')}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(serverType === 'sse' || serverType === 'streamable-http') && (
                <div className={`ylune-fold${isKeepAliveSectionExpanded ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="ylune-disclosure"
                    onClick={() => setIsKeepAliveSectionExpanded(!isKeepAliveSectionExpanded)}
                  >
                    <span>{t('server.keepAlive', 'Connection Health')}</span>
                    <span>{isKeepAliveSectionExpanded ? '▾' : '▸'}</span>
                  </button>
                  {isKeepAliveSectionExpanded && (
                    <div className="ylune-fold-body">
                      <div className="ylune-check-block">
                        <input
                          type="checkbox"
                          id="enableKeepAlive"
                          checked={formData.keepAlive?.enabled || false}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              keepAlive: {
                                ...prev.keepAlive,
                                enabled: e.target.checked,
                              },
                            }))
                          }
                        />
                        <label htmlFor="enableKeepAlive">
                          {t('server.enableKeepAlive', 'Enable Health Checks and Auto Reconnect')}
                        </label>
                        <p className="ylune-help">
                          {t(
                            'server.keepAliveDescription',
                            'Run periodic health checks and automatically reconnect this remote server when it becomes disconnected.',
                          )}
                        </p>
                      </div>
                      <div className="ylune-field">
                        <label className="ylune-label" htmlFor="keepAliveInterval">
                          {t('server.keepAliveInterval', 'Check interval (ms)')}
                        </label>
                        <input
                          type="number"
                          id="keepAliveInterval"
                          value={formData.keepAlive?.interval || 60000}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              keepAlive: {
                                ...prev.keepAlive,
                                interval: parseInt(e.target.value) || 60000,
                              },
                            }))
                          }
                          className="hub-input"
                          placeholder="60000"
                          min="5000"
                          max="300000"
                        />
                        <p className="ylune-help">
                          {t(
                            'server.keepAliveIntervalDescription',
                            'Time between health checks and automatic reconnect attempts in milliseconds (default: 60000ms = 1 minute)',
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {serverType !== 'openapi' && (
                <div className="ylune-panel">
                  <div className="ylune-panel-title">{t('server.runtimeOptions', '运行方式')}</div>
                  <div className="ylune-checks">
                    <div className="ylune-check-block">
                      <input
                        type="checkbox"
                        id="perSessionClient"
                        checked={formData.perSessionClient || false}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            perSessionClient: e.target.checked,
                          }))
                        }
                      />
                      <label htmlFor="perSessionClient">
                        {t('server.perSessionClient', 'Per-Session Client Isolation')}
                      </label>
                      <p className="ylune-help">
                        {t(
                          'server.perSessionClientDescription',
                          'Create a dedicated upstream connection per session instead of sharing one across all sessions. Enable for stateful servers like Playwright. Increases upstream connections with concurrent sessions.',
                        )}
                      </p>
                    </div>
                    {serverType === 'stdio' && (
                      <div className="ylune-check-block">
                        <input
                          type="checkbox"
                          id="startOnDemand"
                          checked={formData.startOnDemand || false}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              startOnDemand: e.target.checked,
                            }))
                          }
                        />
                        <label htmlFor="startOnDemand">
                          {t('server.startOnDemand', 'Start On Demand')}
                        </label>
                        <p className="ylune-help">
                          {t(
                            'server.startOnDemandDescription',
                            'Skip startup connect and spawn this server only when a tool call arrives. The process is shut down automatically after the idle timeout, then restarted on the next call. Reduces persistent memory usage for rarely-used servers.',
                          )}
                        </p>
                        {formData.startOnDemand && (
                          <div className="ylune-field">
                            <label className="ylune-label" htmlFor="idleTimeoutMs">
                              {t('server.idleTimeoutMs', 'Idle shutdown timeout (ms)')}
                            </label>
                            <input
                              type="number"
                              id="idleTimeoutMs"
                              min={10000}
                              step={1000}
                              value={formData.idleTimeoutMs ?? 300000}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  idleTimeoutMs: Number(e.target.value),
                                }))
                              }
                              className="hub-input"
                            />
                            <p className="ylune-help">
                              {t(
                                'server.idleTimeoutMsDescription',
                                'Shut down the process after this many milliseconds with no tool calls. Default: 300000 (5 minutes).',
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        </div>
        <div className="ylune-dialog-foot">
          <button type="button" onClick={onCancel} className="hub-btn">
            {t('server.cancel')}
          </button>
          <button type="submit" className="hub-btn primary">
            {isEdit ? t('server.save') : t('server.add')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ServerForm;
