/**
 * 降级阶梯(W3.4)单元测试
 *
 * 覆盖(PROJECT_PLAN 3.7):
 * - pickDegradation 决策矩阵:4 级降级(L1/L2/L3/L4)的全部分支
 * - L4 拒绝条件:输入超预算且不可溢出 / 解码后缩放仍超 critical
 * - applyDegradationToResizeParams:L3 注入 maxEdge,其余原样返回
 * - formatBytes:B/KB/MB/GB 边界
 * - DegradationRejectedError:guide 用户引导数组
 */
import { describe, it, expect } from 'vitest';
import {
  pickDegradation,
  applyDegradationToResizeParams,
  formatBytes,
  DegradationRejectedError,
  DEGRADED_MAX_EDGE,
  DEGRADED_QUALITY,
  type DegradationContext,
} from '../degradation.js';

const BUDGET = 512 * 1024 * 1024; // 512MB,与默认 budget 一致

/** 构造决策上下文,缺省值便于覆盖默认场景 */
function ctx(over: Partial<DegradationContext> = {}): DegradationContext {
  return {
    pressure: 'low',
    canSpill: false,
    canTile: false,
    inputBytes: 1024,
    budget: BUDGET,
    ...over,
  };
}

// ─── pickDegradation 决策矩阵 ─────────────────────────────────

describe('pickDegradation 决策矩阵', () => {
  describe('L1-full(压力低/中)', () => {
    it('pressure=low 应返回 L1-full,无 spill', () => {
      const d = pickDegradation(ctx({ pressure: 'low', canSpill: true, canTile: true }));
      expect(d.level).toBe('L1-full');
      expect(d.spill).toBe(false);
      expect(d.maxEdge).toBeUndefined();
      expect(d.quality).toBeUndefined();
      expect(d.reason).toMatch(/low/);
    });

    it('pressure=elevated 应返回 L1-full(即便 canSpill/canTile)', () => {
      const d = pickDegradation(ctx({ pressure: 'elevated', canSpill: true, canTile: true }));
      expect(d.level).toBe('L1-full');
      expect(d.spill).toBe(false);
    });

    it('L1 不受 canTile/canSpill 影响', () => {
      for (const canTile of [true, false]) {
        for (const canSpill of [true, false]) {
          const d = pickDegradation(ctx({ pressure: 'elevated', canTile, canSpill }));
          expect(d.level).toBe('L1-full');
        }
      }
    });
  });

  describe('L2-tiled(压力高 + 可 tile)', () => {
    it('pressure=high + canTile + canSpill → L2-tiled 且 spill=true', () => {
      const d = pickDegradation(ctx({ pressure: 'high', canTile: true, canSpill: true }));
      expect(d.level).toBe('L2-tiled');
      expect(d.spill).toBe(true);
      expect(d.maxEdge).toBeUndefined();
      expect(d.reason).toMatch(/tile/);
      expect(d.reason).toMatch(/spill/);
    });

    it('pressure=high + canTile + !canSpill → L2-tiled 且 spill=false', () => {
      const d = pickDegradation(ctx({ pressure: 'high', canTile: true, canSpill: false }));
      expect(d.level).toBe('L2-tiled');
      expect(d.spill).toBe(false);
      expect(d.reason).not.toMatch(/spill/);
    });
  });

  describe('L3-degraded(压力高 + 不可 tile / 压力 critical)', () => {
    it('pressure=high + !canTile → L3-degraded', () => {
      const d = pickDegradation(ctx({ pressure: 'high', canTile: false, canSpill: false }));
      expect(d.level).toBe('L3-degraded');
      expect(d.maxEdge).toBe(DEGRADED_MAX_EDGE);
      expect(d.quality).toBe(DEGRADED_QUALITY);
      expect(d.spill).toBe(false);
    });

    it('pressure=high + !canTile + canSpill → L3-degraded 且 spill=true', () => {
      const d = pickDegradation(ctx({ pressure: 'high', canTile: false, canSpill: true }));
      expect(d.level).toBe('L3-degraded');
      expect(d.spill).toBe(true);
    });

    it('pressure=critical 且无 decodedBytes → L3-degraded', () => {
      const d = pickDegradation(ctx({ pressure: 'critical', canSpill: true }));
      expect(d.level).toBe('L3-degraded');
      expect(d.maxEdge).toBe(DEGRADED_MAX_EDGE);
      expect(d.quality).toBe(DEGRADED_QUALITY);
      expect(d.spill).toBe(true);
    });

    it('pressure=critical 且 decodedBytes 缩放后未超 critical → L3-degraded', () => {
      // decodedBytes 远小于 maxEdge*maxEdge*4,缩放后仍小 → L3
      const d = pickDegradation(
        ctx({ pressure: 'critical', decodedBytes: 1024, canSpill: false })
      );
      expect(d.level).toBe('L3-degraded');
    });
  });

  describe('L4-reject(拒绝条件)', () => {
    it('pressure=critical + inputBytes > budget + !canSpill → L4-reject', () => {
      const d = pickDegradation(
        ctx({
          pressure: 'critical',
          inputBytes: BUDGET + 1,
          canSpill: false,
        })
      );
      expect(d.level).toBe('L4-reject');
      expect(d.spill).toBe(false);
      expect(d.reason).toMatch(/exceeds budget/);
    });

    it('pressure=critical + inputBytes > budget + canSpill → 不应 L4(可溢出)', () => {
      // 可溢出时不走 L4 预判,继续走 decodedBytes 判定或 L3
      const d = pickDegradation(
        ctx({
          pressure: 'critical',
          inputBytes: BUDGET + 1,
          canSpill: true,
        })
      );
      expect(d.level).not.toBe('L4-reject');
    });

    it('pressure=critical + decodedBytes 缩放后仍超 critical(0.95*budget) → L4-reject', () => {
      // decodedBytes 巨大:即使缩到 maxEdge*maxEdge*4 仍 >= 0.95*budget
      // maxEdge=4096 → scaledCap = 4096*4096*4 = 67108864 ≈ 64MB
      // 0.95 * 512MB ≈ 486MB;64MB < 486MB,所以不会触发——需要更小的 budget
      const smallBudget = 50 * 1024 * 1024; // 50MB
      // scaledCap = 64MB >= 0.95*50MB=47.5MB → 触发 L4
      const d = pickDegradation(
        ctx({
          pressure: 'critical',
          decodedBytes: 200 * 1024 * 1024,
          budget: smallBudget,
          canSpill: true,
        })
      );
      expect(d.level).toBe('L4-reject');
      expect(d.reason).toMatch(/cap exceeds critical/);
    });

    it('pressure=critical + decodedBytes 缩放后未超 → 不应 L4', () => {
      const smallBudget = 200 * 1024 * 1024; // 200MB
      // scaledCap = 64MB < 0.95*200MB=190MB → L3
      const d = pickDegradation(
        ctx({
          pressure: 'critical',
          decodedBytes: 200 * 1024 * 1024,
          budget: smallBudget,
          canSpill: false,
        })
      );
      expect(d.level).toBe('L3-degraded');
    });

    it('L4-reject 在 pressure=high 时不应触发(仅 critical)', () => {
      const d = pickDegradation(
        ctx({
          pressure: 'high',
          inputBytes: BUDGET + 1,
          canSpill: false,
          canTile: false,
        })
      );
      expect(d.level).not.toBe('L4-reject');
    });
  });

  describe('决策确定性(纯函数)', () => {
    it('相同输入应产生相同输出', () => {
      const c = ctx({ pressure: 'high', canTile: true, canSpill: true });
      const a = pickDegradation(c);
      const b = pickDegradation(c);
      expect(a).toEqual(b);
    });

    it('不应修改输入 ctx(纯函数)', () => {
      const c = ctx({ pressure: 'critical', inputBytes: 999, canSpill: false });
      const snapshot = { ...c };
      pickDegradation(c);
      expect(c).toEqual(snapshot);
    });
  });
});

