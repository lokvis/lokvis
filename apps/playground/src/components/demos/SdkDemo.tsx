/**
 * Demo: SDK Basics (W14.2)
 *
 * 展示 @lokvis/sdk 的"hello world"用法 —— 5 步入门：
 *   1. createLokvis()        工厂初始化
 *   2. capabilities()        能力声明查询
 *   3. importAsset()         资产导入
 *   4. run(workflow, inputs) 单节点工作流执行
 *   5. exportAsset()         结果导出（触发浏览器下载）
 *
 * 单列垂直流，自上而下逐步推进，每一步以前置步骤完成为前提。
 */
import { useEffect, useState, useRef } from 'react';
import { createLokvis } from '@lokvis/sdk';
import type { LokvisRuntime, Capability, AssetId, Workflow, WorkflowResult } from '@lokvis/sdk';
import { imageToolsPlugin } from '@lokvis/plugin-image';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

const SAMPLE_CODE = `import { createLokvis } from '@lokvis/sdk';
import { imageToolsPlugin } from '@lokvis/plugin-image';

// 1. 初始化 Runtime
const rt = await createLokvis({ plugins: [imageToolsPlugin()] });

// 2. 查询能力
const caps = await rt.capabilities();

// 3. 导入资产
const assetId = await rt.importAsset({ kind: 'file', file });

// 4. 执行单节点工作流
const result = await rt.run(
  {
    id: 'demo-resize',
    version: '1.0',
    name: 'Resize',
    author: { id: 'playground', name: 'Playground' },
    category: 'image',
    nodes: [{ id: 'n1', type: 'transform', capability: 'image.resize', params: { width: 400 } }],
    edges: [],
    inputs: { type: 'image', multiple: false },
    outputs: { type: 'image' },
  },
  [assetId],
);

// 5. 导出结果
const blob = await rt.exportAsset(result.outputs[0]);`;

/** 按 namespace 前缀（首段）分组 capability */
function groupByCategory(caps: Capability[]): Record<string, Capability[]> {
  const groups: Record<string, Capability[]> = {};
  for (const c of caps) {
    const key = c.name.split('.')[0] ?? 'other';
    (groups[key] ??= []).push(c);
  }
  return groups;
}

export default function SdkDemo() {
  return (
    <ErrorBoundary>
      <SdkDemoContent />
    </ErrorBoundary>
  );
}

