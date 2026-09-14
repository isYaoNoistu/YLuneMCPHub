const mockApiDelete = jest.fn();
const mockApiPost = jest.fn();
const mockApiPut = jest.fn();

jest.mock('../../frontend/src/utils/fetchInterceptor', () => ({
  apiDelete: mockApiDelete,
  apiPost: mockApiPost,
  apiPut: mockApiPut,
}));

import {
  resetToolDescription,
  toggleTool,
  updateToolDescription,
} from '../../frontend/src/services/toolService';
import {
  resetPromptDescription,
  togglePrompt,
  updatePromptDescription,
} from '../../frontend/src/services/promptService';
import {
  resetResourceDescription,
  toggleResource,
  updateResourceDescription,
} from '../../frontend/src/services/resourceService';

const authOptions = {
  headers: {
    Authorization: 'Bearer test-token',
  },
};

describe('capability mutation services', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: jest.fn(() => 'test-token'),
      },
    });
    mockApiDelete.mockResolvedValue({ success: true, data: { description: 'original' } });
    mockApiPost.mockResolvedValue({ success: true });
    mockApiPut.mockResolvedValue({ success: true });
  });

  it('toggles tools with encoded names and explicit authentication', async () => {
    await expect(toggleTool('server/name', 'tool/name', false)).resolves.toEqual({
      success: true,
      error: undefined,
    });
    expect(mockApiPost).toHaveBeenCalledWith(
      '/servers/server%2Fname/tools/tool%2Fname/toggle',
      { enabled: false },
      authOptions,
    );
  });

  it('keeps prompt toggle request shape unchanged', async () => {
    await togglePrompt('server/name', 'prompt/name', true);
    expect(mockApiPost).toHaveBeenCalledWith(
      '/servers/server%2Fname/prompts/prompt%2Fname/toggle',
      { enabled: true },
    );
  });

  it('updates descriptions for all capability kinds', async () => {
    await updateToolDescription('server/name', 'tool/name', 'tool description');
    await updatePromptDescription('server/name', 'prompt/name', 'prompt description');
    await updateResourceDescription('server/name', 'scheme://resource', 'resource description');

    expect(mockApiPut).toHaveBeenNthCalledWith(
      1,
      '/servers/server%2Fname/tools/tool%2Fname/description',
      { description: 'tool description' },
      authOptions,
    );
    expect(mockApiPut).toHaveBeenNthCalledWith(
      2,
      '/servers/server%2Fname/prompts/prompt%2Fname/description',
      { description: 'prompt description' },
      authOptions,
    );
    expect(mockApiPut).toHaveBeenNthCalledWith(
      3,
      '/servers/server%2Fname/resources/scheme%3A%2F%2Fresource/description',
      { description: 'resource description' },
      authOptions,
    );
  });

  it('returns reset descriptions for all capability kinds', async () => {
    await expect(resetToolDescription('server', 'tool')).resolves.toEqual({
      success: true,
      error: undefined,
      description: 'original',
    });
    await expect(resetPromptDescription('server', 'prompt')).resolves.toEqual({
      success: true,
      error: undefined,
      description: 'original',
    });
    await expect(resetResourceDescription('server', 'resource')).resolves.toEqual({
      success: true,
      error: undefined,
      description: 'original',
    });
    expect(mockApiDelete).toHaveBeenCalledTimes(3);
  });

  it('maps API failures and thrown errors to the existing result contract', async () => {
    mockApiPost.mockResolvedValueOnce({ success: false, message: 'disabled' });
    await expect(toggleResource('server', 'resource', false)).resolves.toEqual({
      success: false,
      error: 'disabled',
    });

    mockApiPut.mockRejectedValueOnce(new Error('offline'));
    await expect(updatePromptDescription('server', 'prompt', 'value')).resolves.toEqual({
      success: false,
      error: 'offline',
    });
  });
});
