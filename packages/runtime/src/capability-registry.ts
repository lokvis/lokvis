/**
 * Lokvis Capability Registry
 *
 * 能力注册中心。Runtime 永远不知道 FFmpeg，只知道 Capability。
 * Capability 由 Plugin 注册，由 Engine 实现。
 */

import type {
  Capability,
  CapabilityImplementation,
  CapabilityName,
} from '@lokvis/schema';

/** 能力注册表项 */
interface RegistryEntry {
  /** 能力声明 */
  capability: Capability;
  /** 能力实现列表（同一能力可由多个引擎实现） */
  implementations: CapabilityImplementation[];
}

/** 能力注册中心 */
export class CapabilityRegistry {
  private registry = new Map<CapabilityName, RegistryEntry>();

  /** 注册一个能力声明 */
  registerCapability(capability: Capability): void {
    const existing = this.registry.get(capability.name);
    if (existing) {
      throw new Error(`Capability "${capability.name}" is already registered`);
    }
    this.registry.set(capability.name, { capability, implementations: [] });
  }

  /** 注册能力实现 */
  registerImplementation(impl: CapabilityImplementation): void {
    const entry = this.registry.get(impl.capability);
    if (!entry) {
      throw new Error(
        `Cannot register implementation for unknown capability "${impl.capability}". Register the capability first.`
      );
    }
    entry.implementations.push(impl);
  }

  /** 列出所有能力声明 */
  list(): Capability[] {
    return Array.from(this.registry.values()).map((e) => e.capability);
  }

  /** 检查能力是否存在 */
  has(name: CapabilityName): boolean {
    return this.registry.has(name);
  }

  /** 获取能力声明 */
  get(name: CapabilityName): Capability | undefined {
    return this.registry.get(name)?.capability;
  }

  /** 解析能力实现（根据引擎优先级或第一个可用） */
  resolve(name: CapabilityName, preferredEngine?: string): CapabilityImplementation | undefined {
    const entry = this.registry.get(name);
    if (!entry || entry.implementations.length === 0) return undefined;

    if (preferredEngine) {
      const impl = entry.implementations.find((i) => i.engine === preferredEngine);
      if (impl) return impl;
    }

    // 默认返回第一个实现
    return entry.implementations[0];
  }

  /** 清除所有注册 */
  clear(): void {
    this.registry.clear();
  }
}
