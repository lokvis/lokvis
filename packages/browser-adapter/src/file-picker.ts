/**
 * FilePickerAdapter —— File System Access 文件选择/保存(ADR-015 / ADR-018)
 *
 * Browser Adapter 层(L1)对原生 File System Access API 的统一封装,是全仓
 * 唯一允许出现 `showOpenFilePicker` / `showSaveFilePicker` / `showDirectoryPicker`
 * 与 `<input type=file>` / `<a download>` 的非展示层调用点(ADR-015)。
 *
 * 环境安全 + 渐进增强:
 * - Chrome/Edge:走原生 File System Access(真"另存为"对话框、目录句柄)
 * - Safari/Firefox:自动降级(input[type=file] / a[download] / input[webkitdirectory])
 * - Node/SSR:无 window/document 时返回空/false,不抛 ReferenceError
 *
 * 可测试性:`createFilePickerAdapter(host?)` 接受可选 host(window-like),
 * 默认从 globalThis 解析。测试注入 fake host 覆盖 native / fallback 两路,
 * 无需散乱 stubGlobal(ADR-015 测试约定)。
 *
 * 权限:FilePicker 是展示层/UI 使用的原生原语,不绑定插件上下文。插件若需
 * 访问本地文件系统,应声明 `filesystem:local` 并在调用前经
 * `ctx.sandbox.assertFilesystemAllowed('local', reason)` 自检(见 runtime
 * plugin-permissions + ADR-018 §权限模型)。
 */

/** 文件选择选项 */
export interface FilePickerOptions {
  /** 接受的 MIME → 扩展名映射(如 `{ 'image/png': ['.png'] }`) */
  accept?: Record<string, string[]>;
  /** 是否多选 */
  multiple?: boolean;
}

/** 文件选择/保存适配器接口 */
export interface FilePickerAdapter {
  /** 打开文件选择器,返回用户选中的文件(取消返回空数组) */
  pickFiles(options?: FilePickerOptions): Promise<File[]>;
  /** 打开目录选择器,递归返回目录内全部文件(取消返回空数组) */
  pickDirectory(): Promise<File[]>;
  /**
   * 保存 Blob 到用户选定位置。
   * 原生走 showSaveFilePicker("另存为"对话框);降级走 a[download]。
   * 返回 true 表示已保存/已触发下载;false 表示用户取消(仅原生可判定)。
   */
  saveFile(blob: Blob, suggestedName: string): Promise<boolean>;
  /**
   * 即时下载 Blob(始终走 a[download],不弹原生"另存为"对话框)。
   * 同步触发,无 Promise;Node/SSR 无 document 时静默 no-op。
   */
  downloadFile(blob: Blob, filename: string): void;
  /** 是否支持原生 File System Access API(showOpenFilePicker) */
  isNativeSupported(): boolean;
}

/**
 * host 抽象(window-like)。生产环境默认解析 globalThis;
 * 测试可注入 fake 覆盖 native / fallback 分支。
 */
export interface FilePickerHost {
  showOpenFilePicker?: (options?: unknown) => Promise<FilePickerFileHandle[]>;
  showSaveFilePicker?: (options?: unknown) => Promise<FilePickerFileHandle>;
  showDirectoryPicker?: (options?: unknown) => Promise<FilePickerDirectoryHandle>;
  document?: FilePickerDocument;
}

/** 最小 FileSystemFileHandle 形状(仅用到的部分) */
export interface FilePickerFileHandle {
  kind?: 'file' | 'directory';
  getFile(): Promise<File>;
  createWritable(): Promise<FilePickerWritable>;
}

/** 最小 WritableStream 形状 */
export interface FilePickerWritable {
  write(data: Blob | BufferSource | string): Promise<void>;
  close(): Promise<void>;
}

/** 最小 FileSystemDirectoryHandle 形状(异步可迭代 entries) */
export interface FilePickerDirectoryHandle {
  kind: 'directory' | 'file';
  name: string;
  values(): AsyncIterable<FilePickerFileHandle | FilePickerDirectoryHandle>;
}

/** 最小 input[type=file] 元素形状(fallback 文件/目录选择) */
export interface FilePickerInputElement {
  type: string;
  multiple: boolean;
  accept: string;
  webkitdirectory: boolean;
  style: { display: string };
  files: FileList | null;
  onchange: (() => void) | null;
  click(): void;
}

/** 最小 a 元素形状(fallback 下载) */
export interface FilePickerAnchorElement {
  href: string;
  download: string;
  click(): void;
}

/** 最小 document 形状(仅 fallback 用到) */
export interface FilePickerDocument {
  createElement(tag: 'input'): FilePickerInputElement;
  createElement(tag: 'a'): FilePickerAnchorElement;
  createElement(tag: string): FilePickerInputElement | FilePickerAnchorElement;
  body: {
    appendChild(node: FilePickerInputElement | FilePickerAnchorElement): void;
    removeChild(node: FilePickerInputElement | FilePickerAnchorElement): void;
  };
}

