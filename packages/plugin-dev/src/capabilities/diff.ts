/**
 * developer.diff —— 文本行级 diff(基于 LCS 算法)
 *
 * 接受 left/right 文本,按行拆分后计算 LCS,生成 unified-diff 风格的 hunk 列表。
 *
 * 输入来源(优先级):
 * - left: params.left(字符串)或 inputs[0] 文本
 * - right: params.right(字符串)或 inputs[1] 文本
 *
 * 输出 JSON:{
 *   leftLineCount, rightLineCount,
 *   hunks: [{ leftStart, leftCount, rightStart, rightCount, lines: [{ type, text, leftLine?, rightLine? }] }]
 * }
 *
 * 算法:经典 LCS 动态规划(O(n*m)),对一般文本(数千行)足够。
 * 不依赖外部 diff 库,纯 TS 实现便于跨平台运行。
 */
import type { Asset, CapabilityImplementation, PluginContext } from '@lokvis/schema';
import { createCapabilityImpl } from '@lokvis/plugin-sdk';
import { createJsonAsset, INLINE_ENGINE } from './shared.js';

/** 创建 developer.diff 能力实现 */
export function createDiffImpl(
  ctx: PluginContext
): CapabilityImplementation {
  return createCapabilityImpl(
    'developer.diff',
    INLINE_ENGINE,
    async (inputs, params, execCtx) => {
      const leftText =
        typeof params.left === 'string'
          ? params.left
          : await readInputText(inputs, 0, ctx);
      const rightText =
        typeof params.right === 'string'
          ? params.right
          : await readInputText(inputs, 1, ctx);

      const contextLines =
        typeof params.context === 'number' && params.context >= 0
          ? Math.floor(params.context)
          : 3;

      const leftLines = leftText.split('\n');
      const rightLines = rightText.split('\n');

      // 计算 LCS 表
      const lcs = computeLcsTable(leftLines, rightLines);

      // 回溯生成 op 序列('equal' | 'delete' | 'insert')
      const ops = backtrackOps(lcs, leftLines, rightLines);

      // 按 context 折叠成 hunks
      const hunks = buildHunks(ops, contextLines);

      execCtx.onProgress?.(1, `Diff complete: ${hunks.length} hunks`);
      return [
        await createJsonAsset(ctx, {
          leftLineCount: leftLines.length,
          rightLineCount: rightLines.length,
          hunkCount: hunks.length,
          hunks,
        }),
      ];
    }
  );
}

/** 从 inputs[index] 读取文本 */
async function readInputText(
  inputs: Asset[],
  index: number,
  ctx: PluginContext
): Promise<string> {
  const asset = inputs[index];
  if (!asset) {
    throw new Error(
      `developer.diff requires either "left"/"right" parameters or two text input assets (missing input at index ${index})`
    );
  }
  const blob = await ctx.runtime.getAssetBlob(asset);
  return await blob.text();
}

/** 计算 LCS 长度表(DP) */
function computeLcsTable(a: string[], b: string[]): Uint32Array {
  const n = a.length;
  const m = b.length;
  // 用 Uint32Array 比 number[][] 快且省内存
  const table = new Uint32Array((n + 1) * (m + 1));
  const stride = m + 1;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        table[i * stride + j] = table[(i - 1) * stride + (j - 1)]! + 1;
      } else {
        table[i * stride + j] = Math.max(
          table[(i - 1) * stride + j]!,
          table[i * stride + (j - 1)]!
        );
      }
    }
  }
  return table;
}

/** 回溯生成 op 序列 */
type DiffOp =
  | { type: 'equal'; text: string; leftLine: number; rightLine: number }
  | { type: 'delete'; text: string; leftLine: number; rightLine?: undefined }
  | { type: 'insert'; text: string; leftLine?: undefined; rightLine: number };

