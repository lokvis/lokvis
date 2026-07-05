/**
 * StatusBar — 在线状态指示(W15.5)
 *
 * 在 Playground 顶部品牌条右侧显示一个小圆点:
 *   - 在线:绿色圆点(几乎不可见,不打扰用户)
 *   - 离线:红色圆点 + "Offline" 文字 + tooltip 提示
 *
 * 实现细节:
 *   - 使用 navigator.onLine + online/offline 事件
 *   - 状态从 pwa-utils.subscribeOnlineStatus 订阅
 *   - 离线时点击可查看详情(toast / 引导安装 PWA)
 *   - SSR 安全(初次渲染默认在线,避免水合不一致)
 *
 * 集成位置:
 *   - PlaygroundLayout 顶部 header 内,与"Cloud"链接同行
 *   - mobile 端隐藏(屏幕窄时只保留品牌)
 */

import { useEffect, useState } from 'react';
import { isOnline, subscribeOnlineStatus } from '../toolkit/pwa-utils.js';

export interface StatusBarProps {
  /** 自定义类名(用于布局微调) */
  className?: string;
}

export function StatusBar({ className = '' }: StatusBarProps) {
  // 初值用 isOnline() 而非直接 navigator.onLine,
  // 保证 SSR 与首次客户端渲染一致(都为 true)
  const [online, setOnline] = useState<boolean>(isOnline);

  useEffect(() => {
    // 同步一次最新状态(SSR 后客户端可能立刻 false)
    setOnline(isOnline());
    const unsubscribe = subscribeOnlineStatus(setOnline);
    return unsubscribe;
  }, []);

  if (online) {
    // 在线状态:几乎不可见的小绿点(不打扰用户)
    return (
      <span
        className={`status-bar status-bar--online ${className}`.trim()}
        title="Online"
        aria-label="Online"
      >
        <span className="status-bar__dot" />
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`status-bar status-bar--offline ${className}`.trim()}
      title="You are offline — cached pages still work"
      aria-label="Offline"
      onClick={() => {
        // 离线时点击:跳转到 offline.html(已有更友好的引导)
        if (typeof window !== 'undefined') {
          window.location.href = '/offline.html';
        }
      }}
    >
      <span className="status-bar__dot" />
      <span className="status-bar__label">Offline</span>
      <style>{`
        .status-bar {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 500;
          border: 1px solid transparent;
          background: transparent;
          color: inherit;
          cursor: default;
          font-family: ui-sans-serif, system-ui, sans-serif;
        }
        .status-bar--online {
          padding: 4px;
          opacity: 0.6;
        }
        .status-bar--online .status-bar__dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgb(34 197 94);
          box-shadow: 0 0 4px rgb(34 197 94 / 0.6);
        }
        .status-bar--offline {
          cursor: pointer;
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.3);
          color: rgb(252 165 165);
        }
        .status-bar--offline:hover {
          background: rgba(239, 68, 68, 0.15);
        }
        .status-bar--offline .status-bar__dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgb(239 68 68);
          animation: sb-pulse 1.6s ease-in-out infinite;
        }
        @keyframes sb-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(0.85); }
        }
        .status-bar__label {
          font-size: 11px;
          line-height: 1;
        }
      `}</style>
    </button>
  );
}

export default StatusBar;
