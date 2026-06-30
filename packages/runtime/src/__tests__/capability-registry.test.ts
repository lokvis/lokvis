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
});