function backtrackOps(
  table: Uint32Array,
  a: string[],
  b: string[]
): DiffOp[] {
  const n = a.length;
  const m = b.length;
  const stride = m + 1;
  const ops: DiffOp[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.unshift({
        type: 'equal',
        text: a[i - 1]!,
        leftLine: i,
        rightLine: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || table[i * stride + (j - 1)]! >= table[(i - 1) * stride + j]!)) {
      ops.unshift({
        type: 'insert',
        text: b[j - 1]!,
        rightLine: j,
      });
      j--;
    } else {
      ops.unshift({
        type: 'delete',
        text: a[i - 1]!,
        leftLine: i,
      });
      i--;
    }
  }
  return ops;
}

/** 把 op 序列折叠成 hunks(按 context 行截断) */
interface DiffHunk {
  leftStart: number;
  leftCount: number;
  rightStart: number;
  rightCount: number;
  lines: Array<{
    type: 'equal' | 'delete' | 'insert';
    text: string;
    leftLine?: number;
    rightLine?: number;
  }>;
}

function buildHunks(ops: DiffOp[], contextLines: number): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let lastChangedIdx = -1;

  for (let idx = 0; idx < ops.length; idx++) {
    const op = ops[idx]!;
    const isChange = op.type !== 'equal';

    if (isChange) {
      // 新建 hunk(若当前无 hunk 或距离上一个 change 超过 2*context)
      if (currentHunk === null || lastChangedIdx < 0 || idx - lastChangedIdx > 2 * contextLines + 1) {
        // 关闭旧 hunk
        if (currentHunk !== null) {
          finalizeHunk(currentHunk);
          hunks.push(currentHunk);
        }
        // 新 hunk 起始:回退 context 行(若可)
        const startIdx = Math.max(0, idx - contextLines);
        currentHunk = {
          leftStart: 0,
          leftCount: 0,
          rightStart: 0,
          rightCount: 0,
          lines: [],
        };
        // 把 context 行加入新 hunk
        for (let k = startIdx; k < idx; k++) {
          pushOpToHunk(currentHunk, ops[k]!);
        }
      }
      pushOpToHunk(currentHunk!, op);
      lastChangedIdx = idx;
    } else if (currentHunk !== null) {
      // equal 行:若在 context 范围内,加入当前 hunk;否则关闭 hunk
      if (idx - lastChangedIdx <= contextLines) {
        pushOpToHunk(currentHunk, op);
      } else {
        // 关闭 hunk
        finalizeHunk(currentHunk);
        hunks.push(currentHunk);
        currentHunk = null;
        lastChangedIdx = -1;
      }
    }
  }

  // 关闭最后的 hunk
  if (currentHunk !== null) {
    finalizeHunk(currentHunk);
    hunks.push(currentHunk);
  }

  return hunks;
}

/** 把 op 加入 hunk 的 lines,并累加 leftCount/rightCount */
function pushOpToHunk(hunk: DiffHunk, op: DiffOp): void {
  hunk.lines.push({
    type: op.type,
    text: op.text,
    leftLine: op.leftLine,
    rightLine: op.rightLine,
  });
  if (op.type === 'equal') {
    hunk.leftCount++;
    hunk.rightCount++;
  } else if (op.type === 'delete') {
    hunk.leftCount++;
  } else {
    hunk.rightCount++;
  }
}

/** 计算 hunk 的 leftStart / rightStart */
function finalizeHunk(hunk: DiffHunk): void {
  // 找到第一个有 leftLine 或 rightLine 的行
  for (const line of hunk.lines) {
    if (line.leftLine !== undefined) {
      hunk.leftStart = line.leftLine;
      break;
    }
  }
  for (const line of hunk.lines) {
    if (line.rightLine !== undefined) {
      hunk.rightStart = line.rightLine;
      break;
    }
  }
  // 若全为 delete(无 rightLine),rightStart = leftStart
  if (hunk.rightStart === 0 && hunk.leftStart > 0) {
    // 找 right 侧的对应起始(基于 hunk 在右文件中的位置)
    // 简化:用第一个 insert 或 equal 的 rightLine,若无则用 leftStart - 1
    const firstRight = hunk.lines.find((l) => l.rightLine !== undefined);
    hunk.rightStart = firstRight?.rightLine ?? 0;
  }
}
