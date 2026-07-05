/**
 * InstallPrompt — PWA 自定义安装提示(W15.4)
 *
 * 浏览器行为差异:
 *   - Chrome/Edge/Android Chrome:触发 `beforeinstallprompt` 事件,
 *     页面可调用 `event.prompt()` 显示原生安装对话框。
 *     本组件捕获该事件,先展示自定义 UI 引导(更友好的文案 + 截图),
 *     用户点击 "Install" 再调用原生 prompt()。
 *   - iOS Safari:不支持 beforeinstallprompt,无法编程触发安装。
 *     本组件检测 iOS 后展示 "Add to Home Screen" 操作指引。
 *   - Desktop Safari 16+:支持 manifest 但无 beforeinstallprompt,同 iOS 处理。
 *
 * 用户体验:
 *   - 默认在右下角浮出一个卡片,带 Install / Dismiss 按钮
 *   - Dismiss 后 7 天内不再弹出(localStorage 记录时间戳)
 *   - 安装成功后(appinstalled 事件)展示 2 秒成功 toast 然后消失
 *   - 已安装(standalone 模式)永不显示
 *
 * 与 W15.7 的协作:
 *   - `appinstalled` 事件触发后,通知 SW 预加载 top 5 engine 模块
 *   - 同时调用 `preloadTop5Engines()` 在主线程也加载一遍(双保险)
 */

import { useEffect, useState, useCallback } from 'react';
import {
  isStandalone,
  isIosSafari,
  isDismissedInCooldown,
  markDismissed,
} from '../toolkit/pwa-utils.js';

// ─── 类型定义 ────────────────────────────────────────────────────

/**
 * BeforeInstallPromptEvent
 *
 * 浏览器规范仍在演进,TS DOM lib 未包含此类型,本地声明。
 * 参考:https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent
 */
interface BeforeInstallPromptEvent extends Event {
  /** 触发原生安装对话框(每次事件只能调用一次) */
  prompt(): Promise<void>;
  /** 用户选择结果('accepted' | 'dismissed') */
  userChoice: Promise<InstallChoice>;
  /** 安装平台('web' | 'android' | 'ios' | ...) */
  platforms: string[];
}

interface InstallChoice {
  outcome: 'accepted' | 'dismissed';
  platform: string;
}

type InstallState = 'idle' | 'prompting' | 'installed' | 'dismissed';

// ─── 组件 ────────────────────────────────────────────────────────

export interface InstallPromptProps {
  /** 强制显示(调试用,跳过 standalone / cooldown 检查) */
  force?: boolean;
}

