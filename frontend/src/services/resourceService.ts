import { createCapabilityMutationClient } from './capabilityMutationClient';

const resourceMutations = createCapabilityMutationClient({
  segment: 'resources',
  label: 'resource',
  idKey: 'resourceUri',
});

/**
 * Toggle a resource's enabled state for a specific server
 */
export const toggleResource = async (
  serverName: string,
  resourceUri: string,
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> =>
  resourceMutations.toggle(serverName, resourceUri, enabled);

/**
 * Update a resource's description for a specific server
 */
export const updateResourceDescription = async (
  serverName: string,
  resourceUri: string,
  description: string,
): Promise<{ success: boolean; error?: string }> =>
  resourceMutations.updateDescription(serverName, resourceUri, description);

export const resetResourceDescription = async (
  serverName: string,
  resourceUri: string,
): Promise<{ success: boolean; error?: string; description?: string }> =>
  resourceMutations.resetDescription(serverName, resourceUri);
