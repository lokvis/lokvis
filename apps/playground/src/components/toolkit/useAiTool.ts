/**
 * useAiTool — AI 工作流生成器工具页共享 hook。
 *
 * 与 useVideoTool / useAudioTool 对齐,但:
 * - 注入 aiToolsPlugin(浏览器版,无 cloudCaller → 3 个 cloud-proxy 能力走 stub)
 * - 不接受 Asset 输入(generate-workflow 仅消费 prompt 文本)
 * - 输出为 data 类型 Asset(workflow JSON),由 exportAsset 读为 Blob → text → JSON
 *
 * Plan 门控(G1):
 * - free / pro:调用 runGenerateWorkflow 时直接弹 UpgradeDialog(reason='aiQuota'),
 *   不调用 runtime.run()。Pro 解锁四环但不含 AI 配额。
 * - cloud_pro / enterprise:走 runtime.run(),捕获 stub 错误显示 amber 提示
 *   (Playground 不注入 cloudCaller,cloud_pro 也走 stub 路径,提示前往 cloud)。
 *
 * 浏览器版 AI 处理为 stub:实际执行会抛 "not implemented in stub" 错误,
 * UI 层捕获并显示明确提示(引导用户使用 lokvis cloud)。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LokvisAuthSession, LokvisRuntime, Plan, Workflow } from '@lokvis/sdk';
import { createLokvis } from '@lokvis/sdk';
import { aiToolsPlugin } from '@lokvis/plugin-ai';

export interface UseAiToolResult {
  runtime: LokvisRuntime | null;
  ready: boolean;
  initError: string | null;
  /** 当前 plan(由 auth.plan 推导,默认 'free') */
  plan: Plan;
  /** prompt 输入文本 */
  prompt: string;
  setPrompt: (prompt: string) => void;
  /** AI 生成的结果(workflow 对象 / 诊断报告 / 优化结果) */
  result: unknown;
  /** 处理中 */
  busy: boolean;
  /** 错误信息(含 stub 错误提示) */
  error: string | null;
  /** 执行 generate-workflow(plan 门控:free/pro 弹升级提示) */
  runGenerateWorkflow: (prompt: string) => Promise<void>;
  /** 执行 optimize-workflow(可选,plan 门控同上) */
  runOptimizeWorkflow: (workflow: unknown) => Promise<void>;
  /** 执行 diagnose-error(可选,plan 门控同上) */
  runDiagnoseError: (
    error: { message: string; stack?: string },
    workflow?: unknown
  ) => Promise<void>;
  /** 重置 prompt / result / error */
  reset: () => void;
}

/**
 * @param auth 可选的认证信息(用于模拟 plan)。
 *   - 不传或 undefined:free 模式(默认,弹升级提示)
 *   - { plan: 'pro' }:Pro 模式(弹升级提示,Pro 不含 AI 配额)
 *   - { plan: 'cloud_pro' }:Cloud Pro 模式(走 stub,显示 cloud 引导)
 *   - { plan: 'enterprise' }:企业模式(走 stub,显示 cloud 引导)
 *   - onUpgradeRequest:plan 门控触发时回调(由调用方弹出 UpgradeDialog)
 */
export function useAiTool(
  auth?: LokvisAuthSession,
  onUpgradeRequest?: () => void
): UseAiToolResult {
  const [runtime, setRuntime] = useState<LokvisRuntime | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan: Plan = auth?.plan ?? 'free';

  // 用 ref 跟踪最新 auth 与 onUpgradeRequest,避免每次渲染都重建 runtime。
  const authRef = useRef(auth);
  authRef.current = auth;
  const onUpgradeRef = useRef(onUpgradeRequest);
  onUpgradeRef.current = onUpgradeRequest;
  const authKey = plan;

  // 初始化 runtime,注入 aiToolsPlugin(浏览器版无 cloudCaller,3 个 cloud-proxy
  // 能力走 stub)。仅当 plan 变化时才重建。
  useEffect(() => {
    let rt: LokvisRuntime | undefined;
    let cancelled = false;
    (async () => {
      try {
        rt = await createLokvis({
          plugins: [aiToolsPlugin()],
          auth: authRef.current,
        });
        if (cancelled) {
          void rt.cancel('all');
          return;
        }
        setRuntime(rt);
      } catch (err) {
        if (!cancelled) {
          setInitError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
      void rt?.cancel('all');
    };
  }, [authKey]);

  /**
   * 内部:执行 AI workflow(无 Asset 输入,inputs 传 [])。
   *
   * 输出为 data 类型 Asset(JSON blob),由 exportAsset 导出后读为文本并 JSON.parse。
   */
  const runAiWorkflow = useCallback(
    async (workflow: Workflow): Promise<void> => {
      if (!runtime) return;
      setBusy(true);
      setError(null);
      try {
        const runResult = await runtime.run(workflow, []);
        if (runResult.status === 'completed' && runResult.outputs[0]) {
          const blob = await runtime.exportAsset(runResult.outputs[0]);
          const text = await blob.text();
          try {
            setResult(JSON.parse(text));
          } catch {
            // 非 JSON 输出(理论上不会发生,AI 能力始终返回 JSON),原样保存文本
            setResult(text);
          }
        } else {
          setError(runResult.error ?? '处理失败');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [runtime]
  );

  /**
   * 检查 plan 门控:free / pro 触发 UpgradeDialog,
   * 返回 true 表示已拦截(调用方应中止后续 runtime.run())。
   */
  const checkPlanGate = useCallback((): boolean => {
    if (plan === 'free' || plan === 'pro') {
      onUpgradeRef.current?.();
      return true;
    }
    return false;
  }, [plan]);

  const runGenerateWorkflow = useCallback(
    async (promptText: string): Promise<void> => {
      if (checkPlanGate()) return;
      // 动态导入避免组件 mount 即加载 builder(保持与 video tool 一致的延迟)
      const { buildGenerateWorkflowWorkflow } = await import(
        './ai-workflow-builder'
      );
      const wf = buildGenerateWorkflowWorkflow(promptText);
      await runAiWorkflow(wf);
    },
    [checkPlanGate, runAiWorkflow]
  );

  const runOptimizeWorkflow = useCallback(
    async (workflow: unknown): Promise<void> => {
      if (checkPlanGate()) return;
      const { buildOptimizeWorkflowWorkflow } = await import(
        './ai-workflow-builder'
      );
      const wf = buildOptimizeWorkflowWorkflow(workflow);
      await runAiWorkflow(wf);
    },
    [checkPlanGate, runAiWorkflow]
  );

  const runDiagnoseError = useCallback(
    async (
      errObj: { message: string; stack?: string },
      workflow?: unknown
    ): Promise<void> => {
      if (checkPlanGate()) return;
      const { buildDiagnoseErrorWorkflow } = await import(
        './ai-workflow-builder'
      );
      const wf = buildDiagnoseErrorWorkflow(errObj, workflow);
      await runAiWorkflow(wf);
    },
    [checkPlanGate, runAiWorkflow]
  );

  const reset = useCallback(() => {
    setPrompt('');
    setResult(null);
    setError(null);
  }, []);

  return {
    runtime,
    ready: runtime !== null,
    initError,
    plan,
    prompt,
    setPrompt,
    result,
    busy,
    error,
    runGenerateWorkflow,
    runOptimizeWorkflow,
    runDiagnoseError,
    reset,
  };
}
