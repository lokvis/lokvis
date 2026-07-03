/**
 * UploadBox — 通用文件上传区,支持拖拽 + 点击选择。
 *
 * 所有工具页复用:accept 控制文件类型,multiple 控制单/多文件,
 * onFiles 回调返回 File[]。拖拽高亮反馈。
 */
import { useCallback, useRef, useState } from 'react';

export interface UploadBoxProps {
  /** 接受的文件类型,如 'image/*'(同时用于 input accept 与拖拽校验) */
  accept?: string;
  /** 是否允许多文件 */
  multiple?: boolean;
  /** 文件选择回调 */
  onFiles: (files: File[]) => void;
  /** 提示文案 */
  hint?: string;
  className?: string;
}

/**
 * 校验文件类型是否匹配 accept 模式。
 * 支持 MIME 通配(image/*)和具体类型(image/png)及扩展名(.png)。
 * accept 为空时放行所有文件。
 */
function fileMatchesAccept(file: File, accept: string): boolean {
  if (!accept) return true;
  const patterns = accept.split(',').map((p) => p.trim().toLowerCase());
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return patterns.some((p) => {
    if (p.endsWith('/*')) {
      // image/* → 匹配 image/任意
      const prefix = p.slice(0, -1);
      return mime.startsWith(prefix);
    }
    if (p.startsWith('.')) {
      // .png → 匹配扩展名
      return name.endsWith(p);
    }
    // image/png → 精确匹配 MIME
    return mime === p;
  });
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
  const [rejectMsg, setRejectMsg] = useState<string | null>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const all = Array.from(fileList);
      // 校验文件类型:accept=image/* 时拒绝非图片文件(#4 修复)
      const accepted = all.filter((f) => fileMatchesAccept(f, accept));
      const rejected = all.length - accepted.length;
      if (rejected > 0) {
        setRejectMsg(`已忽略 ${rejected} 个不支持的文件(仅接受 ${accept})`);
      } else {
        setRejectMsg(null);
      }
      if (accepted.length === 0) return;
      onFiles(multiple ? accepted : [accepted[0]!]);
    },
    [multiple, onFiles, accept]
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
      {rejectMsg && <p className="mt-1 text-[10px] text-amber-400">{rejectMsg}</p>}
    </div>
  );
}
