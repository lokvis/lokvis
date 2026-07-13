/**
 * Shared test fakes(W2.1 从 opfs-asset-store.test.ts /
 * opfs-metadata-persistence.test.ts 去重提取)
 *
 * 提供内存模拟的 OPFS FileSystemFileHandle / FileSystemDirectoryHandle,
 * 供 OpfsAssetStore 单测与 OPFS 元数据持久化测试共用。
 *
 * 行为契约:
 * - FakeFileHandle.createWritable() 返回 write/close,write 把 blob 存入实例
 * - FakeFileHandle.getFile() 返回最近写入的 blob;未写入时抛 "File not found"
 * - FakeDirHandle 支持 getDirectoryHandle / getFileHandle / removeEntry,
 *   create:true 时自动创建,否则不存在抛错
 */

/** 内存模拟的 OPFS 文件句柄(FileSystemFileHandle 子集) */
export class FakeFileHandle {
  private blob: Blob | null = null;

  async createWritable(): Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }> {
    return {
      write: async (data) => {
        this.blob = data;
      },
      close: async () => {},
    };
  }

  async getFile(): Promise<Blob> {
    if (!this.blob) throw new Error('File not found');
    return this.blob;
  }
}

/** 内存模拟的 OPFS 目录句柄(FileSystemDirectoryHandle 子集) */
export class FakeDirHandle {
  private files = new Map<string, FakeFileHandle>();
  private dirs = new Map<string, FakeDirHandle>();

  async getDirectoryHandle(
    name: string,
    opts?: { create?: boolean }
  ): Promise<FakeDirHandle> {
    let d = this.dirs.get(name);
    if (!d) {
      if (!opts?.create) throw new Error(`Directory not found: ${name}`);
      d = new FakeDirHandle();
      this.dirs.set(name, d);
    }
    return d;
  }

  async getFileHandle(
    name: string,
    opts?: { create?: boolean }
  ): Promise<FakeFileHandle> {
    let f = this.files.get(name);
    if (!f) {
      if (!opts?.create) throw new Error(`File not found: ${name}`);
      f = new FakeFileHandle();
      this.files.set(name, f);
    }
    return f;
  }

  async removeEntry(name: string): Promise<void> {
    this.files.delete(name);
    this.dirs.delete(name);
  }
}