// ─── applyDegradationToResizeParams ──────────────────────────────

describe('applyDegradationToResizeParams', () => {
  it('L3-degraded 应注入 maxEdge', () => {
    const decision = {
      level: 'L3-degraded' as const,
      maxEdge: DEGRADED_MAX_EDGE,
      quality: DEGRADED_QUALITY,
      spill: false,
      reason: 'test',
    };
    const out = applyDegradationToResizeParams({ width: 9999, height: 9999 }, decision);
    expect(out.maxEdge).toBe(DEGRADED_MAX_EDGE);
    expect(out.width).toBe(9999); // 不覆盖既有参数
  });

  it('L3 时若用户已指定更小目标尺寸,不加 maxEdge', () => {
    const decision = {
      level: 'L3-degraded' as const,
      maxEdge: DEGRADED_MAX_EDGE,
      quality: DEGRADED_QUALITY,
      spill: false,
      reason: 'test',
    };
    // width < maxEdge → 尊重用户尺寸
    const out = applyDegradationToResizeParams({ width: 100 }, decision);
    expect(out.maxEdge).toBeUndefined();
  });

  it('L3 时若 height 已小于 maxEdge,不加 maxEdge', () => {
    const decision = {
      level: 'L3-degraded' as const,
      maxEdge: DEGRADED_MAX_EDGE,
      quality: DEGRADED_QUALITY,
      spill: false,
      reason: 'test',
    };
    const out = applyDegradationToResizeParams({ height: 100 }, decision);
    expect(out.maxEdge).toBeUndefined();
  });

  it('L1-full 应原样返回 params(无 maxEdge)', () => {
    const decision = { level: 'L1-full' as const, spill: false, reason: 'low' };
    const params = { width: 800, height: 600 };
    const out = applyDegradationToResizeParams(params, decision);
    expect(out).toEqual(params);
    expect(out.maxEdge).toBeUndefined();
  });

  it('L2-tiled 应原样返回 params', () => {
    const decision = { level: 'L2-tiled' as const, spill: true, reason: 'tile' };
    const params = { width: 800 };
    const out = applyDegradationToResizeParams(params, decision);
    expect(out).toEqual(params);
  });

  it('L4-reject 应原样返回 params', () => {
    const decision = { level: 'L4-reject' as const, spill: false, reason: 'reject' };
    const params = { width: 800 };
    const out = applyDegradationToResizeParams(params, decision);
    expect(out).toEqual(params);
  });

  it('不应修改原 params 对象', () => {
    const decision = {
      level: 'L3-degraded' as const,
      maxEdge: DEGRADED_MAX_EDGE,
      quality: DEGRADED_QUALITY,
      spill: false,
      reason: 'test',
    };
    const params = { width: 9999 };
    applyDegradationToResizeParams(params, decision);
    expect(params).toEqual({ width: 9999 }); // 未被 mutate
  });
});

