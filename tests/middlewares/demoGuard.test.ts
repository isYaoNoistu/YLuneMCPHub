import { Request, Response } from 'express';
import { demoGuard } from '../../src/middlewares/demoGuard.js';

const makeRes = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
};

const makeReq = (overrides: Record<string, unknown> = {}) =>
  ({
    method: 'GET',
    path: '/servers',
    user: { username: 'demo', demo: true, isAdmin: false },
    ...overrides,
  }) as unknown as Request;

describe('demoGuard', () => {
  it('lets non-demo users through', () => {
    const next = jest.fn();
    demoGuard(makeReq({ user: { username: 'admin', isAdmin: true } }), makeRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('allows workspace GET for demo accounts', () => {
    const next = jest.fn();
    const res = makeRes();
    demoGuard(makeReq({ path: '/servers' }), res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks writes', () => {
    const next = jest.fn();
    const res = makeRes();
    demoGuard(makeReq({ method: 'POST', path: '/servers' }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('blocks sensitive GET paths', () => {
    const next = jest.fn();
    const res = makeRes();
    demoGuard(makeReq({ path: '/users' }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('blocks OpenAPI-style tool execution GET', () => {
    const next = jest.fn();
    const res = makeRes();
    demoGuard(makeReq({ path: '/tools/jenkins/list_jobs' }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
