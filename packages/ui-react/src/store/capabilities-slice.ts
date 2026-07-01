/**
 * Capabilities slice —— 能力列表与映射
 */
import type { StateCreator } from 'zustand';
import type { CapabilityMap } from '../types.js';
import type { WorkspaceStore, WorkspaceState, WorkspaceActions } from './types.js';

export interface CapabilitiesSlice
  extends Pick<WorkspaceState, 'capabilities' | 'capabilityMap'>,
    Pick<WorkspaceActions, 'refreshCapabilities'> {}

export const createCapabilitiesSlice: StateCreator<
  WorkspaceStore,
  [],
  [],
  CapabilitiesSlice
> = (set, get) => ({
  capabilities: [],
  capabilityMap: {},

  async refreshCapabilities() {
    const { runtime } = get();
    if (!runtime) return;
    const capabilities = await runtime.capabilities();
    const capabilityMap: CapabilityMap = {};
    for (const cap of capabilities) capabilityMap[cap.name] = cap;
    set({ capabilities, capabilityMap });
  },
});
