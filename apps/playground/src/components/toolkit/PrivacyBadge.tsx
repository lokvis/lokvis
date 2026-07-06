/**
 * PrivacyBadge — 隐私声明指示器 + 断网验证(W8.8)。
 *
 * 在工具页顶部显示"文件未上传"声明,并提供"断网验证"交互:
 *   1. 用户点击"断网验证" → 弹出指引(关闭 Wi-Fi / 拔网线 / 启用浏览器离线模式)
 *   2. 监听 window online/offline 事件,检测到离线后变绿色"✓ 断网模式 · 仍在工作"
 *   3. 用户继续操作工具页,证明本地处理不依赖网络
 *
 * 设计原则:
 *   - 不主动断网(无 API 能力,且会影响其它标签页),仅提供指引 + 检测
 *   - 离线状态下所有 image.* capability 应仍可工作(canvas 引擎纯本地)
 *   - 隐私声明始终可见(默认浅色),离线时变绿色高亮"已验证"
 */
import { useEffect, useState } from 'react';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';
import type { Language } from '@/i18n/config';

export interface PrivacyBadgeProps {
  /** 由 Astro SSR 注入的语言（避免 client:load 组件 SSR/客户端 lang 不一致导致闪烁） */
  lang?: Language;
}

export function PrivacyBadge({ lang: langProp }: PrivacyBadgeProps = {}) {
  // 优先使用 SSR 注入的 lang；否则回退到 useLang（client:only 场景）
  const hookLang = useLang();
  const lang = langProp ?? hookLang;
  const t = useTranslations(lang);
  const [online, setOnline] = useState<boolean>(true);
  const [showGuide, setShowGuide] = useState(false);

  // 监听浏览器在线/离线事件
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update(); // 初始化
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  // 离线时自动收起指引(已进入验证模式)
  useEffect(() => {
    if (!online) setShowGuide(false);
  }, [online]);

  return (
    <div
      className={`relative flex items-center gap-2 rounded-md border px-3 py-1.5 text-[11px] transition-colors ${
        online
          ? 'border-zinc-800 bg-zinc-900/50 text-zinc-400'
          : 'border-emerald-700/50 bg-emerald-900/20 text-emerald-300'
      }`}
    >
      <span aria-hidden>{online ? '🔒' : '✓'}</span>
      <span>
        {online ? (
          <>{t('privacy.onlineMsg')}</>
        ) : (
          <strong>{t('privacy.offlineMsg')}</strong>
        )}
      </span>
      <span className="mx-1 text-zinc-700">·</span>
      <span className={`flex items-center gap-1 ${online ? 'text-zinc-500' : 'text-emerald-400'}`}>
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            online ? 'bg-emerald-500' : 'bg-emerald-400'
          }`}
          aria-hidden
        />
        {online ? t('privacy.online') : t('privacy.offline')}
      </span>
      {online && (
        <button
          type="button"
          onClick={() => setShowGuide((s) => !s)}
          className="ml-auto rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        >
          {t('privacy.verify')}
        </button>
      )}
      {showGuide && online && (
        <div className="absolute right-4 top-12 z-50 w-72 rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-[11px] text-zinc-300 shadow-xl">
          <div className="mb-1.5 font-semibold text-zinc-100">{t('privacy.guideTitle')}</div>
          <ol className="list-decimal space-y-1 pl-4">
            <li>{t('privacy.guide1')}</li>
            <li>{t('privacy.guide2')}</li>
            <li>{t('privacy.guide3')}</li>
          </ol>
          <p className="mt-2 text-[10px] text-zinc-500">
            {t('privacy.guideHint')}
          </p>
          <button
            type="button"
            onClick={() => setShowGuide(false)}
            className="mt-2 text-[10px] text-indigo-400 hover:text-indigo-300"
          >
            {t('privacy.close')}
          </button>
        </div>
      )}
    </div>
  );
}
