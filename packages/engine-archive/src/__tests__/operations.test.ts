/**
 * engine-archive 操作单元测试
 *
 * 基于 fflate 真实现(非 stub),验证 zip → unzip 往返与 list JSON 结构。
 * fflate 同构,Node 端 Blob.arrayBuffer() 可用,无需 mock。
 */
import { describe, it, expect } from 'vitest';
import { zipBlobs, unzipBlob, listArchive } from '../operations.js';

function textBlob(text: string, type = 'text/plain'): Blob {
  return new Blob([text], { type });
}

async function blobText(blob: Blob): Promise<string> {
  return await blob.text();
}

describe('engine-archive zip/unzip 往返', () => {
  it('zip 后 unzip 应还原全部条目内容', async () => {
    const inputs = [textBlob('hello'), textBlob('world')];
    const zip = await zipBlobs(inputs, { names: ['a.txt', 'b.txt'] });
    expect(zip.type).toBe('application/zip');

    const out = await unzipBlob(zip, {});
    expect(out).toHaveLength(2);
    const texts = (await Promise.all(out.map(blobText))).sort();
    expect(texts).toEqual(['hello', 'world']);
  });

  it('缺省文件名时按 file-{index} 生成', async () => {
    const zip = await zipBlobs([textBlob('x'), textBlob('y')], {});
    const list = await listArchive(zip, {});
    const parsed = JSON.parse(await blobText(list));
    const names = parsed.entries.map((e: { name: string }) => e.name).sort();
    expect(names).toEqual(['file-0.txt', 'file-1.txt']);
  });

  it('同名条目应自动去重', async () => {
    const zip = await zipBlobs([textBlob('1'), textBlob('2')], {
      names: ['dup.txt', 'dup.txt'],
    });
    const list = await listArchive(zip, {});
    const parsed = JSON.parse(await blobText(list));
    const names = parsed.entries.map((e: { name: string }) => e.name).sort();
    expect(names).toEqual(['dup-1.txt', 'dup.txt']);
  });
});

describe('engine-archive list', () => {
  it('应输出 application/json,含 count 与 entries', async () => {
    const zip = await zipBlobs([textBlob('abc')], { names: ['f.txt'] });
    const list = await listArchive(zip, {});
    expect(list.type).toBe('application/json');
    const parsed = JSON.parse(await blobText(list));
    expect(parsed.count).toBe(1);
    expect(parsed.entries[0].name).toBe('f.txt');
    expect(parsed.entries[0].size).toBe(3);
  });
});
