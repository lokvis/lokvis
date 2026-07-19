/**
 * developer.diff 能力测试
 */
import { describe, it, expect } from 'vitest';
import { createDiffImpl } from '../capabilities/diff.js';
import {
  createMockContext,
  makeTextAsset,
  makeExecCtx,
  readAssetJson,
} from './helpers.js';

interface DiffResult {
  leftLineCount: number;
  rightLineCount: number;
  hunkCount: number;
  hunks: Array<{
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
  }>;
}

describe('developer.diff', () => {
  it('相同文本应返回 0 个 hunk', async () => {
    const { ctx } = createMockContext();
    const impl = createDiffImpl(ctx);

    const outputs = await impl.execute(
      [],
      { left: 'a\nb\nc', right: 'a\nb\nc' },
      makeExecCtx()
    );

    const result = (await readAssetJson(ctx, outputs[0]!)) as DiffResult;
    expect(result.leftLineCount).toBe(3);
    expect(result.rightLineCount).toBe(3);
    expect(result.hunkCount).toBe(0);
    expect(result.hunks).toEqual([]);
  });

  it('纯插入应生成全部 insert 行的 hunk', async () => {
    const { ctx } = createMockContext();
    const impl = createDiffImpl(ctx);

    const outputs = await impl.execute(
      [],
      { left: 'a', right: 'a\nb\nc' },
      makeExecCtx()
    );

    const result = (await readAssetJson(ctx, outputs[0]!)) as DiffResult;
    expect(result.hunkCount).toBe(1);
    const hunk = result.hunks[0]!;
    const inserts = hunk.lines.filter((l) => l.type === 'insert');
    expect(inserts.length).toBe(2);
    expect(inserts.map((l) => l.text)).toEqual(['b', 'c']);
  });

  it('纯删除应生成全部 delete 行的 hunk', async () => {
    const { ctx } = createMockContext();
    const impl = createDiffImpl(ctx);

    const outputs = await impl.execute(
      [],
      { left: 'a\nb\nc', right: 'a' },
      makeExecCtx()
    );

    const result = (await readAssetJson(ctx, outputs[0]!)) as DiffResult;
    expect(result.hunkCount).toBe(1);
    const hunk = result.hunks[0]!;
    const deletes = hunk.lines.filter((l) => l.type === 'delete');
    expect(deletes.length).toBe(2);
    expect(deletes.map((l) => l.text)).toEqual(['b', 'c']);
  });

  it('混合变更应同时包含 equal/delete/insert', async () => {
    const { ctx } = createMockContext();
    const impl = createDiffImpl(ctx);

    const outputs = await impl.execute(
      [],
      {
        left: 'line1\nline2\nline3\nline4',
        right: 'line1\nCHANGED\nline3\nline4',
      },
      makeExecCtx()
    );

    const result = (await readAssetJson(ctx, outputs[0]!)) as DiffResult;
    expect(result.hunkCount).toBe(1);
    const hunk = result.hunks[0]!;
    const types = hunk.lines.map((l) => l.type);
    expect(types).toContain('delete');
    expect(types).toContain('insert');
    expect(types).toContain('equal');
  });

  it('context=0 应只包含变更行,无上下文', async () => {
    const { ctx } = createMockContext();
    const impl = createDiffImpl(ctx);

    const outputs = await impl.execute(
      [],
      {
        left: 'a\nb\nc\nd\ne',
        right: 'a\nB\nc\nd\ne',
        context: 0,
      },
      makeExecCtx()
    );

    const result = (await readAssetJson(ctx, outputs[0]!)) as DiffResult;
    const hunk = result.hunks[0]!;
    // context=0 时 hunk 只含 delete + insert 各 1 行
    expect(hunk.lines).toHaveLength(2);
    expect(hunk.lines.every((l) => l.type !== 'equal')).toBe(true);
  });

  it('应从输入资产读取 left/right', async () => {
    const { ctx } = createMockContext();
    const impl = createDiffImpl(ctx);
    const leftAsset = makeTextAsset(ctx, 'foo\nbar');
    const rightAsset = makeTextAsset(ctx, 'foo\nBAR');

    const outputs = await impl.execute(
      [leftAsset, rightAsset],
      {},
      makeExecCtx()
    );

    const result = (await readAssetJson(ctx, outputs[0]!)) as DiffResult;
    expect(result.hunkCount).toBe(1);
    const hunk = result.hunks[0]!;
    expect(hunk.lines.some((l) => l.type === 'delete' && l.text === 'bar')).toBe(true);
    expect(hunk.lines.some((l) => l.type === 'insert' && l.text === 'BAR')).toBe(true);
  });

  it('缺少 left/right 参数与输入资产应抛错', async () => {
    const { ctx } = createMockContext();
    const impl = createDiffImpl(ctx);

    await expect(
      impl.execute([], {}, makeExecCtx())
    ).rejects.toThrow(/left.*right.*parameters/);
  });
});
