/**
 * 能力降级阶梯(W3.4)
 *
 * 当 MemoryGuard 报告内存压力时,运行时需要按阶梯选择处理策略,
 * 而非"要么全量要么崩溃"。本模块实现四级降级政策(whitepaper T1):
 *
 *   L1-full      完整质量——压力低/中,正常处理。
 *   L2-tiled     分片处理——压力高,把输入按 tile 切分 + 中间结果溢出 OPFS,
 *                内存里同时只持有一个 tile。
 *   L3-degraded  降级输出——压力 critical,先缩小到 maxEdge 再处理,
 *                降低质量,避免 OOM;产出可用但非最佳。
 *   L4-reject    拒绝 + 引导——即使降级也无法安全处理(如单张图解码后即超
 *                critical 且无法再缩),抛 DegradationRejectedError 携带
 *                用户可读的引导(换更小源图 / 关闭其他 tab / 升级浏览器)。
 *
 * 设计取舍:
 * - 本模块只做"决策"(policy),不直接执行图像操作。执行由 plugin-image
 *   / executor 据 decision 调整参数后委托 engine-image。
 * - 决策是纯函数(pickDegradation),便于单测与确定性回归。
 * - L2 是否可走取决于操作是否支持 tiling(canTile);canvas 引擎对几何
 *   变换可 tile,但对依赖全图的滤镜(模糊)与水印 tile 无意义 → 调用方
 *   据操作语义传入 canTile。
 */

import type { MemoryPressure } from './memory-guard.js';
import { formatBytes } from './format.js';

/** 降级阶梯等级 */
export type DegradationLevel = 'L1-full' | 'L2-tiled' | 'L3-degraded' | 'L4-reject';

/** L3 降级输出时建议的最大边长(像素)——4K,兼顾可用性与内存 */
export const DEGRADED_MAX_EDGE = 4096;
/** L3 降级输出时建议的质量(0-100)——70 是视觉可接受的下限 */
export const DEGRADED_QUALITY = 70;

/** 决策上下文(由调用方据 MemoryGuard + 操作能力构造) */
export interface DegradationContext {
  /** 当前内存压力等级(来自 MemoryGuard.getPressure) */
  pressure: MemoryPressure;
  /** 是否可溢出中间结果到 OPFS(MemoryGuard.canSpill) */
  canSpill: boolean;
  /** 操作是否支持 tiling / streaming(几何变换通常 true,模糊/水印 false) */
  canTile: boolean;
  /** 输入字节数(用于 L4 判定:输入本身过大时即使降级也无救) */
  inputBytes: number;
  /** 内存预算(字节,用于 L4 引导信息) */
  budget: number;
  /**
   * 解码后位图估算字节(用于 L4 判定:decode 后超 critical 且
   * 已是 maxEdge 缩放后仍超 → reject)。可选,缺省时仅按 pressure 判。
   *
   * **强烈建议提供**:可通过 estimateDecodedBytes(width, height) 计算。
   * 缺省时 pressure=critical + canSpill=true 场景会跳过 L4 判定,
   * 直接返回 L3-degraded,可能导致超大图缩放后仍 OOM。
   */
  decodedBytes?: number;
}

/** 降级决策结果 */
export interface DegradationDecision {
  level: DegradationLevel;
  /** L3 时建议缩放到的最大边长(像素);其余等级 undefined */
  maxEdge?: number;
  /** L3 时建议质量(0-100);其余等级 undefined */
  quality?: number;
  /** L2/L3 时是否把中间结果溢出到 OPFS */
  spill: boolean;
  /** 决策依据(便于日志 / 事件 / 调试) */
  reason: string;
}

/**
 * 根据内存压力与操作能力选择降级策略(纯函数)。
 *
 * 决策矩阵:
 *   pressure  canTile  canSpill  →  level
 *   low/elevated  *        *     →  L1-full
 *   high          true    true   →  L2-tiled(spill)
 *   high          true    false  →  L2-tiled(无 spill,仅靠 tile 控峰值)
 *   high          false   *      →  L3-degraded(降到 maxEdge+quality)
 *   critical      *       *      →  L3-degraded(若 decodedBytes 缩放后仍超
 *                                              critical → L4-reject)
 *
 * L4 触发条件:pressure=critical 且 decodedBytes 已按 maxEdge 缩放后
 * 估算仍 >= budget 的 critical 阈值(0.95),即"再怎么缩也会撑爆"。
 *
 * **调用方注意**:当 pressure=critical 且 canSpill=true 时,若不提供
 * decodedBytes,函数将跳过 L4 判定直接返回 L3-degraded。这意味着对于
 * 超大单张图(无法通过 spill 分块),L3 缩放后仍可能 OOM。
 * 建议:尽可能通过 estimateDecodedBytes(width, height) 提供 decodedBytes,
 * 以提高 L4 判定精度,避免静默降级后崩溃。
 */
