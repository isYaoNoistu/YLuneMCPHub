import { VectorEmbedding } from './VectorEmbedding.js';
import User from './User.js';
import Server from './Server.js';
import Group from './Group.js';
import SystemConfig from './SystemConfig.js';
import UserConfig from './UserConfig.js';
import OAuthClient from './OAuthClient.js';
import OAuthToken from './OAuthToken.js';
import BearerKey from './BearerKey.js';
import Activity from './Activity.js';
import BuiltinPrompt from './BuiltinPrompt.js';
import BuiltinResource from './BuiltinResource.js';
import Credential from './Credential.js';
import ResourceTarget from './ResourceTarget.js';
import ResourceGroup from './ResourceGroup.js';
import ResourceGroupItem from './ResourceGroupItem.js';
import UserResourceGroup from './UserResourceGroup.js';
import AdminAuditLog from './AdminAuditLog.js';
import ToolInventoryBaseline from './ToolInventoryBaseline.js';

// Export all entities
export default [
  VectorEmbedding,
  User,
  Server,
  Group,
  SystemConfig,
  UserConfig,
  OAuthClient,
  OAuthToken,
  BearerKey,
  Activity,
  BuiltinPrompt,
  BuiltinResource,
  Credential,
  ResourceTarget,
  ResourceGroup,
  ResourceGroupItem,
  UserResourceGroup,
  AdminAuditLog,
  ToolInventoryBaseline,
];

// Export individual entities for direct use
export {
  VectorEmbedding,
  User,
  Server,
  Group,
  SystemConfig,
  UserConfig,
  OAuthClient,
  OAuthToken,
  BearerKey,
  Activity,
  BuiltinPrompt,
  BuiltinResource,
  Credential,
  ResourceTarget,
  ResourceGroup,
  ResourceGroupItem,
  UserResourceGroup,
  AdminAuditLog,
  ToolInventoryBaseline,
};
