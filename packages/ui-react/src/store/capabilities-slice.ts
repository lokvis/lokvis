/**
 * Capabilities slice —— 能力列表与映射
 */
import type { StateCreator } from 'zustand';
import type { CapabilityMap } from '../types.js';
import type { WorkspaceStore, WorkspaceState, WorkspaceActions } from './types.js';

export interface CapabilitiesSlice
  extends Pick<WorkspaceState, 'capabilities' | 'capabilityMap' | 'stubCapabilities'>,
    Pick<WorkspaceActions, 'refreshCapabilities'> {}

export const createCapabilitiesSlice: StateCreator<
  WorkspaceStore,
  [],
  [],
  CapabilitiesSlice
> = (set, get) => ({
  capabilities: [],
  capabilityMap: {},
  stubCapabilities: new Set<string>(),

  async refreshCapabilities() {
    const { runtime } = get();
    if (!runtime) return;
    const capabilities = await runtime.capabilities();
    const capabilityMap: CapabilityMap = {};
    for (const cap of capabilities) capabilityMap[cap.name] = cap;
    // A7: 探测 stub-only 能力,供 UI 显示 "Coming Soon" 标记
    const stubCapabilities = new Set<string>();
    await Promise.all(
      capabilities.map(async (cap) => {
        if (await runtime.isStubOnly(cap.name)) stubCapabilities.add(cap.name);
      })
    );
    set({ capabilities, capabilityMap, stubCapabilities });
  },
});
