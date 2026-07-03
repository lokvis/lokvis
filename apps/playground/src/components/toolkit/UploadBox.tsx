/**
 * UploadBox — 通用文件上传区,支持拖拽 + 点击选择。
 *
 * 所有工具页复用:accept 控制文件类型,multiple 控制单/多文件,
 * onFiles 回调返回 File[]。拖拽高亮反馈。
 */
import { useCallback, useRef, useState } from 'react';

export interface UploadBoxProps {
  /** 接受的文件类型,如 'image/*' */
  accept?: string;
  /** 是否允许多文件 */
  multiple?: boolean;
  /** 文件选择回调 */
  onFiles: (files: File[]) => void;
  /** 提示文案 */
  hint?: string;
  className?: string;
}

export function UploadBox({
  accept = 'image/*',
  multiple = false,
  onFiles,
  hint = '点击或拖拽文件到此处',
  className = '',
}: UploadBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const files = Array.from(fileList);
      onFiles(multiple ? files : [files[0]!]);
    },
    [multiple, onFiles]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
        dragOver
          ? 'border-indigo-500 bg-indigo-500/5'
          : 'border-zinc-700 bg-zinc-900/30 hover:border-zinc-600 hover:bg-zinc-900/50'
      } ${className}`}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          // 清空 value 让用户能重复选择同一文件
          e.target.value = '';
        }}
      />
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mb-2 text-zinc-500"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <p className="text-xs text-zinc-400">{hint}</p>
    </div>
  );
}