/**
 * 通过全局对象构建 file picker host。
 * 
 * 注意：此处的 `as unknown as` 是安全的必要转换：
 * - TypeScript 不假设全局作用域存在 File System Access API 属性
 * - Runtime check (showOpenFilePicker === 'function') 确保实际存在性（ADR-015）
 * - 避免生产环境出现 ReferenceError，非兼容性 workaround
 */
function resolveHost(host?: FilePickerHost): FilePickerHost {
  if (host) return host;
  const g = globalThis as unknown as FilePickerHost & { document?: FilePickerDocument };
  
  // Runtime guard:确保类型系统已知的属性实际存在
  if (!g.showOpenFilePicker && !g.document) {
    throw new Error('FilePickerAdapter requires browser environment');
  }
  
  return {
    showOpenFilePicker: g.showOpenFilePicker,
    showSaveFilePicker: g.showSaveFilePicker,
    showDirectoryPicker: g.showDirectoryPicker,
    document: typeof g.document !== 'undefined' ? g.document : undefined,
  };
}

/** accept 映射 → File System Access `types` 数组 */
function toAcceptTypes(accept?: Record<string, string[]>): unknown[] | undefined {
  if (!accept || Object.keys(accept).length === 0) return undefined;
  return [{ description: 'Files', accept }];
}

/** accept 映射 → input[accept] 字符串(MIME + 扩展名) */
function toAcceptAttr(accept?: Record<string, string[]>): string | undefined {
  if (!accept) return undefined;
  const parts: string[] = [];
  for (const [mime, exts] of Object.entries(accept)) {
    parts.push(mime);
    for (const ext of exts) parts.push(ext);
  }
  return parts.length > 0 ? parts.join(',') : undefined;
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name: string }).name === 'AbortError'
  );
}

async function collectDirectory(
  dir: FilePickerDirectoryHandle
): Promise<File[]> {
  const files: File[] = [];
  for await (const entry of dir.values()) {
    if (entry.kind === 'directory') {
      files.push(...(await collectDirectory(entry as FilePickerDirectoryHandle)));
    } else {
      files.push(await (entry as FilePickerFileHandle).getFile());
    }
  }
  return files;
}

/**
 * 创建 FilePickerAdapter。
 *
 * @param host 可选 window-like host(测试注入);默认解析 globalThis。
 */
export function createFilePickerAdapter(host?: FilePickerHost): FilePickerAdapter {
  const h = resolveHost(host);

  function isNativeSupported(): boolean {
    return typeof h.showOpenFilePicker === 'function';
  }

  async function pickFilesFallback(
    options: FilePickerOptions | undefined,
    doc: FilePickerDocument
  ): Promise<File[]> {
    return new Promise<File[]>((resolve) => {
      const input = doc.createElement('input');
      input.type = 'file';
      if (options?.multiple) input.multiple = true;
      const acceptAttr = toAcceptAttr(options?.accept);
      if (acceptAttr) input.accept = acceptAttr;
      input.style.display = 'none';
      input.onchange = () => {
        const list: File[] = input.files ? Array.from(input.files) : [];
        doc.body.removeChild(input);
        resolve(list);
      };
      doc.body.appendChild(input);
      input.click();
    });
  }

  async function pickFiles(options?: FilePickerOptions): Promise<File[]> {
    if (h.showOpenFilePicker) {
      try {
        const handles = await h.showOpenFilePicker({
          multiple: options?.multiple ?? false,
          types: toAcceptTypes(options?.accept),
        });
        return await Promise.all(handles.map((handle) => handle.getFile()));
      } catch (err) {
        if (isAbortError(err)) return [];
        throw err;
      }
    }
    if (h.document) return pickFilesFallback(options, h.document);
    return [];
  }

  async function pickDirectory(): Promise<File[]> {
    if (h.showDirectoryPicker) {
      try {
        const dir = await h.showDirectoryPicker();
        return await collectDirectory(dir);
      } catch (err) {
        if (isAbortError(err)) return [];
        throw err;
      }
    }
    if (h.document) {
      return new Promise<File[]>((resolve) => {
        const input = h.document!.createElement('input');
        input.type = 'file';
        input.webkitdirectory = true;
        input.style.display = 'none';
        input.onchange = () => {
          const list: File[] = input.files ? Array.from(input.files) : [];
          h.document!.body.removeChild(input);
          resolve(list);
        };
        h.document!.body.appendChild(input);
        input.click();
      });
    }
    return [];
  }

  function triggerDownload(doc: FilePickerDocument, blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = doc.createElement('a');
    a.href = url;
    a.download = filename;
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function saveFile(blob: Blob, suggestedName: string): Promise<boolean> {
    if (h.showSaveFilePicker) {
      try {
        const handle = await h.showSaveFilePicker({ suggestedName });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
      } catch (err) {
        if (isAbortError(err)) return false;
        throw err;
      }
    }
    if (h.document) {
      triggerDownload(h.document, blob, suggestedName);
      return true;
    }
    return false;
  }

  function downloadFile(blob: Blob, filename: string): void {
    if (h.document) {
      triggerDownload(h.document, blob, filename);
    }
  }

  return { pickFiles, pickDirectory, saveFile, downloadFile, isNativeSupported };
}
