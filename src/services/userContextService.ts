import { AsyncLocalStorage } from 'node:async_hooks';
import { EffectiveGroupAccess, IUser } from '../types/index.js';

type UserContextStore = {
  currentUser: IUser | null;
  effectiveAccess?: EffectiveGroupAccess | null;
};

export class UserContextService {
  private static instance: UserContextService;
  private readonly asyncLocalStorage = new AsyncLocalStorage<UserContextStore>();

  private constructor() {}

  static getInstance(): UserContextService {
    if (!UserContextService.instance) {
      UserContextService.instance = new UserContextService();
    }
    return UserContextService.instance;
  }

  getCurrentUser(): IUser | null {
    return this.asyncLocalStorage.getStore()?.currentUser ?? null;
  }

  setCurrentUser(user: IUser): void {
    const store = this.asyncLocalStorage.getStore();
    if (store) {
      store.currentUser = user;
      store.effectiveAccess = null;
      return;
    }

    this.asyncLocalStorage.enterWith({ currentUser: user, effectiveAccess: null });
  }

  getEffectiveAccess(): EffectiveGroupAccess | null {
    return this.asyncLocalStorage.getStore()?.effectiveAccess ?? null;
  }

  setEffectiveAccess(access: EffectiveGroupAccess | null): void {
    const store = this.asyncLocalStorage.getStore();
    if (store) {
      store.effectiveAccess = access;
      return;
    }

    this.asyncLocalStorage.enterWith({
      currentUser: null,
      effectiveAccess: access,
    });
  }

  clearCurrentUser(): void {
    const store = this.asyncLocalStorage.getStore();
    if (store) {
      store.currentUser = null;
      store.effectiveAccess = null;
      return;
    }

    this.asyncLocalStorage.enterWith({ currentUser: null, effectiveAccess: null });
  }

  runWithContext<T>(callback: () => T, initialUser: IUser | null = null): T {
    return this.asyncLocalStorage.run({ currentUser: initialUser, effectiveAccess: null }, callback);
  }

  isAdmin(): boolean {
    const user = this.getCurrentUser();
    return user?.isAdmin || false;
  }

  hasUser(): boolean {
    return this.getCurrentUser() !== null;
  }
}
