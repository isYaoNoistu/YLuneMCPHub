import {
  getSmartRoutingConfigDiff,
  type SavedSmartRoutingConfig,
  type SmartRoutingDraft,
} from '../../frontend/src/components/settings/settingsDiff';

const savedConfig: SavedSmartRoutingConfig = {
  dbUrl: 'postgres://localhost/mcphub',
  basePacingDelayMs: 1000,
  embeddingProvider: 'openai',
  embeddingEncodingFormat: 'auto',
  embeddingDimensions: 1536,
  llmProviderBaseUrl: 'https://api.openai.com/v1',
  llmProviderApiKey: 'secret',
  embeddingModel: 'text-embedding-3-small',
  azureOpenaiEndpoint: '',
  azureOpenaiApiKey: '',
  azureOpenaiApiVersion: '2024-02-15-preview',
  azureOpenaiEmbeddingDeployment: '',
  azureOpenaiEmbeddingModel: '',
  embeddingMaxTokens: 8191,
};

const draft: SmartRoutingDraft = {
  dbUrl: 'postgres://localhost/mcphub',
  basePacingDelayMs: '1000',
  embeddingProvider: 'openai',
  embeddingEncodingFormat: 'auto',
  embeddingDimensions: '1536',
  llmProviderBaseUrl: 'https://api.openai.com/v1',
  llmProviderApiKey: 'secret',
  embeddingModel: 'text-embedding-3-small',
  azureOpenaiEndpoint: '',
  azureOpenaiApiKey: '',
  azureOpenaiApiVersion: '2024-02-15-preview',
  azureOpenaiEmbeddingDeployment: '',
  azureOpenaiEmbeddingModel: '',
  embeddingMaxTokens: '8191',
};

describe('getSmartRoutingConfigDiff', () => {
  it('omits fields whose draft values match the saved config', () => {
    expect(getSmartRoutingConfigDiff(draft, savedConfig)).toEqual({});
  });

  it('returns only changed string and provider fields', () => {
    expect(
      getSmartRoutingConfigDiff(
        {
          ...draft,
          dbUrl: 'postgres://db.example/mcphub',
          embeddingProvider: 'azure_openai',
          embeddingEncodingFormat: 'base64',
          azureOpenaiEndpoint: 'https://example.openai.azure.com',
        },
        savedConfig,
      ),
    ).toEqual({
      dbUrl: 'postgres://db.example/mcphub',
      embeddingProvider: 'azure_openai',
      embeddingEncodingFormat: 'base64',
      azureOpenaiEndpoint: 'https://example.openai.azure.com',
    });
  });

  it('preserves the existing numeric parsing and clear semantics', () => {
    expect(
      getSmartRoutingConfigDiff(
        {
          ...draft,
          basePacingDelayMs: '2500ms',
          embeddingDimensions: '',
          embeddingMaxTokens: '4096 tokens',
        },
        savedConfig,
      ),
    ).toEqual({
      basePacingDelayMs: 2500,
      embeddingDimensions: null,
      embeddingMaxTokens: 4096,
    });
  });

  it('omits empty optional numeric fields when the saved values are unset', () => {
    expect(
      getSmartRoutingConfigDiff(
        {
          ...draft,
          basePacingDelayMs: '',
          embeddingDimensions: '',
          embeddingMaxTokens: '',
        },
        {
          ...savedConfig,
          basePacingDelayMs: undefined,
          embeddingDimensions: undefined,
          embeddingMaxTokens: undefined,
        },
      ),
    ).toEqual({});
  });

  it('treats invalid numeric drafts exactly like the current save handlers', () => {
    expect(
      getSmartRoutingConfigDiff(
        {
          ...draft,
          basePacingDelayMs: '-1',
          embeddingDimensions: '1.5',
          embeddingMaxTokens: 'invalid',
        },
        savedConfig,
      ),
    ).toEqual({
      basePacingDelayMs: null,
      embeddingMaxTokens: null,
    });
  });
});
