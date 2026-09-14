export interface SmartRoutingDraft {
  dbUrl: string;
  basePacingDelayMs: string;
  embeddingProvider: 'openai' | 'azure_openai';
  embeddingEncodingFormat: 'auto' | 'base64' | 'float';
  embeddingDimensions: string;
  llmProviderBaseUrl: string;
  llmProviderApiKey: string;
  embeddingModel: string;
  azureOpenaiEndpoint: string;
  azureOpenaiApiKey: string;
  azureOpenaiApiVersion: string;
  azureOpenaiEmbeddingDeployment: string;
  azureOpenaiEmbeddingModel: string;
  embeddingMaxTokens: string;
}

export interface SavedSmartRoutingConfig {
  dbUrl: string;
  basePacingDelayMs?: number | null;
  embeddingProvider?: 'openai' | 'azure_openai';
  embeddingEncodingFormat?: 'auto' | 'base64' | 'float';
  embeddingDimensions?: number | null;
  llmProviderBaseUrl: string;
  llmProviderApiKey: string;
  embeddingModel: string;
  azureOpenaiEndpoint?: string;
  azureOpenaiApiKey?: string;
  azureOpenaiApiVersion?: string;
  azureOpenaiEmbeddingDeployment?: string;
  azureOpenaiEmbeddingModel?: string;
  embeddingMaxTokens?: number | null;
}

export interface SmartRoutingConfigDiff {
  dbUrl?: string;
  basePacingDelayMs?: number | null;
  embeddingProvider?: 'openai' | 'azure_openai';
  embeddingEncodingFormat?: 'auto' | 'base64' | 'float';
  embeddingDimensions?: number | null;
  llmProviderBaseUrl?: string;
  llmProviderApiKey?: string;
  embeddingModel?: string;
  azureOpenaiEndpoint?: string;
  azureOpenaiApiKey?: string;
  azureOpenaiApiVersion?: string;
  azureOpenaiEmbeddingDeployment?: string;
  azureOpenaiEmbeddingModel?: string;
  embeddingMaxTokens?: number | null;
}

function parseEmbeddingMaxTokensForUpdate(
  rawValue: string,
  currentValue: number | null | undefined,
): number | null | undefined {
  const trimmed = rawValue.trim();
  const parsed = trimmed ? parseInt(trimmed, 10) : NaN;
  const result = trimmed && !isNaN(parsed) ? parsed : null;
  const current = currentValue ?? null;
  return result !== current ? result : undefined;
}

function parseEmbeddingDimensionsForUpdate(
  rawValue: string,
  currentValue: number | null | undefined,
): number | null | undefined {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return currentValue == null ? undefined : null;
  }

  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed !== currentValue ? parsed : undefined;
}

function parseBasePacingDelayForUpdate(
  rawValue: string,
  currentValue: number | null | undefined,
): number | null | undefined {
  const trimmed = rawValue.trim();
  const parsed = trimmed ? parseInt(trimmed, 10) : NaN;
  const result = trimmed && !isNaN(parsed) && parsed >= 0 ? parsed : null;
  const current = currentValue ?? null;
  return result !== current ? result : undefined;
}

export function getSmartRoutingConfigDiff(
  draft: SmartRoutingDraft,
  saved: SavedSmartRoutingConfig,
): SmartRoutingConfigDiff {
  const updates: SmartRoutingConfigDiff = {};

  if (draft.dbUrl !== saved.dbUrl) updates.dbUrl = draft.dbUrl;

  const basePacingDelayMs = parseBasePacingDelayForUpdate(
    draft.basePacingDelayMs,
    saved.basePacingDelayMs,
  );
  if (basePacingDelayMs !== undefined) updates.basePacingDelayMs = basePacingDelayMs;

  if (draft.embeddingProvider !== saved.embeddingProvider) {
    updates.embeddingProvider = draft.embeddingProvider;
  }
  if (draft.embeddingEncodingFormat !== saved.embeddingEncodingFormat) {
    updates.embeddingEncodingFormat = draft.embeddingEncodingFormat;
  }
  if (draft.llmProviderBaseUrl !== saved.llmProviderBaseUrl) {
    updates.llmProviderBaseUrl = draft.llmProviderBaseUrl;
  }
  if (draft.llmProviderApiKey !== saved.llmProviderApiKey) {
    updates.llmProviderApiKey = draft.llmProviderApiKey;
  }
  if (draft.embeddingModel !== saved.embeddingModel) {
    updates.embeddingModel = draft.embeddingModel;
  }
  if (draft.azureOpenaiEndpoint !== saved.azureOpenaiEndpoint) {
    updates.azureOpenaiEndpoint = draft.azureOpenaiEndpoint;
  }
  if (draft.azureOpenaiApiKey !== saved.azureOpenaiApiKey) {
    updates.azureOpenaiApiKey = draft.azureOpenaiApiKey;
  }
  if (draft.azureOpenaiApiVersion !== saved.azureOpenaiApiVersion) {
    updates.azureOpenaiApiVersion = draft.azureOpenaiApiVersion;
  }
  if (draft.azureOpenaiEmbeddingDeployment !== saved.azureOpenaiEmbeddingDeployment) {
    updates.azureOpenaiEmbeddingDeployment = draft.azureOpenaiEmbeddingDeployment;
  }
  if (draft.azureOpenaiEmbeddingModel !== saved.azureOpenaiEmbeddingModel) {
    updates.azureOpenaiEmbeddingModel = draft.azureOpenaiEmbeddingModel;
  }

  const embeddingMaxTokens = parseEmbeddingMaxTokensForUpdate(
    draft.embeddingMaxTokens,
    saved.embeddingMaxTokens,
  );
  if (embeddingMaxTokens !== undefined) updates.embeddingMaxTokens = embeddingMaxTokens;

  const embeddingDimensions = parseEmbeddingDimensionsForUpdate(
    draft.embeddingDimensions,
    saved.embeddingDimensions,
  );
  if (embeddingDimensions !== undefined) updates.embeddingDimensions = embeddingDimensions;

  return updates;
}
