jest.mock('../../frontend/src/utils/fetchInterceptor', () => ({
  apiGet: jest.fn(),
}));

import { apiGet } from '../../frontend/src/utils/fetchInterceptor';
import { getActivityAvailability } from '../../frontend/src/services/activityService';

const mockedApiGet = apiGet as jest.MockedFunction<typeof apiGet>;

describe('activity availability', () => {
  beforeEach(() => {
    mockedApiGet.mockReset();
  });

  it('distinguishes database-disabled from transport failures', async () => {
    mockedApiGet.mockResolvedValueOnce({ data: { available: false } });
    await expect(getActivityAvailability()).resolves.toBe('needs_db');

    mockedApiGet.mockRejectedValueOnce(new Error('network down'));
    await expect(getActivityAvailability()).resolves.toBe('unavailable');
  });

  it('reports an available activity service', async () => {
    mockedApiGet.mockResolvedValueOnce({ data: { available: true } });
    await expect(getActivityAvailability()).resolves.toBe('available');
  });
});
