/**
 * useInputBlobImport — inputBlob 选项的实现(Layer 0 内部共享)。
 *
 * UseEmbedActionOptions.inputBlob 允许三方直接注入 Blob 作为输入
 * (pipeline 串联:上一个 hook 的 outputBlob → 下一个 hook 的 inputBlob;
 * 或外部来源:相机 / canvas 截图 / fetch 结果),无需经过 File 选择器。
 *
 * 注入的 Blob 走与手动上传完全相同的路径(tool.handleFiles):
 * importAsset → inputUrl → inputInfo → 触发各 hook 自身的 autoRun
 * effect(监听 inputId 变化),本 hook 不重复触发执行。
 *
 * 身份语义:按 Blob 实例引用去重。同一实例重复传入不重复导入;
 * 换一个新实例(即使内容相同)重新导入。null / undefined 被忽略
 * (不清空已有输入,清空请用 reset())。
 */
import { useEffect, useRef } from 'react';
import type { UseImageToolResult } from './useImageTool';

/**
 * 把注入的 Blob 导入为工具输入。
 *
 * @param tool useImageTool 实例(提供 ready / handleFiles)
 * @param inputBlob 外部注入的输入 Blob;File 实例直接透传(保留文件名),
 *   普通 Blob 包装为 File(MIME 取自 blob.type)。
 */
export function useInputBlobImport(
  tool: UseImageToolResult,
  inputBlob: Blob | null | undefined
): void {
  /** 已导入的 Blob 引用(去重用) */
  const lastImportedRef = useRef<Blob | null>(null);
  /** 持有最新 tool,避免 effect 依赖整个 tool 对象(每次 render 新建) */
  const toolRef = useRef(tool);
  toolRef.current = tool;

  useEffect(() => {
    if (!inputBlob) return;
    if (inputBlob === lastImportedRef.current) return;
    // runtime 未就绪时跳过;ready 变化后 effect 重跑,届时再导入
    if (!toolRef.current.ready) return;
    lastImportedRef.current = inputBlob;
    const file =
      inputBlob instanceof File
        ? inputBlob
        : new File([inputBlob], 'image', { type: inputBlob.type || 'image/png' });
    void toolRef.current.handleFiles([file]);
  }, [inputBlob, tool.ready]);
}
