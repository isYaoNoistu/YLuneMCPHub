import { NextFunction, Request, Response } from 'express';
import { isDemoUser } from '../utils/userAccount.js';

/**
 * 作用：拦住 Demo 账号的写操作和敏感读取
 * 运行主机：Node 服务进程
 * 调用方：initMiddlewares（认证之后）
 * 大概流程：
 * 1) 非 Demo 直接放行
 * 2) POST/PUT/PATCH/DELETE 一律 403
 * 3) GET 用户、凭据、日志、审计等敏感路径 403
 * 工作区只读接口（服务器列表等）仍可访问，返回已脱敏视图
 */
const SENSITIVE_GET = [
  /^\/users(?:\/|$)/,
  /^\/credentials(?:\/|$)/,
  /^\/credential-/,
  /^\/activities(?:\/|$)/,
  /^\/logs(?:\/|$)/,
  /^\/audit(?:\/|$)/,
  /^\/mcp-settings(?:\/|$)/,
  /^\/oauth\/clients(?:\/|$)/,
  /^\/resource-/,
  /^\/groups(?:\/|$)/,
  /^\/tools(?:\/|$)/,
  /^\/cloud(?:\/|$)/,
  /^\/tool-changes(?:\/|$)/,
  /\/tools\/[^/]+\/[^/]+/,
  /\/share-candidates$/,
  /\/env-preflight$/,
];

export const demoGuard = (req: Request, res: Response, next: NextFunction): void => {
  const user = (req as { user?: { demo?: boolean; isAdmin?: boolean } }).user;
  if (!isDemoUser(user)) {
    next();
    return;
  }

  const method = req.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    res.status(403).json({
      success: false,
      message: 'Demo accounts are view-only',
    });
    return;
  }

  const path = req.path || '';
  if (SENSITIVE_GET.some((pattern) => pattern.test(path))) {
    res.status(403).json({
      success: false,
      message: 'Demo accounts cannot view this resource',
    });
    return;
  }

  next();
};
