/**
 * AI Workflow Generator 工具页(Phase 3 · I1)
 *
 * 输入 prompt 文本 → 调用 ai.generate-workflow → 输出 workflow JSON
 *
 * 浏览器版 plugin-ai 为 stub(无 cloudCaller 注入),执行时会抛
 * "not implemented in stub" 错误,AiToolResultPanel 显示 amber 色 stub 错误提示,
 * 引导用户前往 lokvis cloud 使用真实 AI。
 *
 * Plan 门控(G1):
 * - free / pro:点击"生成 Workflow"时弹 UpgradeDialog(reason='aiQuota'),
 *   不调用 runtime.run()。Pro 解锁四环但不含 AI 配额。
 * - cloud_pro / enterprise:走 runtime.run(),捕获 stub 错误显示 amber 提示
 *   (Playground 不注入 cloudCaller,cloud_pro 也走 stub,显示 cloud 引导)。
 *
 * Open Core 边界:Playground 不注入 cloudCaller,避免 API Key 暴露。
 * 真实 AI 调用需在 lokvis cloud(闭源)中通过 cloud-bridge CloudAiClient 实装。
 */
import { useCallback, useState } from 'react';
import type { Plan } from '@lokvis/sdk';
import { useAiTool } from '@/components/toolkit/useAiTool';
import { AiToolResultPanel } from '@/components/toolkit/AiToolResultPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PlanToggle } from '@/components/PlanToggle';
import { UpgradeDialog, type UpgradeReason } from '@/components/UpgradeDialog';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

export default function AiWorkflowGeneratorTool() {
  return (
    <ErrorBoundary>
      <AiWorkflowGeneratorToolContent />
    </ErrorBoundary>
  );
}

function AiWorkflowGeneratorToolContent() {
  const lang = useLang();
  const t = useTranslations(lang);
  // G1:plan 模拟(默认 free)。切换时 useAiTool 重建 runtime,触发 AI 配额门控。
  const [plan, setPlan] = useState<Plan>('free');
  // G1:升级提示状态(null=不显示,UpgradeReason=显示对应文案)
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(null);

  const handleUpgradeRequest = useCallback(() => {
    setUpgradeReason('aiQuota');
  }, []);

  const tool = useAiTool({ plan }, handleUpgradeRequest);

  const handleGenerate = useCallback(async () => {
    const promptText = tool.prompt.trim();
    if (!promptText || !tool.ready || tool.busy) return;
    await tool.runGenerateWorkflow(promptText);
  }, [tool]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div>
          <h1 className="text-sm font-semibold text-zinc-100">
            {t('ai.generate.title')}
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            {t('ai.generate.subtitle')}
          </p>
        </div>
        {/* G1:Plan 模拟切换器(测试 AI 配额门控) */}
        <PlanToggle plan={plan} onChange={setPlan} />
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {/* Prompt 输入区 */}
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium text-zinc-500">
            {t('ai.generate.promptLabel')}
          </span>
          <textarea
            value={tool.prompt}
            onChange={(e) => tool.setPrompt(e.target.value)}
            placeholder={t('ai.generate.promptPlaceholder')}
            rows={6}
            className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
          />
        </label>

        {/* 上下文资产选择(暂占位,不实装真实选择) */}
        <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 px-3 py-2 text-[10px] text-zinc-600">
          {t('ai.generate.contextPlaceholder')}
        </div>

        {/* 生成按钮 */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!tool.ready || !tool.prompt.trim() || tool.busy}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-24 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tool.busy ? t('ai.generate.busy') : t('ai.generate.btn')}
          </button>
        </div>

        <AiToolResultPanel
          tool={tool}
          onApply={() => {
            // 暂占位:不实装真实应用(后续 Phase 3 集成 Workflow 编辑器)
          }}
        />
      </div>

      {/* G1:升级提示对话框(free/pro 用户触达 AI 配额时弹出) */}
      <UpgradeDialog
        reason={upgradeReason}
        onClose={() => setUpgradeReason(null)}
      />
    </div>
  );
}