// ─── formatBytes ────────────────────────────────────────────────

describe('formatBytes', () => {
  it('字节级(< 1KB)', () => {
    expect(formatBytes(0)).toBe('0B');
    expect(formatBytes(512)).toBe('512B');
    expect(formatBytes(1023)).toBe('1023B');
  });

  it('KB 级', () => {
    expect(formatBytes(1024)).toBe('1.0KB');
    expect(formatBytes(1536)).toBe('1.5KB');
    expect(formatBytes(1024 * 1024 - 1)).toBe('1024.0KB');
  });

  it('MB 级', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0MB');
    expect(formatBytes(10 * 1024 * 1024)).toBe('10.0MB');
    expect(formatBytes(512 * 1024 * 1024)).toBe('512.0MB');
  });

  it('GB 级', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00GB');
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.50GB');
  });
});

// ─── DegradationRejectedError ───────────────────────────────────

describe('DegradationRejectedError', () => {
  it('应携带 level/inputBytes/budget/guide', () => {
    const inputBytes = BUDGET + 1024;
    const err = new DegradationRejectedError(inputBytes, BUDGET, 'test reason');
    expect(err.level).toBe('L4-reject');
    expect(err.inputBytes).toBe(inputBytes);
    expect(err.budget).toBe(BUDGET);
    expect(err.guide).toBeInstanceOf(Array);
    expect(err.guide.length).toBeGreaterThanOrEqual(2);
  });

  it('message 应包含 reason 与格式化的字节', () => {
    const err = new DegradationRejectedError(BUDGET + 1, BUDGET, 'boom');
    expect(err.message).toMatch(/boom/);
    expect(err.message).toMatch(/exceeds memory budget/);
    // 字节被格式化为 MB
    expect(err.message).toMatch(/MB/);
  });

  it('inputBytes > budget 时 guide 应包含"smaller source"建议', () => {
    const err = new DegradationRejectedError(BUDGET + 1, BUDGET, 'x');
    expect(err.guide.some((g) => /smaller source/i.test(g))).toBe(true);
  });

  it('inputBytes <= budget 时 guide 不应包含"smaller source"', () => {
    const err = new DegradationRejectedError(1024, BUDGET, 'x');
    expect(err.guide.some((g) => /smaller source/i.test(g))).toBe(false);
  });

  it('guide 应包含"close other tabs"与"desktop app"建议', () => {
    const err = new DegradationRejectedError(1024, BUDGET, 'x');
    expect(err.guide.some((g) => /close other/i.test(g))).toBe(true);
    expect(err.guide.some((g) => /desktop|smaller batches/i.test(g))).toBe(true);
  });

  it('应可作为 Error 抛出与捕获', () => {
    try {
      throw new DegradationRejectedError(BUDGET + 1, BUDGET, 'test');
    } catch (e) {
      expect(e).toBeInstanceOf(DegradationRejectedError);
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).name).toBe('DegradationRejectedError');
    }
  });
});

// ─── 常量 ──────────────────────────────────────────────────────

describe('降级常量', () => {
  it('DEGRADED_MAX_EDGE 应为 4096', () => {
    expect(DEGRADED_MAX_EDGE).toBe(4096);
  });

  it('DEGRADED_QUALITY 应为 70', () => {
    expect(DEGRADED_QUALITY).toBe(70);
  });
});
