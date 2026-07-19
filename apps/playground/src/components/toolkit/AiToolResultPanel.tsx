/**
 * AiToolResultPanel — AI 工具页尾部 UI(错误提示 + 结果 JSON 预览)。
 *
 * 与 VideoToolResultPanel / AudioToolResultPanel 对齐,但大幅简化:
 * - 无 UploadBox(AI 不需要文件输入,仅消费 prompt 文本)
 * - 无 Input/Output 对比(只有输出,无输入文件)
 * - 结果用 <pre> 格式化显示 JSON(workflow 对象 / 诊断报告 / 优化结果)
 * - stub 错误时显示 amber 色 banner + t('ai.stubHint') 文案
 *   (Playground 无 cloudCaller,cloud-proxy 能力走 stub,提示前往 lokvis cloud)
 *
 * 抽出此组件后,AI 工具页只需关注 prompt 输入区与按钮逻辑。
 */
import type { UseAiToolResult } from './useAiTool';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

export interface AiToolResultPanelProps {
  tool: UseAiToolResult;
  /** "应用此 Workflow" 按钮回调(暂占位,由调用方决定是否实装) */
  onApply?: (result: unknown) => void;
  /** 应用按钮文案(由调用方传入 i18n key 解析后的字符串) */
  applyLabel?: string;
  /** 结果区标题文案(如 "生成结果") */
  resultLabel?: string;
  /** 无结果时的占位文案 */
  noResultLabel?: string;
}

export function AiToolResultPanel({
  tool,
  onApply,
  applyLabel,
  resultLabel,
  noResultLabel,
}: AiToolResultPanelProps) {
  const lang = useLang();
  const t = useTranslations(lang);

  const isStubError = tool.error?.includes('not implemented in stub');

  return (
    <>
      {tool.initError && (
        <p className="text-xs text-red-400">
          {t('common.initFailedPrefix')}
          {tool.initError}
        </p>
      )}
      {tool.error && (
        <div
          className={`rounded border p-2 text-xs ${
            isStubError
              ? 'border-amber-700 bg-amber-950/30 text-amber-300'
              : 'border-red-800 bg-red-950/30 text-red-400'
          }`}
        >
          {tool.error}
          {isStubError && (
            <p className="mt-1 text-[10px] text-amber-400/80">
              {t('ai.stubHint')}
            </p>
          )}
        </div>
      )}

      {/* 结果 JSON 预览 */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-zinc-800">
        <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-3 py-2">
          <span className="text-[11px] font-semibold text-zinc-400">
            {resultLabel ?? t('ai.generate.resultLabel')}
          </span>
          {tool.result != null && onApply && (
            <button
              type="button"
              onClick={() => onApply(tool.result)}
              className="rounded border border-indigo-700/40 bg-indigo-900/20 px-2 py-0.5 text-[10px] font-medium text-indigo-300 transition-colors hover:bg-indigo-800/30"
            >
              {applyLabel ?? t('ai.generate.applyBtn')}
            </button>
          )}
        </header>
        <div className="flex h-64 items-stretch justify-center bg-zinc-950 p-2">
          {tool.result == null ? (
            <p className="self-center text-[11px] text-zinc-600">
              {noResultLabel ?? t('ai.generate.noResult')}
            </p>
          ) : (
            <pre className="w-full overflow-auto text-left text-[11px] leading-relaxed text-emerald-300">
              <code>{JSON.stringify(tool.result, null, 2)}</code>
            </pre>
          )}
        </div>
      </div>
    </>
  );
}
