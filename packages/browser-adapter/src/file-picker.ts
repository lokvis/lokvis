/**
 * FilePickerAdapter —— File System Access 文件选择(ADR-015,预留)
 *
 * 本期仅类型定义,无实现。未来封装 showOpenFilePicker /
 * showSaveFilePicker / showDirectoryPicker,供 UI 层经统一入口
 * 使用(含 <input type=file> 降级)。
 */

/** 文件选择选项(预留) */
export interface FilePickerOptions {
  /** 接受的 MIME → 扩展名映射 */
  accept?: Record<string, string[]>;
  /** 是否多选 */
  multiple?: boolean;
}

/** 文件选择适配器接口(预留,本期无实现) */
export interface FilePickerAdapter {
  /** 打开文件选择器,返回用户选中的文件(取消返回空数组) */
  pickFiles(options?: FilePickerOptions): Promise<File[]>;
  /** 是否支持原生 File System Access API */
  isNativeSupported(): boolean;
}
