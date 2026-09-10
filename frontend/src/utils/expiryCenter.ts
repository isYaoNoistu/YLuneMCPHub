import { User } from '@/types';

const DAY_MS = 86_400_000;

export const isExpiredUser = (user: User): boolean => {
  if (user.mcpEnabled === false || !user.tokenExpiresAt) return false;
  if (user.expired) return true;
  const expires = new Date(user.tokenExpiresAt).getTime();
  return !Number.isNaN(expires) && expires <= Date.now();
};

export const isExpiringSoon = (user: User, withinDays = 7): boolean => {
  if (user.mcpEnabled === false || !user.tokenExpiresAt || isExpiredUser(user)) return false;
  const expires = new Date(user.tokenExpiresAt).getTime();
  if (Number.isNaN(expires)) return false;
  const remain = expires - Date.now();
  return remain > 0 && remain <= withinDays * DAY_MS;
};

export const listExpiryAttention = (users: User[], withinDays = 7): User[] =>
  users
    .filter((user) => isExpiredUser(user) || isExpiringSoon(user, withinDays))
    .sort((left, right) => {
      const a = left.tokenExpiresAt ? new Date(left.tokenExpiresAt).getTime() : 0;
      const b = right.tokenExpiresAt ? new Date(right.tokenExpiresAt).getTime() : 0;
      return a - b;
    });
