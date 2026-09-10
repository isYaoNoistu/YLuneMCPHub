/**
 * 作用：登录入口的输入上限、用户名整理，以及未知用户的占位密码哈希
 * 运行主机：Node 服务进程（控制台 /auth/login）
 * 调用方：authController.login、authAccountRateLimiter
 * 大概流程：
 * 1) 限制用户名 / 密码长度，避免超长口令拖垮 bcrypt
 * 2) 未知用户仍对占位哈希做 compare，缩小“用户是否存在”的耗时差异
 */

export const LOGIN_USERNAME_MAX = 128;
export const LOGIN_PASSWORD_MAX = 128;

/** bcrypt hash of a throwaway string; never a real user password. */
export const DUMMY_PASSWORD_HASH =
  '$2b$10$IvNvuElyGBl6uNYZRGUoie1xGdqUMcXJpw1sy7Q03ahYhCgjAgH66';

export const normalizeLoginUsername = (value: string): string => value.trim();

export const loginRateLimitIdentity = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase().slice(0, LOGIN_USERNAME_MAX);
};
