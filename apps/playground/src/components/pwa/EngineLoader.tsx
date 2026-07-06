/**
 * EngineLoader(W15.8)
 *
 * 首次加载 engine 时显示进度动画：top 5 operation（resize/compress/watermark/
 * convert/crop）的加载进度条 + 预估时间 + 重试。
 *
 * 行为：
 *   - 仅在首次加载显示（sessionStorage 记录已显示过，刷新/导航不重复弹）
 *   - 调 preloadTop5Operations() 触发加载；setInterval(100ms) 轮询
 *     isOperationLoaded(name) 实时更新每个 operation 状态点
 *   - 完成后 1s 渐隐消失（fade out → display none）
 *   - 全部失败显示重试按钮 → clearOperationCache() + 重新预加载
 *
 * 数据源（review fix）：通过 Capability 层（@lokvis/plugin-image）访问
 * Engine 懒加载工具，避免 UI → Engine 跨层引用（AGENTS.md 单向依赖）。
 */
import { useEffect, useRef, useState } from 'react';
import {
  preloadTop5Operations,
  isOperationLoaded,
  clearOperationCache,
  TOP_5_OPERATIONS,
} from '@lokvis/plugin-image';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

/** sessionStorage key：标记本会话已展示过 EngineLoader */
const SHOWN_KEY = 'lokvis.engineloader.shown';
/** 完成后停留 1s 再渐隐 */
const DONE_HOLD_MS = 1000;
/** 渐隐过渡时长 */
const FADE_MS = 500;
/** 轮询间隔 */
const POLL_INTERVAL_MS = 100;

type Phase = 'loading' | 'done' | 'fading' | 'error' | 'hidden';
type OpStatus = 'loading' | 'done' | 'error';

/** operation 短名 → 翻译 key */
const OP_LABEL_KEY: Record<string, string> = {
  resize: 'resize.title',
  compress: 'compress.title',
  watermark: 'watermark.title',
  convert: 'convert.title',
  crop: 'crop.title',
};

/**
 * 读取 sessionStorage，决定是否展示（首次且未全部预加载时展示）。
 *
 * Review fix（Minor-9）：原在 useState 初始化器中调用本函数并写 sessionStorage，
 * 属于 render 中的副作用（React anti-pattern，StrictMode 下会双调用导致状态不一致）。
 * 现仅在函数中"读" sessionStorage（纯查询），"写" 操作移到 useEffect 中。
 */
function readShouldShowLoader(): boolean {
  try {
    if (sessionStorage.getItem(SHOWN_KEY)) return false;
    // 若 5 个 operation 已全部加载（如 SW 提前预加载完成），无需再弹
    if (TOP_5_OPERATIONS.every((op) => isOperationLoaded(op))) {
      return false;
    }
    return true;
  } catch {
    // sessionStorage 不可用（隐私模式）→ 不弹（graceful，engine 仍由 W15.7 后台加载）
    return false;
  }
}

