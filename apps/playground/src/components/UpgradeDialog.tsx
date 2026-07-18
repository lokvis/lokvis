/**
 * G1 · 升级提示对话框
 *
 * 当 Free 用户触达四环门控(batch/workflow/presets)或 AI 配额限制时弹出,
 * 显示具体原因 + 升级 CTA(链接到 cloud-bridge 配置的 upgradeUrl)。
 *
 * 用法:
 * ```tsx
 * const [upgrade, setUpgrade] = useState<UpgradeReason | null>(null);
 * try { ... } catch (err) {
 *   if (err instanceof BatchLimitExceededError) setUpgrade('batchLimit');
 * }
 * <UpgradeDialog reason={upgrade} onClose={() => setUpgrade(null)} />
 * ```
 *
 * 设计:
 * - Modal 形式(覆盖全屏),Escape 键关闭
 * - reason 决定文案,upgradeUrl 来自 cloud-bridge 默认值或调用方注入
 * - 不依赖第三方 modal 库,纯 Tailwind + 原生 dialog 行为
 */
import { useEffect } from 'react';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

/** 升级原因(决定文案) */
export type UpgradeReason =
  | 'batchLimit'
  | 'workflowLimit'
  | 'presetLimit'
  | 'aiQuota'
  | 'generic';

const REASON_KEY: Record<UpgradeReason, string> = {
  batchLimit: 'upgrade.reasonBatchLimit',
  workflowLimit: 'upgrade.reasonWorkflowLimit',
  presetLimit: 'upgrade.reasonPresetLimit',
  aiQuota: 'upgrade.reasonAiQuota',
  generic: 'upgrade.reasonGeneric',
};

interface UpgradeDialogProps {
  /** null 时对话框不显示;非 null 时显示对应 reason 文案 */
  reason: UpgradeReason | null;
  /** 关闭回调(用户点击"稍后"或 Escape 或遮罩) */
  onClose: () => void;
  /** 升级 URL(默认 cloud-bridge 的 https://app.lokvis.com/billing) */
  upgradeUrl?: string;
}

export function UpgradeDialog({
  reason,
  onClose,
  upgradeUrl = 'https://app.lokvis.com/billing',
}: UpgradeDialogProps) {
  const lang = useLang();
  const t = useTranslations(lang);

  // Escape 键关闭
  useEffect(() => {
    if (!reason) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reason, onClose]);

  if (!reason) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-title"
    >
      <div
        className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id="upgrade-title"
            className="text-base font-semibold text-zinc-100"
          >
            {t('upgrade.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 transition-colors hover:text-zinc-300"
            aria-label={t('upgrade.close')}
          >
            ✕
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          {t(REASON_KEY[reason])}
        </p>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            {t('upgrade.later')}
          </button>
          <a
            href={upgradeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            {t('upgrade.cta')}
          </a>
        </div>
      </div>
    </div>
  );
}
