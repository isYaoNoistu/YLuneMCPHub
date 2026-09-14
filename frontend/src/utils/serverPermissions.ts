type ServerLike = {
  owner?: string;
  name?: string;
  enabled?: boolean;
  builtin?: boolean;
};

type UserLike = {
  username: string;
  isAdmin?: boolean;
} | null | undefined;

export const canManageServer = (server: ServerLike, user: UserLike): boolean => {
  if (!user) {
    return false;
  }

  if (user.isAdmin) {
    return true;
  }

  return Boolean(server.owner && server.owner === user.username);
};

export const isGrantableServer = (server: ServerLike): boolean => {
  if (server.enabled === false) {
    return false;
  }
  if (server.builtin) {
    return false;
  }
  if (typeof server.name === 'string' && server.name.trim().toLowerCase() === 'ylune') {
    return false;
  }
  return true;
};
