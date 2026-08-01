/**
 * FilePickerAdapter 单元测试(ADR-018)。
 *
 * 用可注入的 fake host(window-like)覆盖 native / fallback 两路 + 目录遍历,
 * 不散乱 stubGlobal(ADR-015 测试约定)。
 */
import { describe, it, expect } from 'vitest';
import {
  createFilePickerAdapter,
  type FilePickerHost,
  type FilePickerFileHandle,
  type FilePickerDirectoryHandle,
  type FilePickerWritable,
} from '../file-picker.js';

/** 构造一个最小 File(Node 环境 File 可用) */
function makeFile(name: string, content = 'x'): File {
  return new File([content], name, { type: 'text/plain' });
}

/** fake file handle(native pickFiles / saveFile 用) */
function fakeFileHandle(file: File, sink?: Blob[]): FilePickerFileHandle {
  return {
    async getFile() {
      return file;
    },
    async createWritable(): Promise<FilePickerWritable> {
      return {
        async write(data) {
          if (sink) sink.push(data as Blob);
        },
        async close() {
          /* no-op */
        },
      };
    },
  };
}

/** fake 目录 handle(嵌套) */
function fakeDir(
  name: string,
  entries: (FilePickerFileHandle | FilePickerDirectoryHandle)[]
): FilePickerDirectoryHandle {
  return {
    kind: 'directory',
    name,
    async *values() {
      for (const e of entries) yield e;
    },
  };
}

/** 带 kind 标记的 fake file entry(目录遍历用) */
function fakeFileEntry(file: File): FilePickerFileHandle & { kind: 'file' } {
  return { kind: 'file', ...fakeFileHandle(file) } as FilePickerFileHandle & {
    kind: 'file';
  };
}

/** fake document(fallback 用),记录创建的元素 */
function fakeDocument() {
  const created: any[] = [];
  const doc = {
    createElement(_tag: string) {
      const el: any = { style: {}, click() {} };
      created.push(el);
      return el;
    },
    body: {
      appendChild() {},
      removeChild() {},
    },
  };
  return { doc, created };
}

describe('createFilePickerAdapter', () => {
  describe('isNativeSupported', () => {
    it('host 有 showOpenFilePicker 时为 true', () => {
      const adapter = createFilePickerAdapter({
        showOpenFilePicker: async () => [],
      });
      expect(adapter.isNativeSupported()).toBe(true);
    });

    it('host 无 showOpenFilePicker 时为 false', () => {
      const adapter = createFilePickerAdapter({});
      expect(adapter.isNativeSupported()).toBe(false);
    });
  });

  describe('pickFiles', () => {
    it('原生路径返回句柄对应的 File', async () => {
      const f1 = makeFile('a.txt');
      const f2 = makeFile('b.txt');
      const host: FilePickerHost = {
        showOpenFilePicker: async () => [
          fakeFileHandle(f1),
          fakeFileHandle(f2),
        ],
      };
      const adapter = createFilePickerAdapter(host);
      const files = await adapter.pickFiles({ multiple: true });
      expect(files).toEqual([f1, f2]);
    });

    it('原生用户取消(AbortError)返回空数组', async () => {
      const host: FilePickerHost = {
        showOpenFilePicker: async () => {
          const err = new Error('cancelled');
          err.name = 'AbortError';
          throw err;
        },
      };
      const adapter = createFilePickerAdapter(host);
      expect(await adapter.pickFiles()).toEqual([]);
    });

    it('非 AbortError 向上抛出', async () => {
      const host: FilePickerHost = {
        showOpenFilePicker: async () => {
          throw new Error('boom');
        },
      };
      const adapter = createFilePickerAdapter(host);
      await expect(adapter.pickFiles()).rejects.toThrow('boom');
    });

    it('无原生 API 时走 input[type=file] 降级', async () => {
      const { doc, created } = fakeDocument();
      const adapter = createFilePickerAdapter({ document: doc });
      const f = makeFile('c.txt');
      const promise = adapter.pickFiles({ accept: { 'text/plain': ['.txt'] } });
      // 模拟用户选择后触发 onchange
      const input = created[0];
      expect(input.type).toBe('file');
      expect(input.accept).toBe('text/plain,.txt');
      input.files = [f];
      input.onchange();
      expect(await promise).toEqual([f]);
    });

    it('无原生 API 且无 document 时返回空数组', async () => {
      const adapter = createFilePickerAdapter({});
      expect(await adapter.pickFiles()).toEqual([]);
    });
  });

  describe('pickDirectory', () => {
    it('原生递归遍历嵌套目录', async () => {
      const root = makeFile('root.txt');
      const nested = makeFile('nested.txt');
      const dir = fakeDir('root', [
        fakeFileEntry(root),
        fakeDir('sub', [fakeFileEntry(nested)]),
      ]);
      const adapter = createFilePickerAdapter({
        showDirectoryPicker: async () => dir,
      });
      const files = await adapter.pickDirectory();
      expect(files).toEqual([root, nested]);
    });

    it('取消(AbortError)返回空数组', async () => {
      const adapter = createFilePickerAdapter({
        showDirectoryPicker: async () => {
          const err = new Error('cancel');
          err.name = 'AbortError';
          throw err;
        },
      });
      expect(await adapter.pickDirectory()).toEqual([]);
    });

    it('无原生 API 走 input[webkitdirectory] 降级', async () => {
      const { doc, created } = fakeDocument();
      const adapter = createFilePickerAdapter({ document: doc });
      const f = makeFile('d.txt');
      const promise = adapter.pickDirectory();
      const input = created[0];
      expect(input.webkitdirectory).toBe(true);
      input.files = [f];
      input.onchange();
      expect(await promise).toEqual([f]);
    });
  });

  describe('saveFile', () => {
    it('原生写入 showSaveFilePicker 句柄并返回 true', async () => {
      const sink: Blob[] = [];
      const handle = fakeFileHandle(makeFile('out.txt'), sink);
      const adapter = createFilePickerAdapter({
        showSaveFilePicker: async () => handle,
      });
      const blob = new Blob(['data'], { type: 'text/plain' });
      const ok = await adapter.saveFile(blob, 'out.txt');
      expect(ok).toBe(true);
      expect(sink).toEqual([blob]);
    });

    it('原生用户取消(AbortError)返回 false', async () => {
      const adapter = createFilePickerAdapter({
        showSaveFilePicker: async () => {
          const err = new Error('cancel');
          err.name = 'AbortError';
          throw err;
        },
      });
      const ok = await adapter.saveFile(new Blob(['x']), 'x.txt');
      expect(ok).toBe(false);
    });

    it('无原生 API 走 a[download] 降级并返回 true', async () => {
      const { doc, created } = fakeDocument();
      const g = globalThis as unknown as {
        URL: { createObjectURL?: unknown; revokeObjectURL?: unknown };
      };
      const origCreate = g.URL.createObjectURL;
      const origRevoke = g.URL.revokeObjectURL;
      g.URL.createObjectURL = () => 'blob:fake';
      g.URL.revokeObjectURL = () => {};
      try {
        const adapter = createFilePickerAdapter({ document: doc });
        const ok = await adapter.saveFile(new Blob(['x']), 'x.txt');
        expect(ok).toBe(true);
        expect(created[0].download).toBe('x.txt');
      } finally {
        g.URL.createObjectURL = origCreate;
        g.URL.revokeObjectURL = origRevoke;
      }
    });

    it('无原生 API 且无 document 时返回 false', async () => {
      const adapter = createFilePickerAdapter({});
      const ok = await adapter.saveFile(new Blob(['x']), 'x.txt');
      expect(ok).toBe(false);
    });
  });
});
