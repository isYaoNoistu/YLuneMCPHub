import type { Dispatch, SetStateAction } from 'react';
import type { ServerFormData } from '@/types';

export type ServerType = 'stdio' | 'sse' | 'streamable-http' | 'openapi';
export type RemoteServerType = Extract<ServerType, 'sse' | 'streamable-http'>;
export type SetServerFormData = Dispatch<SetStateAction<ServerFormData>>;
export type KeyValueField = 'key' | 'value';
