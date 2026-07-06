/**
 * OfflineIndicator(W15.5)
 *
 * 离线状态指示，由两部分组成（同文件导出，避免重复状态逻辑）：
 *
 *   1. `OfflineIndicator`（default export）—— 顶部固定 banner
 *      - 离线时 `fixed top-0` 滑入显示："You're offline — cached features still work"
 *      - 在线时滑出隐藏（translate-y + opacity 过渡）
 *      - banner 显示时给 body 加 padding-top，避免遮挡 header
 *      - 关闭按钮可临时收起 banner（状态点仍保留）
 *
 *   2. `OfflineStatusDot`（named export）—— header 右侧小圆点
 *      - 8px 圆点 + "Online"/"Offline" 文字
 *      - 绿色在线 / 红色离线
 *      - 放在 PlaygroundLayout header 右侧，替代/补充 "→ Cloud" 链接
 *
 * 数据源：navigator.onLine + window online/offline 事件，无新依赖。
 */
import { useEffect, useState } from 'react';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

/** banner 高度（px），用于给 body 加等量 padding-top 避免遮挡 header */
const BANNER_HEIGHT_PX = 32;

/** 顶部离线 banner —— 默认导出 */
export default function OfflineIndicator() {
  const lang = useLang();
  const t = useTranslations(lang);
  // Review fix（Minor-9）：用 lazy initializer 读取 navigator.onLine，
  // 避免首帧 flash（原 useState(true) 在离线首帧误显示在线）。
  // client:only="react" 保证仅在客户端渲染，navigator 一定存在。
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  // 用户手动收起 banner（仅本次会话；状态点仍显示真实在线状态）
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update(); // 初始化（SSR 安全：client:only 仅客户端渲染）
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  // banner 可见 = 离线 && 未收起；显示时给 body 加 padding-top 推开 header
  const bannerVisible = !online && !dismissed;
  useEffect(() => {
    if (bannerVisible) {
      document.body.style.paddingTop = `${BANNER_HEIGHT_PX}px`;
    } else {
      document.body.style.paddingTop = '';
    }
    return () => {
      // 卸载时还原，避免遗留 padding
      document.body.style.paddingTop = '';
    };
  }, [bannerVisible]);

  // 在线后重置 dismissed，下次离线重新弹 banner
  useEffect(() => {
    if (online) setDismissed(false);
  }, [online]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-0 right-0 top-0 z-40 flex items-center justify-center gap-3 border-b border-amber-800 bg-amber-950/80 px-4 text-amber-200 backdrop-blur transition-all duration-300 ${
        bannerVisible
          ? 'translate-y-0 opacity-100'
          : '-translate-y-full opacity-0 pointer-events-none'
      }`}
      style={{ height: `${BANNER_HEIGHT_PX}px` }}
    >
      <span className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" aria-hidden />
      <span className="text-[11px] font-medium">
        {t('pwa.offlineBanner')}
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ml-1 rounded px-1.5 py-0.5 text-[10px] text-amber-300/80 transition-colors hover:bg-amber-900/60 hover:text-amber-100"
        aria-label={t('pwa.dismissBanner')}
      >
        ✕
      </button>
    </div>
  );
}

/** header 右侧状态点 —— 命名导出，轻量指示当前在线状态 */
export function OfflineStatusDot() {
  const lang = useLang();
  const t = useTranslations(lang);
  // Review fix（Minor-9）：lazy initializer 读取 navigator.onLine，避免首帧 flash
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return (
    <span
      className="flex items-center gap-1.5 text-[11px]"
      title={online ? t('pwa.onlineTitle') : t('pwa.offlineTitle')}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          online ? 'bg-emerald-500' : 'bg-red-500'
        }`}
        aria-hidden
      />
      <span className={online ? 'text-zinc-500' : 'text-red-400'}>
        {online ? t('pwa.online') : t('pwa.offlineStatus')}
      </span>
    </span>
  );
}
