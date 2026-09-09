import { IGroupServerConfig, IUser } from '../types/index.js';
import { getGroupDao, getUserDao } from '../dao/index.js';
import { logger } from '../utils/logger.js';
import { mergeGroupServerConfigs } from './groupAccessService.js';

export const hasExplicitGrants = (user: IUser): boolean => Array.isArray(user.grants);

export const grantsFromGroups = (groups: Parameters<typeof mergeGroupServerConfigs>[0]): IGroupServerConfig[] =>
  [...mergeGroupServerConfigs(groups).values()];

/**
 * One-time copy of group membership into user.grants.
 * Users that already have a grants array (including []) are left alone.
 */
export const migrateUserGrantsFromGroups = async (): Promise<number> => {
  const users = await getUserDao().findAll();
  let updated = 0;

  for (const user of users) {
    if (user.isAdmin || hasExplicitGrants(user)) {
      continue;
    }
    const groups = await getGroupDao().findByMember(user.username);
    const grants = grantsFromGroups(groups);
    await getUserDao().update(user.username, { grants });
    updated += 1;
  }

  if (updated > 0) {
    logger.log(`Copied group membership into user grants for ${updated} user(s)`);
  }

  return updated;
};