export function InstallPrompt({ force = false }: InstallPromptProps) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [state, setState] = useState<InstallState>('idle');
  const [isIos, setIsIos] = useState(false);

  // 挂载时检测 iOS / standalone
  useEffect(() => {
    setIsIos(isIosSafari());
  }, []);

  // 监听 beforeinstallprompt
  useEffect(() => {
    if (force) return; // force 模式不走事件监听
    if (isStandalone()) return; // 已安装不显示
    if (isDismissedInCooldown()) return;

    const handler = (e: Event) => {
      // 阻止浏览器自动弹出迷你提示(更可控的自定义 UI)
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setState('idle');
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [force]);

  // 监听 appinstalled(无论原生 / iOS 手动添加)
  useEffect(() => {
    const handler = () => {
      setState('installed');
      setDeferred(null);
      // engine 预加载由 setupEnginePreloadOnInstalled()(W15.7)独立处理,
      // 本组件只负责 UI 状态切换
      // 2 秒后隐藏成功 toast
      setTimeout(() => setState('dismissed'), 2000);
    };
    window.addEventListener('appinstalled', handler);
    return () => window.removeEventListener('appinstalled', handler);
  }, []);

  // 点击 Install:触发原生 prompt
  const handleInstall = useCallback(async () => {
    if (!deferred) return;
    setState('prompting');
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'accepted') {
        // 等待 appinstalled 事件接管 setState('installed')
        // 不在此处隐藏,由 appinstalled handler 统一处理
      } else {
        markDismissed();
        setState('dismissed');
      }
      // 事件只能用一次,清空
      setDeferred(null);
    } catch (err) {
      console.error('[InstallPrompt] prompt failed:', err);
      setState('idle');
    }
  }, [deferred]);

  // 点击 Dismiss:7 天冷却
  const handleDismiss = useCallback(() => {
    markDismissed();
    setState('dismissed');
  }, []);

  // 不渲染的条件
  if (state === 'dismissed') return null;
  if (state === 'installed') {
    // 简短成功 toast
    return (
      <div className="install-prompt install-prompt--success" role="status">
        <span className="install-prompt__icon">✓</span>
        <span className="install-prompt__text">
          Installed — engines preloading in background
        </span>
      </div>
    );
  }

  // 已安装(standalone)不显示
  if (!force && isStandalone()) return null;

  // iOS:无 beforeinstallprompt,展示操作指引
  if (isIos && !deferred) {
    return (
      <div className="install-prompt" role="dialog" aria-label="Install Lokvis">
        <div className="install-prompt__head">
          <span className="install-prompt__icon">◆</span>
          <div className="install-prompt__titles">
            <div className="install-prompt__title">Install Lokvis</div>
            <div className="install-prompt__desc">
              Tap Share → Add to Home Screen for offline access
            </div>
          </div>
          <button
            className="install-prompt__close"
            onClick={handleDismiss}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  // 等待 beforeinstallprompt 事件(非 iOS)
  if (!deferred && !force) return null;

  // force 模式且无 deferred:展示一个不可点击的占位(用于 Storybook)
  const promptingDisabled = state === 'prompting' || !deferred;

  return (
    <div className="install-prompt" role="dialog" aria-label="Install Lokvis">
      <div className="install-prompt__head">
        <span className="install-prompt__icon">◆</span>
        <div className="install-prompt__titles">
          <div className="install-prompt__title">Install Lokvis Playground</div>
          <div className="install-prompt__desc">
            Work offline · faster startup · preloaded engines
          </div>
        </div>
        <button
          className="install-prompt__close"
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      <button
        className="install-prompt__cta"
        onClick={handleInstall}
        disabled={promptingDisabled}
      >
        {state === 'prompting' ? 'Opening…' : 'Install'}
      </button>

      <style>{`
        .install-prompt {
          position: fixed;
          right: 16px;
          bottom: 16px;
          z-index: 50;
          width: 320px;
          max-width: calc(100vw - 32px);
          padding: 14px 14px 12px;
          border: 1px solid rgb(63 63 70);
          border-radius: 12px;
          background: rgb(9 9 11 / 0.95);
          backdrop-filter: blur(8px);
          color: rgb(228 228 231);
          font-family: ui-sans-serif, system-ui, sans-serif;
          box-shadow: 0 12px 32px rgb(0 0 0 / 0.4);
          animation: ip-slide-up 0.25s ease-out;
        }
        .install-prompt--success {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          width: auto;
          padding: 10px 14px;
          border-color: rgb(34 197 94 / 0.4);
          background: rgb(20 83 45 / 0.4);
        }
        .install-prompt--success .install-prompt__icon {
          background: rgb(34 197 94);
        }
        @keyframes ip-slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .install-prompt__head {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }
        .install-prompt__icon {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          color: #fff;
          font-weight: 700;
          font-size: 14px;
        }
        .install-prompt__titles {
          flex: 1;
          min-width: 0;
        }
        .install-prompt__title {
          font-size: 13px;
          font-weight: 600;
          color: rgb(244 244 245);
        }
        .install-prompt__desc {
          margin-top: 2px;
          font-size: 11px;
          line-height: 1.4;
          color: rgb(161 161 170);
        }
        .install-prompt__close {
          flex-shrink: 0;
          width: 22px;
          height: 22px;
          padding: 0;
          border: none;
          background: transparent;
          color: rgb(113 113 122);
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
          border-radius: 4px;
        }
        .install-prompt__close:hover {
          background: rgb(39 39 42);
          color: rgb(228 228 231);
        }
        .install-prompt__cta {
          margin-top: 12px;
          width: 100%;
          padding: 8px 14px;
          border: none;
          border-radius: 8px;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .install-prompt__cta:hover:not(:disabled) {
          opacity: 0.92;
        }
        .install-prompt__cta:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

export default InstallPrompt;
