import { randomUUID } from 'node:crypto';
import { openCredentialFields } from './credentialService.js';
import { getCredentialDao } from '../dao/DaoFactory.js';
import { ICredential, IResourceTarget } from '../types/index.js';

export const RUNTIME_TOKEN_ENV = 'YLUNE_RUNTIME_TOKEN';
export const LEASE_TTL_MS = 45_000;

export interface CredentialLease {
  id: string;
  username: string;
  serverName: string;
  targetId: string;
  targetName: string;
  credentialId: string;
  credentialName: string;
  credentialVersion: number;
  resourceGroupId?: string;
  resourceGroupName?: string;
  expiresAt: number;
  consumed: boolean;
}

export interface ResolvedLease {
  leaseId: string;
  target: IResourceTarget | null;
  credential: {
    id: string;
    name: string;
    keyVersion: number;
    fields: Record<string, string>;
  };
}

const leases = new Map<string, CredentialLease>();

export const clearCredentialLeases = (): void => {
  leases.clear();
};

const purgeExpired = (now = Date.now()): void => {
  for (const [id, lease] of leases) {
    if (lease.consumed || lease.expiresAt <= now) {
      leases.delete(id);
    }
  }
};

export const hasRuntimeToken = (): boolean => Boolean(process.env[RUNTIME_TOKEN_ENV]?.trim());

export const isValidRuntimeToken = (header?: string): boolean => {
  const expected = process.env[RUNTIME_TOKEN_ENV]?.trim();
  if (!expected || !header) {
    return false;
  }
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim();
  return token === expected;
};

export const createCredentialLease = (input: {
  username: string;
  serverName: string;
  targetId: string;
  targetName: string;
  credentialId: string;
  credentialName: string;
  credentialVersion: number;
  resourceGroupId?: string;
  resourceGroupName?: string;
  ttlMs?: number;
}): CredentialLease => {
  purgeExpired();
  const lease: CredentialLease = {
    id: randomUUID(),
    username: input.username,
    serverName: input.serverName,
    targetId: input.targetId,
    targetName: input.targetName,
    credentialId: input.credentialId,
    credentialName: input.credentialName,
    credentialVersion: input.credentialVersion,
    resourceGroupId: input.resourceGroupId,
    resourceGroupName: input.resourceGroupName,
    expiresAt: Date.now() + (input.ttlMs ?? LEASE_TTL_MS),
    consumed: false,
  };
  leases.set(lease.id, lease);
  return lease;
};

export const peekCredentialLease = (id: string): CredentialLease | null => {
  purgeExpired();
  return leases.get(id) ?? null;
};

export const resolveCredentialLease = async (
  id: string,
  target: IResourceTarget | null,
  credential: ICredential | null,
): Promise<ResolvedLease> => {
  purgeExpired();
  const lease = leases.get(id);
  if (!lease || lease.consumed || lease.expiresAt <= Date.now()) {
    throw new Error('Lease not found or expired');
  }
  if (lease.targetId) {
    if (!target || target.id !== lease.targetId) {
      throw new Error('Lease target is no longer available');
    }
  }
  if (!credential || credential.id !== lease.credentialId) {
    throw new Error('Lease credential is no longer available');
  }
  const fields = openCredentialFields(credential);
  lease.consumed = true;
  leases.delete(id);
  return {
    leaseId: lease.id,
    target: lease.targetId ? target : null,
    credential: {
      id: credential.id,
      name: credential.name,
      keyVersion: credential.keyVersion,
      fields,
    },
  };
};

export const loadCredentialForLease = async (id: string): Promise<ICredential | null> => {
  const dao = getCredentialDao();
  if (!dao) {
    return null;
  }
  return dao.findById(id);
};
