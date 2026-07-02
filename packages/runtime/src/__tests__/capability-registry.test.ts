/**
 * CapabilityRegistry 单元测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { CapabilityRegistry } from '../capability-registry.js';
import type {
  Capability,
  CapabilityImplementation,
} from '@lokvis/schema';

const resizeCap: Capability = {
  name: 'image.resize',
  description: 'Resize image',
  inputTypes: ['image'],
  outputTypes: ['image'],
  params: [{ name: 'width', type: 'number', required: true }],
  performance: 'fast',
  batchable: true,
};

const resizeImplCanvas: CapabilityImplementation = {
  capability: 'image.resize',
  engine: 'canvas',
  execute: async () => [],
};

const resizeImplSquoosh: CapabilityImplementation = {
  capability: 'image.resize',
  engine: 'squoosh',
  execute: async () => [],
};

describe('CapabilityRegistry', () => {
  let registry: CapabilityRegistry;

  beforeEach(() => {
    registry = new CapabilityRegistry();
  });

  describe('registerCapability', () => {
    it('应注册能力声明', () => {
      registry.registerCapability(resizeCap);
      expect(registry.has('image.resize')).toBe(true);
    });

    it('重复注册同名能力应抛错', () => {
      registry.registerCapability(resizeCap);
      expect(() => registry.registerCapability(resizeCap)).toThrow(
        /already registered/
      );
    });
  });

  describe('registerImplementation', () => {
    it('应注册能力实现', () => {
      registry.registerCapability(resizeCap);
      registry.registerImplementation(resizeImplCanvas);

      const impl = registry.resolve('image.resize');
      expect(impl).toBeDefined();
      expect(impl!.engine).toBe('canvas');
    });

    it('未注册能力声明时注册实现应抛错', () => {
      expect(() => registry.registerImplementation(resizeImplCanvas)).toThrow(
        /unknown capability/
      );
    });

    it('同一能力可注册多个引擎实现', () => {
      registry.registerCapability(resizeCap);
      registry.registerImplementation(resizeImplCanvas);
      registry.registerImplementation(resizeImplSquoosh);

      expect(registry.resolve('image.resize', 'canvas')!.engine).toBe('canvas');
      expect(registry.resolve('image.resize', 'squoosh')!.engine).toBe('squoosh');
    });
  });

  describe('resolve', () => {
    it('未注册能力应返回 undefined', () => {
      expect(registry.resolve('image.resize')).toBeUndefined();
    });

    it('已注册声明但无实现应返回 undefined', () => {
      registry.registerCapability(resizeCap);
      expect(registry.resolve('image.resize')).toBeUndefined();
    });

    it('未指定 preferredEngine 应返回第一个实现', () => {
      registry.registerCapability(resizeCap);
      registry.registerImplementation(resizeImplCanvas);
      registry.registerImplementation(resizeImplSquoosh);

      expect(registry.resolve('image.resize')!.engine).toBe('canvas');
    });

    it('指定的 preferredEngine 不存在应回退到第一个实现', () => {
      registry.registerCapability(resizeCap);
      registry.registerImplementation(resizeImplCanvas);

      expect(registry.resolve('image.resize', 'nonexistent')!.engine).toBe(
        'canvas'
      );
    });
  });

  describe('list', () => {
    it('应返回所有已注册能力声明', () => {
      registry.registerCapability(resizeCap);
      registry.registerCapability({
        ...resizeCap,
        name: 'image.compress',
      });

      const list = registry.list();
      expect(list).toHaveLength(2);
      expect(list.map((c) => c.name).sort()).toEqual([
        'image.compress',
        'image.resize',
      ]);
    });

    it('空注册表应返回空数组', () => {
      expect(registry.list()).toEqual([]);
    });
  });

  describe('get / has', () => {
    it('get() 应返回能力声明', () => {
      registry.registerCapability(resizeCap);
      expect(registry.get('image.resize')).toBe(resizeCap);
    });

    it('get() 未注册应返回 undefined', () => {
      expect(registry.get('image.resize')).toBeUndefined();
    });

    it('has() 未注册应返回 false', () => {
      expect(registry.has('image.resize')).toBe(false);
    });
  });

  describe('clear', () => {
    it('应清除所有注册', () => {
      registry.registerCapability(resizeCap);
      registry.registerImplementation(resizeImplCanvas);
      registry.clear();

      expect(registry.has('image.resize')).toBe(false);
      expect(registry.list()).toEqual([]);
    });
  });

  describe('stub 状态过滤', () => {
    const stubImpl: CapabilityImplementation = {
      capability: 'image.resize',
      engine: 'ffmpeg-wasm',
      status: 'stub',
      execute: async () => [],
    };
    const stableImpl: CapabilityImplementation = {
      capability: 'image.resize',
      engine: 'canvas',
      status: 'stable',
      execute: async () => [],
    };

    it('resolve() 应跳过 status=stub 的实现', () => {
      registry.registerCapability(resizeCap);
      registry.registerImplementation(stubImpl);
      registry.registerImplementation(stableImpl);

      const impl = registry.resolve('image.resize');
      expect(impl).toBeDefined();
      expect(impl!.engine).toBe('canvas');
    });

    it('仅有 stub 实现时 resolve() 应返回 undefined', () => {
      registry.registerCapability(resizeCap);
      registry.registerImplementation(stubImpl);

      expect(registry.resolve('image.resize')).toBeUndefined();
    });

    it('isStubOnly() 应检测仅有 stub 实现的能力', () => {
      registry.registerCapability(resizeCap);
      registry.registerImplementation(stubImpl);

      expect(registry.isStubOnly('image.resize')).toBe(true);
    });

    it('isStubOnly() 有 stable 实现时应返回 false', () => {
      registry.registerCapability(resizeCap);
      registry.registerImplementation(stubImpl);
      registry.registerImplementation(stableImpl);

      expect(registry.isStubOnly('image.resize')).toBe(false);
    });

    it('isStubOnly() 未注册的能力应返回 false', () => {
      expect(registry.isStubOnly('image.resize')).toBe(false);
    });

    it('hasImplementation() 应区分 stub 和 stable', () => {
      registry.registerCapability(resizeCap);
      registry.registerImplementation(stubImpl);

      expect(registry.hasImplementation('image.resize')).toBe(false);

      registry.registerImplementation(stableImpl);
      expect(registry.hasImplementation('image.resize')).toBe(true);
    });

    it('preferredEngine 也应跳过 stub', () => {
      registry.registerCapability(resizeCap);
      registry.registerImplementation(stubImpl);

      expect(registry.resolve('image.resize', 'ffmpeg-wasm')).toBeUndefined();
    });
  });
});

describe('CapabilityRegistry 引擎选择策略(O2)', () => {
  /** capability 声明为 medium,实现各有不同 perf */
  const capMedium: Capability = {
    name: 'image.resize',
    description: 'Resize',
    inputTypes: ['image'],
    outputTypes: ['image'],
    params: [],
    performance: 'medium',
  };
  /** canvas:fast(实现级覆盖),squoosh:medium(同声明),wasm:未声明→回退 medium */
  const implCanvasFast: CapabilityImplementation = {
    capability: 'image.resize',
    engine: 'canvas',
    performance: 'fast',
    execute: async () => [],
  };
  const implSquooshMedium: CapabilityImplementation = {
    capability: 'image.resize',
    engine: 'squoosh',
    performance: 'medium',
    execute: async () => [],
  };
  const implWasmUnset: CapabilityImplementation = {
    capability: 'image.resize',
    engine: 'wasm',
    execute: async () => [], // 无 performance → 回退到 capability.performance='medium'
  };

  function setup(
    strategy: 'first' | 'fastest' | 'balanced',
    impls: CapabilityImplementation[] = [implCanvasFast, implSquooshMedium, implWasmUnset]
  ) {
    const reg = new CapabilityRegistry(strategy);
    reg.registerCapability(capMedium);
    for (const i of impls) reg.registerImplementation(i);
    return reg;
  }

  it('first 策略按注册顺序取第一个', () => {
    const reg = setup('first');
    expect(reg.resolve('image.resize')!.engine).toBe('canvas');
  });

  it('fastest 策略取性能最优(fast 优先)', () => {
    const reg = setup('fastest', [implSquooshMedium, implCanvasFast, implWasmUnset]);
    // canvas=fast 最优,即使后注册
    expect(reg.resolve('image.resize')!.engine).toBe('canvas');
  });

  it('fastest 同档时保留先注册的(稳定性)', () => {
    const reg = setup('fastest', [implSquooshMedium, implWasmUnset]);
    // 两者均 medium( wasm 未声明回退到 capability=medium),取先注册的 squoosh
    expect(reg.resolve('image.resize')!.engine).toBe('squoosh');
  });

  it('balanced 策略优先匹配能力声明的 performance(medium)', () => {
    const reg = setup('balanced', [implCanvasFast, implSquooshMedium, implWasmUnset]);
    // capability.performance='medium',squoosh 声明 medium,优先选它
    expect(reg.resolve('image.resize')!.engine).toBe('squoosh');
  });

  it('balanced 无匹配时退化为最快', () => {
    // 全部为 fast,无 medium 匹配 → 退化 fastest
    const reg = setup('balanced', [implCanvasFast, { ...implCanvasFast, engine: 'canvas2' }]);
    expect(reg.resolve('image.resize')!.performance).toBe('fast');
  });

  it('preferredEngine 仍优先于策略', () => {
    const reg = setup('fastest', [implCanvasFast, implSquooshMedium]);
    // 显式指定 squoosh,即使 canvas 更快
    expect(reg.resolve('image.resize', 'squoosh')!.engine).toBe('squoosh');
  });

  it('实现未声明 performance 时回退到能力声明', () => {
    const reg = setup('fastest', [implWasmUnset, implSquooshMedium]);
    // wasm 回退到 capability='medium',与 squoosh 同档,取先注册的 wasm
    expect(reg.resolve('image.resize')!.engine).toBe('wasm');
  });
});
