/**
 * Demo 2: Image Workflow
 *
 * 完整工作流执行示例：
 *   1. importAsset 上传图片
 *   2. run(workflow, [assetId]) 执行多节点工作流
 *      - image.resize 调整尺寸
 *      - image.watermark 加水印
 *   3. exportAsset 导出结果
 *
 * 展示 Workflow 数据结构（nodes/edges）与 WorkflowResult。
 */
import { useEffect, useState, useRef } from 'react';
import { createLokvis } from '@lokvis/sdk';
import type { LokvisRuntime, Workflow, WorkflowResult, AssetId } from '@lokvis/sdk';
import { imageToolsPlugin } from '@lokvis/plugin-image';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

type Stage = 'idle' | 'running' | 'done' | 'failed';

export default function ImageWorkflowDemo() {
  return (
    <ErrorBoundary>
      <ImageWorkflowDemoContent />
    </ErrorBoundary>
  );
}

function ImageWorkflowDemoContent() {
  const lang = useLang();
  const t = useTranslations(lang);
  const [runtime, setRuntime] = useState<LokvisRuntime | null>(null);
  const [inputId, setInputId] = useState<AssetId | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watermarkText, setWatermarkText] = useState('Lokvis');
  const [targetWidth, setTargetWidth] = useState(800);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let rt: LokvisRuntime | undefined;
    (async () => {
      rt = await createLokvis({ plugins: [imageToolsPlugin()] });
      setRuntime(rt);
    })();
    return () => void rt?.cancel('all');
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!runtime || !e.target.files?.length) return;
    try {
      const file = e.target.files[0];
      const id = await runtime.importAsset({ kind: 'file', file });
      setInputId(id);
      setOutputUrl(null);
      setResult(null);
      setError(null);
      setStage('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStage('failed');
    }
  }

  async function handleRun() {
    if (!runtime || !inputId) return;
    setStage('running');
    setError(null);
    setOutputUrl(null);

    const workflow: Workflow = {
      id: `demo-img-${Date.now()}`,
      version: '1.0',
      name: 'Playground Image Workflow',
      description: 'resize → watermark',
      author: { id: 'playground', name: 'Playground' },
      category: 'image',
      tags: ['demo'],
      nodes: [
        { id: 'n1', type: 'transform', capability: 'image.resize', params: { width: targetWidth, height: 0, fit: 'inside' } },
        { id: 'n2', type: 'transform', capability: 'image.watermark', params: { text: watermarkText, fontSize: 24, color: '#ffffff', opacity: 0.6, position: 'bottom-right' } },
      ],
      edges: [
        { from: 'n1', to: 'n2' },
      ],
      inputs: { type: 'image', multiple: false },
      outputs: { type: 'image' },
    };

    try {
      const res = await runtime.run(workflow, [inputId]);
      setResult(res);
      if (res.status === 'completed' && res.outputs.length > 0) {
        const blob = await runtime.exportAsset(res.outputs[0]);
        setOutputUrl(URL.createObjectURL(blob));
        setStage('done');
      } else if (res.status === 'failed') {
        setError(res.error ?? 'Workflow failed');
        setStage('failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStage('failed');
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">{t('image.title')}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">{t('image.subtitle')}</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {/* 参数面板 */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">{t('image.targetWidth')}</span>
            <input
              type="number"
              min={16}
              max={4000}
              value={targetWidth}
              onChange={(e) => setTargetWidth(Number(e.target.value) || 800)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-zinc-500">{t('image.watermarkText')}</span>
            <input
              type="text"
              value={watermarkText}
              onChange={(e) => setWatermarkText(e.target.value)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <div className="flex items-end">
            <button
              onClick={handleRun}
              disabled={!runtime || !inputId || stage === 'running'}
              className="w-full rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {stage === 'running' ? t('common.running') : t('common.runWorkflow')}
            </button>
          </div>
        </div>

        {/* 输入/输出对比 */}
        <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
          {/* 输入 */}
          <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-800">
            <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-3 py-2">
              <span className="text-[11px] font-semibold text-zinc-400">{t('common.input')}</span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] text-indigo-400 hover:text-indigo-300"
              >
                {t('common.upload')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUpload}
              />
            </header>
            <div className="flex flex-1 items-center justify-center bg-zinc-950 p-2">
              {inputId ? (
                <InputPreview runtime={runtime} assetId={inputId} />
              ) : (
                <p className="text-[11px] text-zinc-600">{t('common.selectImageHint')}</p>
              )}
            </div>
          </div>

          {/* 输出 */}
          <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-800">
            <header className="border-b border-zinc-800 bg-zinc-900/50 px-3 py-2">
              <span className="text-[11px] font-semibold text-zinc-400">
                {t('common.output')} {result && `· ${result.status}`}
              </span>
            </header>
            <div className="flex flex-1 items-center justify-center bg-zinc-950 p-2">
              {stage === 'running' && (
                <div className="text-[11px] text-zinc-500">{t('common.processingHint')}</div>
              )}
              {stage === 'failed' && (
                <div className="px-3 text-center text-[11px] text-red-400">{error}</div>
              )}
              {outputUrl && (
                <img src={outputUrl} alt="Output" className="max-h-full max-w-full object-contain" />
              )}
              {stage === 'idle' && !outputUrl && (
                <p className="text-[11px] text-zinc-600">{t('common.outputWillAppear')}</p>
              )}
            </div>
          </div>
        </div>

        {/* 工作流 JSON */}
        {result && (
          <details className="rounded-lg border border-zinc-800 bg-zinc-900/30">
            <summary className="cursor-pointer px-3 py-2 text-[11px] font-medium text-zinc-400">
              {t('common.workflowResultJson')}
            </summary>
            <pre className="overflow-auto p-3 font-mono text-[10px] text-zinc-300">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

/** 加载输入资产并显示预览（用 objectURL 避免污染 runtime 状态） */
function InputPreview({ runtime, assetId }: { runtime: LokvisRuntime | null; assetId: AssetId }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoke: string | null = null;
    (async () => {
      if (!runtime) return;
      try {
        const blob = await runtime.exportAsset(assetId);
        revoke = URL.createObjectURL(blob);
        setUrl(revoke);
      } catch {
        setUrl(null);
      }
    })();
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [runtime, assetId]);

  if (!url) return <span className="text-[10px] text-zinc-600">{t('common.loading')}</span>;
  return <img src={url} alt="Input" className="max-h-full max-w-full object-contain" />;
}
