/**
 * G1 · Plan 模拟切换器
 *
 * Playground 顶部小型 toggle,允许用户在 Free / Pro / Cloud Pro / Enterprise
 * 之间切换,以测试 Pro 门控(四环:batch/concurrency/workflow slots/presets)
 * 与 AI 配额限制。
 *
 * 设计:
 * - 4 个 segmented 按钮,选中态高亮
 * - 切换时通过 `onChange(plan)` 通知父组件,父组件再传入 `useLokvisRuntime({ plan })`
 * - 仅 playground 使用,生产 cloud 站点由 cloud 注入真实 auth
 */
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';
import { ProBadge } from './ProBadge';
import type { Plan } from '@lokvis/sdk';

const PLAN_ORDER: Plan[] = ['free', 'pro', 'cloud_pro', 'enterprise'];

interface PlanToggleProps {
  plan: Plan;
  onChange: (plan: Plan) => void;
}

export function PlanToggle({ plan, onChange }: PlanToggleProps) {
  const lang = useLang();
  const t = useTranslations(lang);

  return (
    <div
      className="flex items-center gap-1.5"
      role="radiogroup"
      aria-label={t('plan.toggle.hint')}
      title={t('plan.toggle.hint')}
    >
      <span className="hidden text-[10px] text-zinc-500 sm:inline">
        {t('plan.toggle.label')}
      </span>
      <div className="flex items-center gap-0.5 rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
        {PLAN_ORDER.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={p === plan}
            onClick={() => onChange(p)}
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
              p === plan
                ? 'bg-indigo-600 text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t(`plan.${p}`)}
          </button>
        ))}
      </div>
      <ProBadge plan={plan} />
    </div>
  );
}
