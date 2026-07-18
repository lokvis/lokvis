/**
 * G1 · Plan 徽章
 *
 * 显示当前用户计划状态(Free / Pro / Cloud Pro / Enterprise)。
 * 用于工具页 header 与 Playground 顶部,可视化 Pro 门控状态。
 *
 * 设计:小型 inline badge,配色按计划区分:
 * - free:zinc(中性,默认)
 * - pro:indigo(主品牌色)
 * - cloud_pro:紫色渐变(高级感)
 * - enterprise:金色(尊贵)
 */
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';
import type { Plan } from '@lokvis/sdk';

const PLAN_CLASS: Record<Plan, string> = {
  free: 'bg-zinc-800 text-zinc-400',
  pro: 'bg-indigo-600/20 text-indigo-300 ring-1 ring-inset ring-indigo-500/30',
  cloud_pro:
    'bg-gradient-to-r from-purple-600/30 to-indigo-600/30 text-purple-200 ring-1 ring-inset ring-purple-500/40',
  enterprise: 'bg-amber-500/20 text-amber-300 ring-1 ring-inset ring-amber-500/40',
};

const PLAN_KEY: Record<Plan, string> = {
  free: 'plan.free',
  pro: 'plan.pro',
  cloud_pro: 'plan.cloud_pro',
  enterprise: 'plan.enterprise',
};

interface ProBadgeProps {
  plan: Plan;
  /** 可选 className 覆盖(用于精细布局) */
  className?: string;
}

export function ProBadge({ plan, className }: ProBadgeProps) {
  const lang = useLang();
  const t = useTranslations(lang);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${PLAN_CLASS[plan]} ${className ?? ''}`}
    >
      {t(PLAN_KEY[plan])}
    </span>
  );
}