function SdkDemoContent() {
  const lang = useLang();
  const t = useTranslations(lang);
  const [runtime, setRuntime] = useState<LokvisRuntime | null>(null);
  const [caps, setCaps] = useState<Capability[]>([]);
  const [inputId, setInputId] = useState<AssetId | null>(null);
  const [inputName, setInputName] = useState<string | null>(null);
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let rt: LokvisRuntime | undefined;
    let cancelled = false;
    (async () => {
      try {
        rt = await createLokvis({ plugins: [imageToolsPlugin()] });
        if (cancelled) {
          void rt.cancel('all');
          return;
        }
        const caps = await rt.capabilities();
        if (cancelled) return;
        setRuntime(rt);
        setCaps(caps);
      } catch (err) {
        console.error('[SdkDemo] init failed:', err);
      }
    })();
    return () => {
      cancelled = true;
      void rt?.cancel('all');
    };
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!runtime || !e.target.files?.length) return;
    setError(null);
    try {
      const file = e.target.files[0];
      const id = await runtime.importAsset({ kind: 'file', file });
      setInputId(id);
      setInputName(file.name);
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRun() {
    if (!runtime || !inputId) return;
    setRunning(true);
    setError(null);
    setResult(null);

    const workflow: Workflow = {
      id: `demo-sdk-${Date.now()}`,
      version: '1.0',
      name: 'SDK Basics Resize',
      description: 'single-node resize (width=400)',
      author: { id: 'playground', name: 'Playground' },
      category: 'image',
      tags: ['demo'],
      nodes: [
        { id: 'n1', type: 'transform', capability: 'image.resize', params: { width: 400, height: 0, fit: 'inside' } },
      ],
      edges: [],
      inputs: { type: 'image', multiple: false },
      outputs: { type: 'image' },
    };

    try {
      const res = await runtime.run(workflow, [inputId]);
      setResult(res);
      if (res.status === 'failed') setError(res.error ?? 'Workflow failed');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  async function handleDownload() {
    if (!runtime || !result || result.status !== 'completed' || result.outputs.length === 0) return;
    try {
      const blob = await runtime.exportAsset(result.outputs[0]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lokvis-resized-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(SAMPLE_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard 不可用时静默 */
    }
  }

  const groups = groupByCategory(caps);
  const ready = runtime !== null;
  const canRun = ready && inputId !== null && !running;
  const canDownload = result?.status === 'completed' && result.outputs.length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">{t('sdk.title')}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">{t('sdk.subtitle')}</p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {/* 状态卡 */}
          <div
            className={`rounded-lg border px-3 py-2 text-xs ${
              ready
                ? 'border-emerald-800/50 bg-emerald-950/30 text-emerald-300'
                : 'border-zinc-800 bg-zinc-900/50 text-zinc-500'
            }`}
          >
            {ready ? (
              <span>
                <span className="mr-1.5">●</span>{t('sdk.runtimeReady')} · {caps.length}{t('sdk.capabilitiesUnit')}
              </span>
            ) : (
              <span className="animate-pulse">{t('sdk.initRuntime')}</span>
            )}
          </div>

          {/* 步骤 1: createLokvis */}
          <StepRow index={1} title="createLokvis()" hint={t('sdk.step1Hint')}>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="rounded bg-zinc-900 px-2 py-1 font-mono text-indigo-400">lokvis-image-tools</span>
              <span className="text-zinc-600">@</span>
              <span className="rounded bg-zinc-900 px-2 py-1 font-mono text-zinc-400">0.1.0</span>
            </div>
          </StepRow>

          {/* 步骤 2: capabilities */}
          <StepRow index={2} title="capabilities()" hint={`${t('sdk.step2HintPrefix')}${caps.length}${t('sdk.step2HintSuffix')}`}>
            <div className="flex flex-col gap-2">
              {Object.entries(groups).length === 0 ? (
                <p className="text-[11px] text-zinc-600">
                  {ready ? t('sdk.capabilitiesEmpty') : t('common.loading')}
                </p>
              ) : (
                Object.entries(groups).map(([cat, list]) => (
                  <div key={cat} className="rounded border border-zinc-800 bg-zinc-900/30">
                    <div className="border-b border-zinc-800/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      {cat}.* ({list.length})
                    </div>
                    <ul className="divide-y divide-zinc-800/40">
                      {list.map((c) => (
                        <li key={c.name} className="px-2 py-1.5">
                          <div className="font-mono text-[11px] text-indigo-400">{c.name}</div>
                          <div className="mt-0.5 text-[10px] text-zinc-500">{c.description}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </StepRow>

          {/* 步骤 3: importAsset */}
          <StepRow index={3} title="importAsset()" hint={t('sdk.step3Hint')}>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!ready}
                className="rounded bg-indigo-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {t('sdk.upload')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUpload}
              />
              {inputName ? (
                <div className="min-w-0 flex-1 truncate text-[11px] text-zinc-300">
                  <span className="text-zinc-500">{inputName}</span>
                  <span className="ml-2 font-mono text-[10px] text-emerald-400">{inputId}</span>
                </div>
              ) : (
                <span className="text-[11px] text-zinc-600">{t('common.noFileSelected')}</span>
              )}
            </div>
          </StepRow>

          {/* 步骤 4: run */}
          <StepRow index={4} title="run(workflow, [assetId])" hint={t('sdk.step4Hint')}>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRun}
                  disabled={!canRun}
                  className="rounded bg-indigo-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {running ? t('sdk.running') : t('sdk.run')}
                </button>
                {result && (
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                      result.status === 'completed'
                        ? 'bg-emerald-950 text-emerald-400'
                        : result.status === 'failed'
                        ? 'bg-red-950 text-red-400'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {result.status} · {result.duration}ms
                  </span>
                )}
              </div>
              {result && result.outputs.length > 0 && (
                <div className="rounded bg-zinc-900/50 px-2 py-1.5 text-[10px] text-zinc-400">
                  outputs[0] = <span className="font-mono text-emerald-400">{result.outputs[0]}</span>
                </div>
              )}
              {error && <div className="text-[10px] text-red-400">{error}</div>}
            </div>
          </StepRow>

          {/* 步骤 5: exportAsset */}
          <StepRow index={5} title="exportAsset()" hint={t('sdk.step5Hint')}>
            <button
              onClick={handleDownload}
              disabled={!canDownload}
              className="rounded bg-indigo-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('sdk.download')}
            </button>
          </StepRow>

          {/* 示例代码 */}
          <details className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/30">
            <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-[11px] font-medium text-zinc-400 hover:text-zinc-200">
              <span>{t('sdk.sampleSdkCode')}</span>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleCopyCode();
                }}
                className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-700"
              >
                {copied ? t('sdk.copiedCheck') : t('sdk.copyCode')}
              </button>
            </summary>
            <pre className="overflow-auto border-t border-zinc-800 p-3 font-mono text-[10px] leading-relaxed text-zinc-300">
              {SAMPLE_CODE}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}

/** 步骤行：左侧编号徽标 + 右侧标题/内容 */
function StepRow({
  index,
  title,
  hint,
  children,
}: {
  index: number;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
        {index}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[12px] font-semibold text-zinc-100">{title}</div>
        <div className="mb-2 text-[10px] text-zinc-500">{hint}</div>
        {children}
      </div>
    </section>
  );
}
