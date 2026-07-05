/**
 * EngineLoader — 首次加载 Engine 介绍动画 + 进度条(W15.8)
 *
 * 用户首次访问 Playground 时,展示一个全屏引导:
 *   - 品牌动画:渐变光晕旋转 + "Lokvis" 字标
 *   - 5 个 engine 模块的加载进度(transform / encode / watermark / compress-target / filters)
 *   - 总进度条 + 预估剩余时间(基于 canvas 引擎实际耗时 ~1.5s 校准)
 *   - 每个 capability 的简短介绍(用户在等待时学到产品价值)
 *   - "Skip" 按钮(用户可跳过等待,直接进入应用)
 *   - 全部 loaded 后 200ms 渐隐消失
 *
 * 触发条件:
 *   - 首次访问(无 lokvis:engine-loader-seen 标记)
 *   - 且未在 standalone 模式(已安装 PWA 跳过,因为已预加载)
 *   - 用户点 Skip 后写入 lokvis:engine-loader-seen,下次不再弹
 *
 * 与 lazy.ts 的集成:
 *   - 调用 preloadTop5Engines() 触发加载
 *   - 轮询 getLoadStatus(name) 更新进度
 *   - 同时通过 subscribeEnginePreloadProgress 接收 SW 进度
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  preloadTop5Engines,
  getLoadStatus,
  TOP5_MODULES,
  type EngineModuleName,
  type LoadStatus,
} from '@lokvis/engine-image';
import { isStandalone } from '../toolkit/pwa-utils.js';

// ─── 常量 ────────────────────────────────────────────────────────

const SEEN_KEY = 'lokvis:engine-loader-seen';
const POLL_INTERVAL_MS = 100;
const FADE_OUT_MS = 250;

/** 模块中文/英文介绍(等待时教育用户) */
const MODULE_INFO: Record<EngineModuleName, { label: string; desc: string }> = {
  transform: {
    label: 'Resize & Crop',
    desc: 'Geometric transforms via Canvas / createImageBitmap',
  },
  encode: {
    label: 'Compress & Convert',
    desc: 'Format encoding (PNG / JPEG / WebP / AVIF) with quality control',
  },
  watermark: {
    label: 'Watermark',
    desc: 'Text & image overlay with position / opacity control',
  },
  'compress-target': {
    label: 'Target Size',
    desc: 'Binary search for the best quality at a target file size',
  },
  filters: {
    label: 'Filters',
    desc: 'Grayscale / sepia / invert / blur presets',
  },
  'png-metadata': { label: 'PNG DPI', desc: 'Embed physical resolution in pHYs chunk' },
  tiles: { label: 'Tiling', desc: 'Large image split into tiles for memory safety' },
};

/** 预估总耗时(毫秒)——基于 canvas 引擎在中等设备上的实测 */
const ESTIMATED_TOTAL_MS = 1500;

// ─── 工具函数 ────────────────────────────────────────────────────

function hasSeenLoader(): boolean {
  try {
    return Boolean(localStorage.getItem(SEEN_KEY));
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, String(Date.now()));
  } catch {
    /* 忽略 */
  }
}

// ─── 组件 ────────────────────────────────────────────────────────

export interface EngineLoaderProps {
  /** 强制显示(调试 / 演示用) */
  force?: boolean;
}

