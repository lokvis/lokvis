/**
 * 自定义工作台示例入口
 *
 * 仅使用 @lokvis/sdk + @lokvis/plugin-image，不依赖 @lokvis/ui-react。
 * 演示：导入图片 -> 构造 image.resize 工作流 -> 执行 -> 预览结果。
 * 同时演示 LokvisError 错误处理体系(W4.2)。
 */
import { createLokvis, DegradationRejectedError, fromLokvisError } from '@lokvis/sdk';
import type { LokvisRuntime } from '@lokvis/runtime';
import { imageToolsPlugin } from '@lokvis/plugin-image';
import type { Workflow } from '@lokvis/schema';

// DOM 引用
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const widthInput = document.getElementById('width') as HTMLInputElement;
const heightInput = document.getElementById('height') as HTMLInputElement;
const resizeBtn = document.getElementById('resize-btn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLParagraphElement;
const originalPreview = document.getElementById(
  'original-preview'
) as HTMLImageElement;
const resultPreview = document.getElementById(
  'result-preview'
) as HTMLImageElement;

// 运行时单例与当前输入资产 ID
let runtime: LokvisRuntime;
let inputAssetId: string | null = null;

function setStatus(message: string, isError = false): void {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

/** 初始化 Runtime，加载图像工具插件 */
async function init(): Promise<void> {
  runtime = await createLokvis({
    plugins: [imageToolsPlugin()],
  });
  setStatus('Runtime ready.');
}

/** 用户选择文件后导入为 Asset */
async function onFileChange(): Promise<void> {
  const file = fileInput.files?.[0];
  if (!file) return;

  // 本地预览原图
  originalPreview.src = URL.createObjectURL(file);
  originalPreview.hidden = false;
  resultPreview.hidden = true;

  setStatus('Importing…');
  inputAssetId = await runtime.importAsset({ kind: 'file', file });
  resizeBtn.disabled = false;
  setStatus(`Imported asset: ${inputAssetId}`);
}

/** 构造一个只含 image.resize 的线性工作流 */
function buildResizeWorkflow(width: number, height: number): Workflow {
  return {
    id: 'custom-resize-workflow',
    version: '1.0.0',
    name: 'Custom Resize',
    description: 'Resize an image to a fixed dimension.',
    author: { id: 'example', name: 'Custom Workspace Example' },
    category: 'image',
    tags: ['resize', 'example'],
    nodes: [
      // load / export 节点由 Runtime 跳过，仅 transform 节点会真正执行
      { id: 'n-load', type: 'load', capability: 'asset.load' },
      {
        id: 'n-resize',
        type: 'transform',
        capability: 'image.resize',
        params: { width, height, fit: 'cover', maintainAspectRatio: true },
        label: 'Resize',
      },
      { id: 'n-export', type: 'export', capability: 'asset.export' },
    ],
    edges: [
      { from: 'n-load', to: 'n-resize' },
      { from: 'n-resize', to: 'n-export' },
    ],
    inputs: { type: 'image', multiple: false, accept: ['image/*'] },
    outputs: { type: 'image', format: 'png' },
  };
}

/** 点击 Resize：运行工作流并预览输出 */
async function onResize(): Promise<void> {
  if (!inputAssetId) return;
  resizeBtn.disabled = true;
  setStatus('Running workflow…');

  try {
    const width = Number(widthInput.value);
    const height = Number(heightInput.value);
    const workflow = buildResizeWorkflow(width, height);

    // runtime.run 接受 AssetId[] 或 Asset[]
    const result = await runtime.run(workflow, [inputAssetId]);
    if (result.status !== 'completed' || result.outputs.length === 0) {
      throw new Error(result.error || `Workflow ${result.status}`);
    }

    // 导出输出 Asset 为 Blob 并预览
    const blob = await runtime.exportAsset(result.outputs[0]!);
    resultPreview.src = URL.createObjectURL(blob);
    resultPreview.hidden = false;
    setStatus(`Done in ${result.duration}ms.`);
  } catch (err) {
    // 用 LokvisError 体系归一错误,按 code 分支处理(W4.2)
    // fromLokvisError() 总是返回 LokvisError,无需 instanceof LokvisError 守卫;
    // DegradationRejectedError 是 LokvisError 子类,先判断以访问 guide 字段。
    const lokvisErr = fromLokvisError(err);
    if (lokvisErr instanceof DegradationRejectedError) {
      setStatus(`图片过大被拒绝:${lokvisErr.guide[0] ?? ''}`, true);
    } else {
      switch (lokvisErr.code) {
        case 'STORAGE_QUOTA_EXCEEDED': {
          // context.usage 是 unknown,需类型守卫后用于模板字符串
          const usage = lokvisErr.context?.usage;
          const usageStr = typeof usage === 'number' ? String(usage) : '?';
          setStatus(`存储已满(已用 ${usageStr} 字节),请清理资产后重试`, true);
          break;
        }
        default:
          setStatus(`[${lokvisErr.code}] ${lokvisErr.message}`, true);
      }
    }
  } finally {
    resizeBtn.disabled = false;
  }
}

fileInput.addEventListener('change', onFileChange);
resizeBtn.addEventListener('click', onResize);

void init();
