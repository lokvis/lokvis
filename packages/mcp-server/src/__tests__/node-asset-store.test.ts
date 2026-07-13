/**
 * NodeAssetStore 单元测试
 *
 * 使用真实 fs + 临时目录,验证 import/get/getBlob/remove/list/create。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, stat, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeAssetStore } from '../node-asset-store.js';

describe('NodeAssetStore', () => {
  let workdir: string;
  let store: NodeAssetStore;

  beforeEach(async () => {
    workdir = await mkdtemp(join(tmpdir(), 'lokvis-node-store-'));
    store = new NodeAssetStore(workdir);
    await store.init();
  });

  afterEach(async () => {
    await rm(workdir, { recursive: true, force: true });
  });

  describe('init', () => {
    it('应创建 .lokvis/assets 目录', async () => {
      const dirStat = await stat(join(workdir, '.lokvis', 'assets'));
      expect(dirStat.isDirectory()).toBe(true);
    });
  });

  describe('import (file)', () => {
    it('应从 File 对象导入并创建 Asset', async () => {
      const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' });
      const file = new File([blob], 'test.png', { type: 'image/png' });
      const asset = await store.import({ kind: 'file', file });

      expect(asset.id).toBeTruthy();
      expect(asset.type).toBe('image');
      expect(asset.metadata.mimeType).toBe('image/png');
      expect(asset.metadata.size).toBe(4);
      expect(asset.metadata.format).toBe('png');
      expect(asset.blob.path).toContain('.lokvis/assets/');
      expect(asset.blob.path).toMatch(/\.png$/);
      expect(asset.blob.size).toBe(4);
      expect(asset.blob.mimeType).toBe('image/png');
      expect(asset.history).toEqual([]);
      expect(asset.tags).toEqual([]);
    });
  });

  describe('import (blob)', () => {
    it('应从 Blob 对象导入并创建 Asset', async () => {
      const blob = new Blob([new Uint8Array([5, 6])], { type: 'image/jpeg' });
      const asset = await store.import({ kind: 'blob', blob, name: 'test.jpg' });

      expect(asset.type).toBe('image');
      expect(asset.metadata.mimeType).toBe('image/jpeg');
      expect(asset.metadata.format).toBe('jpeg');
      expect(asset.metadata.size).toBe(2);
    });
  });

  describe('import (unsupported)', () => {
    it('url 类型应抛错', async () => {
      await expect(
        store.import({ kind: 'url', url: 'http://example.com/a.png' })
      ).rejects.toThrow('not supported by NodeAssetStore');
    });

    it('opfs 类型应抛错', async () => {
      await expect(
        store.import({ kind: 'opfs', path: '/opfs/a.png' })
      ).rejects.toThrow('not supported by NodeAssetStore');
    });
  });

  describe('get', () => {
    it('应返回已导入的 Asset', async () => {
      const file = new File([new Blob([new Uint8Array([1])])], 'a.png', { type: 'image/png' });
      const asset = await store.import({ kind: 'file', file });
      const found = await store.get(asset.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(asset.id);
    });

    it('未知 id 应返回 undefined', async () => {
      const found = await store.get('nonexistent-id');
      expect(found).toBeUndefined();
    });
  });

  describe('getBlob', () => {
    it('应返回 Blob 数据', async () => {
      const data = new Uint8Array([10, 20, 30]);
      const file = new File([new Blob([data])], 'a.png', { type: 'image/png' });
      const asset = await store.import({ kind: 'file', file });

      const blob = await store.getBlob(asset.blob);
      const blobData = new Uint8Array(await blob.arrayBuffer());
      expect(blobData).toEqual(data);
      expect(blob.type).toBe('image/png');
    });
  });

  describe('remove', () => {
    it('应删除 Asset 和文件', async () => {
      const file = new File([new Blob([new Uint8Array([1])])], 'a.png', { type: 'image/png' });
      const asset = await store.import({ kind: 'file', file });

      await store.remove(asset.id);

      expect(await store.get(asset.id)).toBeUndefined();
      // 文件应已被删除
      await expect(stat(asset.blob.path)).rejects.toThrow();
    });

    it('删除不存在的 id 不应抛错', async () => {
      await expect(store.remove('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('list', () => {
    it('应返回所有 Asset', async () => {
      const file1 = new File([new Blob([new Uint8Array([1])])], 'a.png', { type: 'image/png' });
      const file2 = new File([new Blob([new Uint8Array([2])])], 'b.jpg', { type: 'image/jpeg' });
      await store.import({ kind: 'file', file: file1 });
      await store.import({ kind: 'file', file: file2 });

      const list = await store.list();
      expect(list).toHaveLength(2);
    });

    it('空 store 应返回空数组', async () => {
      const list = await store.list();
      expect(list).toEqual([]);
    });
  });

  describe('create', () => {
    it('应创建新 Asset 并写入文件', async () => {
      const blob = new Blob([new Uint8Array([100, 200])], { type: 'image/webp' });
      const metadata = { mimeType: 'image/webp', size: 2, format: 'webp' };
      const asset = await store.create(blob, metadata, 'image');

      expect(asset.type).toBe('image');
      expect(asset.metadata).toEqual(metadata);
      expect(asset.blob.path).toMatch(/\.webp$/);

      // 验证文件实际写入
      const fileData = await readFile(asset.blob.path);
      expect(fileData).toEqual(Buffer.from([100, 200]));
    });

    it('应支持非 image 类型', async () => {
      const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'application/pdf' });
      const metadata = { mimeType: 'application/pdf', size: 3, format: 'pdf' };
      const asset = await store.create(blob, metadata, 'pdf');

      expect(asset.type).toBe('pdf');
      expect(asset.blob.path).toMatch(/\.pdf$/);
    });
  });
});