export function EngineLoader({ force = false }: EngineLoaderProps) {
  const [visible, setVisible] = useState<boolean>(shouldShow(force));
  const [fadingOut, setFadingOut] = useState(false);
  const [statuses, setStatuses] = useState<Record<EngineModuleName, LoadStatus>>(
    () => {
      const initial = {} as Record<EngineModuleName, LoadStatus>;
      for (const name of TOP5_MODULES) {
        initial[name] = getLoadStatus(name);
      }
      return initial;
    }
  );
  const [elapsedMs, setElapsedMs] = useState(0);
  const startTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  // 启动加载 + 轮询状态
  useEffect(() => {
    if (!visible) return;

    startTimeRef.current = Date.now();

    // 触发预加载(异步,不阻塞)
    void preloadTop5Engines().catch((err) => {
      console.warn('[EngineLoader] preload failed:', err);
    });

    // 轮询状态直到全部 loaded / error
    const poll = () => {
      const next = {} as Record<EngineModuleName, LoadStatus>;
      let allDone = true;
      for (const name of TOP5_MODULES) {
        const s = getLoadStatus(name);
        next[name] = s;
        if (s !== 'loaded' && s !== 'error') allDone = false;
      }
      setStatuses(next);
      setElapsedMs(Date.now() - startTimeRef.current);

      if (allDone) {
        // 全部完成,渐隐
        setFadingOut(true);
        setTimeout(() => {
          setVisible(false);
          markSeen();
        }, FADE_OUT_MS);
        return;
      }
      // 继续轮询
      rafRef.current = window.setTimeout(poll, POLL_INTERVAL_MS) as unknown as number;
    };
    poll();

    return () => {
      if (rafRef.current !== null) {
        clearTimeout(rafRef.current);
      }
    };
  }, [visible]);

  // Skip 按钮:立即隐藏 + 标记已看
  const handleSkip = useCallback(() => {
    setFadingOut(true);
    setTimeout(() => {
      setVisible(false);
      markSeen();
    }, FADE_OUT_MS);
  }, []);

  if (!visible) return null;

  // 进度计算:loaded 计 1,error 计 0.5(部分可用),其他 0
  const loadedCount = TOP5_MODULES.filter(
    (n) => statuses[n] === 'loaded'
  ).length;
  const errorCount = TOP5_MODULES.filter(
    (n) => statuses[n] === 'error'
  ).length;
  const progress = (loadedCount + errorCount * 0.5) / TOP5_MODULES.length;

  // 预估剩余时间:基于观察速率
  // - progress=0:显示预估总时间(ESTIMATED_TOTAL_MS)
  // - progress>0:按当前速率推算 (elapsedMs / progress) - elapsedMs
  const estimatedRemainingMs =
    progress <= 0
      ? ESTIMATED_TOTAL_MS
      : Math.max(0, Math.ceil(elapsedMs / progress) - elapsedMs);

  return (
    <div
      className={`engine-loader ${fadingOut ? 'engine-loader--fade' : ''}`}
      role="dialog"
      aria-label="Loading Lokvis engines"
    >
      <div className="engine-loader__inner">
        {/* 品牌动画 */}
        <div className="engine-loader__brand">
          <div className="engine-loader__halo" />
          <div className="engine-loader__logo">◆</div>
        </div>
        <div className="engine-loader__title">Lokvis Playground</div>
        <div className="engine-loader__subtitle">
          Loading local-first image engines…
        </div>

        {/* 进度条 */}
        <div className="engine-loader__progress">
          <div
            className="engine-loader__progress-bar"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <div className="engine-loader__meta">
          <span>{loadedCount}/{TOP5_MODULES.length} ready</span>
          <span>
            {progress >= 1
              ? 'Done'
              : `~${Math.ceil(estimatedRemainingMs / 1000)}s remaining`}
          </span>
        </div>

        {/* 模块列表 */}
        <ul className="engine-loader__modules">
          {TOP5_MODULES.map((name) => {
            const s = statuses[name];
            const info = MODULE_INFO[name];
            return (
              <li
                key={name}
                className={`engine-loader__module engine-loader__module--${s}`}
              >
                <span className="engine-loader__module-icon">
                  {s === 'loaded' && '✓'}
                  {s === 'error' && '⚠'}
                  {s === 'loading' && '◌'}
                  {s === 'idle' && '·'}
                </span>
                <span className="engine-loader__module-label">{info.label}</span>
                <span className="engine-loader__module-desc">{info.desc}</span>
              </li>
            );
          })}
        </ul>

        {/* Skip */}
        <button
          type="button"
          className="engine-loader__skip"
          onClick={handleSkip}
        >
          Skip intro →
        </button>
      </div>

      <style>{`
        .engine-loader {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgb(9 9 11 / 0.96);
          backdrop-filter: blur(12px);
          color: rgb(228 228 231);
          font-family: ui-sans-serif, system-ui, sans-serif;
          animation: el-fade-in 0.2s ease-out;
          transition: opacity ${FADE_OUT_MS}ms ease-out;
        }
        .engine-loader--fade {
          opacity: 0;
        }
        @keyframes el-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .engine-loader__inner {
          width: 480px;
          max-width: calc(100vw - 32px);
          padding: 32px 28px 24px;
          text-align: center;
        }
        .engine-loader__brand {
          position: relative;
          width: 80px;
          height: 80px;
          margin: 0 auto 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .engine-loader__halo {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: conic-gradient(from 0deg, #6366f1, #a855f7, #ec4899, #6366f1);
          filter: blur(16px);
          opacity: 0.6;
          animation: el-rotate 4s linear infinite;
        }
        .engine-loader__logo {
          position: relative;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          color: #fff;
          font-size: 22px;
          font-weight: 700;
        }
        @keyframes el-rotate {
          to { transform: rotate(360deg); }
        }
        .engine-loader__title {
          font-size: 20px;
          font-weight: 600;
          letter-spacing: -0.01em;
          color: rgb(244 244 245);
        }
        .engine-loader__subtitle {
          margin-top: 4px;
          font-size: 13px;
          color: rgb(161 161 170);
        }
        .engine-loader__progress {
          margin: 24px 0 8px;
          height: 4px;
          border-radius: 9999px;
          background: rgb(39 39 42);
          overflow: hidden;
        }
        .engine-loader__progress-bar {
          height: 100%;
          border-radius: 9999px;
          background: linear-gradient(90deg, #6366f1, #a855f7);
          transition: width 0.3s ease-out;
        }
        .engine-loader__meta {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: rgb(113 113 122);
          margin-bottom: 20px;
        }
        .engine-loader__modules {
          list-style: none;
          padding: 0;
          margin: 0 0 24px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          text-align: left;
        }
        .engine-loader__module {
          display: grid;
          grid-template-columns: 20px 1fr;
          grid-template-rows: auto auto;
          gap: 0 6px;
          padding: 8px 10px;
          border-radius: 8px;
          background: rgb(24 24 27);
          border: 1px solid rgb(39 39 42);
          font-size: 12px;
        }
        .engine-loader__module-icon {
          grid-row: 1 / span 2;
          align-self: center;
          text-align: center;
          font-size: 14px;
          line-height: 1;
        }
        .engine-loader__module--loaded .engine-loader__module-icon { color: rgb(34 197 94); }
        .engine-loader__module--loading .engine-loader__module-icon { color: rgb(99 102 241); animation: el-spin 1s linear infinite; }
        .engine-loader__module--error .engine-loader__module-icon { color: rgb(239 68 68); }
        .engine-loader__module--idle .engine-loader__module-icon { color: rgb(82 82 91); }
        @keyframes el-spin {
          to { transform: rotate(360deg); }
        }
        .engine-loader__module-label {
          font-weight: 600;
          color: rgb(228 228 231);
        }
        .engine-loader__module-desc {
          grid-column: 2;
          font-size: 10px;
          color: rgb(113 113 122);
          line-height: 1.4;
        }
        .engine-loader__skip {
          padding: 8px 16px;
          border: 1px solid rgb(63 63 70);
          border-radius: 8px;
          background: transparent;
          color: rgb(161 161 170);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }
        .engine-loader__skip:hover {
          background: rgb(39 39 42);
          color: rgb(228 228 231);
        }
      `}</style>
    </div>
  );
}

function shouldShow(force: boolean): boolean {
  if (force) return true;
  if (typeof window === 'undefined') return false;
  if (isStandalone()) return false; // 已安装 PWA 跳过(已预加载)
  if (hasSeenLoader()) return false;
  return true;
}

export default EngineLoader;