export default function EngineLoader() {
  const lang = useLang();
  const t = useTranslations(lang);
  const [show] = useState(readShouldShowLoader);
  const [phase, setPhase] = useState<Phase>('loading');
  // 已加载完成的 operation 集合（轮询更新）
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
  // 已耗时（ms），用于展示实际进度
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);

  // Review fix（Minor-9）：sessionStorage 写入移到 useEffect，避免 render 副作用
  useEffect(() => {
    if (!show) return;
    try {
      sessionStorage.setItem(SHOWN_KEY, '1');
    } catch {
      // 隐私模式 sessionStorage 不可用，静默
    }
  }, [show]);

  // 触发预加载（首次挂载或重试时调用）
  const startLoad = () => {
    setLoaded(new Set());
    setElapsed(0);
    setPhase('loading');
    startRef.current = Date.now();

    preloadTop5Operations()
      .then((loadedNames) => {
        setLoaded(new Set(loadedNames));
        if (loadedNames.length === 0) {
          // 全部失败 → 显示重试
          setPhase('error');
        } else {
          // 至少部分成功 → done，停留后渐隐
          setPhase('done');
        }
      })
      .catch((err) => {
        // 防御性：preloadTop5Operations 内部 allSettled 不会 reject
        console.warn('[EngineLoader] preload failed:', err);
        setPhase('error');
      });
  };

  // 首次挂载触发加载
  useEffect(() => {
    if (!show) return;
    startLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  // 轮询 isOperationLoaded 实时更新进度（仅 loading 阶段）
  useEffect(() => {
    if (!show || phase !== 'loading') return;
    const tick = () => {
      const now = new Set(TOP_5_OPERATIONS.filter((op) => isOperationLoaded(op)));
      setLoaded(now);
      setElapsed(Date.now() - startRef.current);
    };
    tick(); // 立即跑一次
    const id = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [show, phase]);

  // done 阶段：停留 1s 后切到 fading
  useEffect(() => {
    if (phase !== 'done') return;
    const id = window.setTimeout(() => setPhase('fading'), DONE_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  // fading 阶段：过渡 FADE_MS 后切到 hidden（卸载）
  useEffect(() => {
    if (phase !== 'fading') return;
    const id = window.setTimeout(() => setPhase('hidden'), FADE_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  // 重试：清缓存 + 重新加载
  const handleRetry = () => {
    clearOperationCache();
    startLoad();
  };

  if (!show || phase === 'hidden') return null;

  // 单个 operation 状态
  const opStatus = (op: string): OpStatus => {
    if (loaded.has(op)) return 'done';
    if (phase === 'error' || phase === 'done') {
      // 已 resolve 但未加载 → 失败
      return 'error';
    }
    return 'loading';
  };

  const loadedCount = loaded.size;
  const progressPct = Math.round((loadedCount / TOP_5_OPERATIONS.length) * 100);
  const isFading = phase === 'fading';

  // 底部状态文字
  const statusText =
    phase === 'error'
      ? t('pwa.engineFailed')
      : phase === 'done'
      ? t('pwa.ready')
      : loadedCount === 0
      ? t('common.loading')
      : `${t('pwa.loadingProgressPrefix')}${loadedCount}/${TOP_5_OPERATIONS.length}`;
  // 预估时间：首次约 2s，展示已耗时 / 预估
  const estimateText =
    phase === 'error'
      ? ''
      : phase === 'done'
      ? `${t('pwa.doneInPrefix')}${(elapsed / 1000).toFixed(1)}${t('pwa.doneInSuffix')}`
      : `${t('pwa.estimatePrefix')}${(elapsed / 1000).toFixed(1)}${t('pwa.estimateMiddle')}`;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/90 backdrop-blur transition-opacity duration-500 ${
        isFading ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900/95 p-6 shadow-2xl">
        {/* 标题 */}
        <div className="flex items-center gap-2">
          <span
            className="text-xl font-bold"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
            aria-hidden
          >
            ◆
          </span>
          <h2 className="text-sm font-semibold text-zinc-100">{t('pwa.loadingEngine')}</h2>
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">
          {t('pwa.preparing')}
        </p>

        {/* 5 个 operation 状态点 */}
        <ul className="mt-4 space-y-1.5">
          {TOP_5_OPERATIONS.map((op) => {
            const st = opStatus(op);
            return (
              <li key={op} className="flex items-center gap-2 text-[11px]">
                <span
                  className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${
                    st === 'done'
                      ? 'bg-emerald-500'
                      : st === 'error'
                      ? 'bg-red-500'
                      : 'animate-pulse bg-amber-500'
                  }`}
                  aria-hidden
                />
                <span className="font-mono text-zinc-300">{OP_LABEL_KEY[op] ? t(OP_LABEL_KEY[op]) : op}</span>
                <span
                  className={`ml-auto text-[10px] ${
                    st === 'done'
                      ? 'text-emerald-400'
                      : st === 'error'
                      ? 'text-red-400'
                      : 'text-amber-400'
                  }`}
                >
                  {st === 'done' ? t('pwa.opReady') : st === 'error' ? t('pwa.opFailed') : t('pwa.opLoading')}
                </span>
              </li>
            );
          })}
        </ul>

        {/* 整体进度条 */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[10px] text-zinc-500">
            <span>{t('pwa.progress')}</span>
            <span className="font-mono text-zinc-400">{progressPct}%</span>
          </div>
          <div className="mt-1 flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-zinc-800">
            {TOP_5_OPERATIONS.map((op) => (
              <div
                key={op}
                className={`h-full flex-1 transition-colors ${
                  loaded.has(op) ? 'bg-indigo-600' : 'bg-zinc-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* 底部状态 + 预估时间 / 重试 */}
        <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-3">
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-zinc-300">{statusText}</span>
            {estimateText && (
              <span className="text-[10px] text-zinc-600">{estimateText}</span>
            )}
          </div>
          {phase === 'error' && (
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-indigo-500"
            >
              {t('pwa.retry')}
            </button>
          )}
          {phase === 'done' && (
            <span className="text-[11px] font-semibold text-emerald-400">{t('pwa.readyCheck')}</span>
          )}
        </div>
      </div>
    </div>
  );
}