export function pickDegradation(ctx: DegradationContext): DegradationDecision {
  const { pressure, canTile, canSpill, inputBytes, budget, decodedBytes } = ctx;

  // L1:压力低/中,完整处理
  if (pressure === 'low' || pressure === 'elevated') {
    return {
      level: 'L1-full',
      spill: false,
      reason: `pressure=${pressure}, full quality`,
    };
  }

  // L4 预判:输入本身已超预算且无法溢出 → 直接拒绝(避免无谓降级后仍 OOM)
  // 仅当输入 blob 已 > budget 且不能溢出时,降级也救不了
  if (pressure === 'critical' && inputBytes > budget && !canSpill) {
    return rejectDecision(inputBytes, budget, 'input exceeds budget and OPFS spill unavailable');
  }

  if (pressure === 'high') {
    // L2:可 tile 则分片处理(优先 spill 以降峰值)
    if (canTile) {
      return {
        level: 'L2-tiled',
        spill: canSpill,
        reason: `pressure=high, tile-based${canSpill ? ' + OPFS spill' : ''}`,
      };
    }
    // 不可 tile(模糊/水印等全图操作)→ L3 降级
    return degradedDecision(canSpill, 'pressure=high but operation not tileable, degrade output');
  }

  // pressure === 'critical'
  // 若提供 decodedBytes 且缩放到 maxEdge 后估算仍超 critical(0.95)→ L4
  if (decodedBytes !== undefined) {
    const scaledEstimate = scaleDecodedEstimate(decodedBytes, DEGRADED_MAX_EDGE);
    if (scaledEstimate >= budget * 0.95) {
      return rejectDecision(inputBytes, budget, `decoded ~${scaledEstimate}B even after ${DEGRADED_MAX_EDGE}px cap exceeds critical`);
    }
  }
  // 否则 L3:降级输出
  return degradedDecision(canSpill, 'pressure=critical, degrade output to fit budget');
}

/** L3 降级输出决策 */
function degradedDecision(spill: boolean, reason: string): DegradationDecision {
  return {
    level: 'L3-degraded',
    maxEdge: DEGRADED_MAX_EDGE,
    quality: DEGRADED_QUALITY,
    spill,
    reason,
  };
}

/** L4 拒绝决策 */
function rejectDecision(inputBytes: number, budget: number, reason: string): DegradationDecision {
  return {
    level: 'L4-reject',
    spill: false,
    reason: `reject: ${reason} (input=${inputBytes}B, budget=${budget}B)`,
  };
}

/**
 * 估算把位图缩放到 maxEdge 后的解码字节数(按面积比例缩放)。
 * 用于 L4 判定:若缩放后仍超 critical 则无救。
 */
function scaleDecodedEstimate(decodedBytes: number, maxEdge: number): number {
  // decodedBytes ∝ width*height。缩放到 maxEdge 按长边,面积比 = (max/orig)^2。
  // 但我们不知原始 width/height,只有 decodedBytes。保守起见:若 decodedBytes
  // 已大于 maxEdge*maxEdge*4(即缩放后的占用),说明原图比 maxEdge 大,缩放有效;
  // 否则原图已 <= maxEdge,缩放无变化,估算 = decodedBytes。
  const scaledCap = maxEdge * maxEdge * 4;
  return Math.min(decodedBytes, scaledCap);
}

/**
 * L4 拒绝时抛出的错误,携带用户可读的引导建议。
 *
 * 引导文案面向终端用户(经 UI 展示),而非开发者堆栈。
 */
export class DegradationRejectedError extends Error {
  readonly level = 'L4-reject' as const;
  readonly inputBytes: number;
  readonly budget: number;
  /** 用户可读的引导建议(UI 可直接渲染) */
  readonly guide: string[];

  constructor(inputBytes: number, budget: number, reason: string) {
    super(
      `Operation rejected to avoid out-of-memory: ${reason}. ` +
        `Input ${formatBytes(inputBytes)} exceeds memory budget ${formatBytes(budget)}.`
    );
    this.name = 'DegradationRejectedError';
    this.inputBytes = inputBytes;
    this.budget = budget;
    this.guide = buildGuide(inputBytes, budget);
  }
}

/** 构造用户引导建议(按优先级) */
function buildGuide(inputBytes: number, budget: number): string[] {
  const guide: string[] = [];
  if (inputBytes > budget) {
    guide.push(
      `This image (${formatBytes(inputBytes)}) is larger than the in-browser memory budget ` +
        `(${formatBytes(budget)}). Try a smaller source image.`
    );
  }
  guide.push('Close other browser tabs to free memory, then retry.');
  guide.push('For very large images, use the desktop app or process in smaller batches.');
  return guide;
}

/**
 * 把降级决策应用到 resize 参数(若 L3):确保输出最大边不超过 maxEdge。
 *
 * 调用方在 L3 时据此调整 params.width/height,再交给 engine.resize。
 * L1/L2/L4 时原样返回 params。
 */
export function applyDegradationToResizeParams(
  params: Record<string, unknown>,
  decision: DegradationDecision
): Record<string, unknown> {
  if (decision.level !== 'L3-degraded' || decision.maxEdge === undefined) {
    return params;
  }
  const next = { ...params };
  // 只要任一已指定的边超过 maxEdge,就注入 maxEdge 上限保护内存。
  // undefined 视为"未约束",不参与 veto;已指定且 ≤ maxEdge 的边才排除 maxEdge。
  const w = next.width as number | undefined;
  const h = next.height as number | undefined;
  const wOver = w !== undefined && w > decision.maxEdge;
  const hOver = h !== undefined && h > decision.maxEdge;
  const wUnset = w === undefined;
  const hUnset = h === undefined;
  if (wOver || hOver || (wUnset && hUnset)) {
    next.maxEdge = decision.maxEdge;
  }
  return next;
}
