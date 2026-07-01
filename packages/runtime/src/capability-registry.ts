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
  EngineSelectionStrategy,
  PerformanceLevel,
} from '@lokvis/schema';

/** 能力注册表项 */
interface RegistryEntry {
  /** 能力声明 */
  capability: Capability;
  /** 能力实现列表（同一能力可由多个引擎实现） */
  implementations: CapabilityImplementation[];
}

/** 性能等级排序权重(数值越小越快) */
const PERFORMANCE_RANK: Record<PerformanceLevel, number> = {
  fast: 0,
  medium: 1,
  slow: 2,
};

/** 能力注册中心 */
export class CapabilityRegistry {
  private registry = new Map<CapabilityName, RegistryEntry>();
  private readonly defaultStrategy: EngineSelectionStrategy;

  constructor(defaultStrategy: EngineSelectionStrategy = 'first') {
    this.defaultStrategy = defaultStrategy;
  }

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

  /**
   * 解析能力实现。
   * - 若指定 preferredEngine 且存在匹配实现,直接返回;
   * - 否则按构造时设定的 defaultStrategy 选择('first'/'fastest'/'balanced')。
   */
  resolve(name: CapabilityName, preferredEngine?: string): CapabilityImplementation | undefined {
    const entry = this.registry.get(name);
    if (!entry || entry.implementations.length === 0) return undefined;

    if (preferredEngine) {
      const impl = entry.implementations.find((i) => i.engine === preferredEngine);
      if (impl) return impl;
    }

    return this.selectByStrategy(entry.implementations, entry.capability);
  }

  /** 按默认策略从实现列表中选择一个 */
  private selectByStrategy(
    impls: CapabilityImplementation[],
    capability: Capability
  ): CapabilityImplementation {
    switch (this.defaultStrategy) {
      case 'first':
        return impls[0]!;
      case 'fastest':
        return this.fastest(impls, capability);
      case 'balanced': {
        // 优先取与能力声明 performance 匹配的实现(同档按注册顺序)
        const target = capability.performance;
        const matching = impls.filter((i) => this.perfOf(i, capability) === target);
        if (matching.length > 0) return matching[0]!;
        // 无匹配则退化为最快
        return this.fastest(impls, capability);
      }
    }
  }

  /** 取性能等级最优的实现(同档按注册顺序,稳定排序) */
  private fastest(
    impls: CapabilityImplementation[],
    capability: Capability
  ): CapabilityImplementation {
    return impls.reduce((best, cur) => {
      const a = PERFORMANCE_RANK[this.perfOf(best, capability)];
      const b = PERFORMANCE_RANK[this.perfOf(cur, capability)];
      // 仅当严格更优时替换,保证同档保留先注册的(稳定性)
      return b < a ? cur : best;
    }, impls[0]!);
  }

  /** 实现的性能等级:优先用实现自身声明,缺省回退到能力声明 */
  private perfOf(impl: CapabilityImplementation, capability: Capability): PerformanceLevel {
    return impl.performance ?? capability.performance;
  }

  /** 清除所有注册 */
  clear(): void {
    this.registry.clear();
  }
}
