/**
 * InstallPrompt(W15.4)
 *
 * 捕获浏览器 `beforeinstallprompt` 事件，展示底部固定 banner 引导用户安装 PWA。
 *
 * 行为：
 *   - 监听 beforeinstallprompt → preventDefault + 缓存事件到 ref + 显示 banner
 *   - "Install" → deferredPrompt.prompt() → 等待 userChoice → 按 outcome 反馈
 *   - "Not now" → 隐藏 banner，localStorage 记 dismissedAt，24h 内不再显示
 *   - 监听 appinstalled → 隐藏 banner + console.log 安装成功
 *   - 仅 PROD 显示（dev 模式 beforeinstallprompt 不会触发，加 import.meta.env.PROD 双保险）
 *   - 组件卸载时移除所有事件监听
 *
 * 类型说明：BeforeInstallPromptEvent 不在 TS lib 中，需自定义接口；
 * 事件回调里用单次 `as` 断言（非 `as unknown as` 双断言），符合 AGENTS.md 约定。
 */
import { useEffect, useRef, useState } from 'react';

/** 浏览器原生未在 TS lib 中暴露的 beforeinstallprompt 事件类型 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

/** localStorage key：记录用户点 "Not now" 的时间戳 */
const DISMISSED_KEY = 'lokvis.installprompt.dismissedAt';
/** 24 小时内不再打扰（毫秒） */
const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** 读取 dismissedAt，返回是否仍在冷却期内 */
function isRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_COOLDOWN_MS;
  } catch {
    // localStorage 不可用（隐私模式）→ 视为未最近拒绝，允许显示
    return false;
  }
}

export default function InstallPrompt() {
  // 是否显示 banner
  const [visible, setVisible] = useState(false);
  // 安装结果反馈（用户做出选择后短期展示）
  const [outcome, setOutcome] = useState<'accepted' | 'dismissed' | null>(null);
  // 持有捕获到的 beforeinstallprompt 事件（不参与渲染，用 ref）
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
  // prompt() 进行中标记，避免重复点击
  const promptingRef = useRef(false);

  useEffect(() => {
    if (!import.meta.env.PROD) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      // 阻止浏览器默认 mini-info-bar（Chrome 旧版自动弹窗）
      e.preventDefault();
      // 24h 内被拒绝过则不显示
      if (isRecentlyDismissed()) return;
      deferredRef.current = e as BeforeInstallPromptEvent;
      setOutcome(null);
      setVisible(true);
    };

    const handleAppInstalled = () => {
      deferredRef.current = null;
      setVisible(false);
      setOutcome(null);
      console.log('[InstallPrompt] app installed successfully');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  async function handleInstall() {
    const deferred = deferredRef.current;
    if (!deferred || promptingRef.current) return;
    promptingRef.current = true;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setOutcome(choice.outcome);
      // prompt() 一次性，用完即弃
      deferredRef.current = null;
      // accepted 时不立即隐藏，让用户看到反馈几秒后自然消失；
      // dismissed 时也保留反馈，2s 后隐藏 banner
      window.setTimeout(() => setVisible(false), 2000);
    } catch (err) {
      console.warn('[InstallPrompt] prompt() failed:', err);
      setOutcome('dismissed');
      window.setTimeout(() => setVisible(false), 2000);
    } finally {
      promptingRef.current = false;
    }
  }

  function handleNotNow() {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // localStorage 不可用时静默，仍隐藏 banner
    }
    setVisible(false);
  }

  // dev 模式或未触发 beforeinstallprompt 时不渲染
  if (!import.meta.env.PROD || !visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center px-3 pb-3">
      <div className="w-full max-w-[480px] rounded-lg border border-indigo-500/40 bg-zinc-900/95 px-4 py-3 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-lg" aria-hidden>◆</span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-zinc-100">
              Install Lokvis Playground for offline use
            </div>
            <div className="mt-0.5 text-[10px] text-zinc-500">
              {outcome === 'accepted'
                ? 'Installing… check your home screen shortly.'
                : outcome === 'dismissed'
                ? 'Maybe later — you can install from the browser menu anytime.'
                : 'Add to home screen for fast, offline access.'}
            </div>
          </div>
          {outcome === null ? (
            <div className="flex flex-shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={handleInstall}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-indigo-500"
              >
                Install
              </button>
              <button
                type="button"
                onClick={handleNotNow}
                className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              >
                Not now
              </button>
            </div>
          ) : (
            <span
              className={`flex-shrink-0 text-[11px] font-semibold ${
                outcome === 'accepted' ? 'text-emerald-400' : 'text-zinc-500'
              }`}
            >
              {outcome === 'accepted' ? '✓ Accepted' : 'Dismissed'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
