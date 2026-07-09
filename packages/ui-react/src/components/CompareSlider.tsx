/**
 * CompareSlider - before/after 对比滑块(W9.4)
 *
 * 把输入资产(原)与输出资产(处理后)叠加展示,通过可拖拽的分隔条左右揭示
 * before / after 两张图。用于直观展示工作流处理效果。
 *
 * 交互:
 * - 鼠标拖拽分隔条(或点击容器任意位置)调整揭示比例
 * - 触摸:touchmove 同步
 * - 键盘:← → 调整 5% 步长(聚焦分隔条时)
 *
 * 数据来源:
 * - before: `store.selectedAssetId` 对应的 thumbnails(由 AssetPanel 自动生成)
 * - after: `store.selectedOutputId` 对应的 thumbnails
 * - 任一缺失则不渲染(返回 null)
 *
 * 注:本组件只负责"展示对比",不负责生成缩略图。缩略图由 AssetPanel
 * 的 effect 统一生成并存入 store.thumbnails,本组件按 assetId 取用。
 */

import * as React from 'react';
import { Icon } from '@lokvis/ui-core';
import { useWorkspaceStore } from '../store/index.js';

export interface CompareSliderProps {
 className?: string;
}

export function CompareSlider({ className = '' }: CompareSliderProps) {
 const assets = useWorkspaceStore((s) => s.assets);
 const thumbnails = useWorkspaceStore((s) => s.thumbnails);
 const selectedAssetId = useWorkspaceStore((s) => s.selectedAssetId);
 const selectedOutputId = useWorkspaceStore((s) => s.selectedOutputId);
 const lastOutputIds = useWorkspaceStore((s) => s.lastOutputIds);

 // before:用户选中的输入资产;after:用户选中的输出资产(默认第一个)
 const beforeId = selectedAssetId;
 const afterId = selectedOutputId ?? lastOutputIds[0] ?? null;

 const beforeAsset = beforeId ? assets.find((a) => a.id === beforeId) : null;
 const afterAsset = afterId ? assets.find((a) => a.id === afterId) : null;
 const beforeUrl = beforeId ? thumbnails[beforeId] : undefined;
 const afterUrl = afterId ? thumbnails[afterId] : undefined;

 const containerRef = React.useRef<HTMLDivElement>(null);
 const [pos, setPos] = React.useState(50); // 0-100,分隔条位置百分比
 const [dragging, setDragging] = React.useState(false);

 // 切换资产时重置位置到中央
 React.useEffect(() => {
 setPos(50);
 }, [beforeId, afterId]);

 const updatePos = React.useCallback((clientX: number) => {
 const el = containerRef.current;
 if (!el) return;
 const rect = el.getBoundingClientRect();
 const ratio = (clientX - rect.left) / rect.width;
 setPos(Math.max(0, Math.min(100, ratio * 100)));
 }, []);

 // 鼠标拖拽
 const handleMouseDown = (e: React.MouseEvent) => {
 e.preventDefault();
 setDragging(true);
 updatePos(e.clientX);
 };
 React.useEffect(() => {
 if (!dragging) return;
 const onMove = (e: MouseEvent) => updatePos(e.clientX);
 const onUp = () => setDragging(false);
 document.addEventListener('mousemove', onMove);
 document.addEventListener('mouseup', onUp);
 return () => {
 document.removeEventListener('mousemove', onMove);
 document.removeEventListener('mouseup', onUp);
 };
 }, [dragging, updatePos]);

 // 触摸拖拽
 const handleTouchStart = (e: React.TouchEvent) => {
 setDragging(true);
 if (e.touches[0]) updatePos(e.touches[0].clientX);
 };
 React.useEffect(() => {
 if (!dragging) return;
 const onMove = (e: TouchEvent) => {
 if (e.touches[0]) updatePos(e.touches[0].clientX);
 };
 const onEnd = () => setDragging(false);
 document.addEventListener('touchmove', onMove, { passive: true });
 document.addEventListener('touchend', onEnd);
 return () => {
 document.removeEventListener('touchmove', onMove);
 document.removeEventListener('touchend', onEnd);
 };
 }, [dragging, updatePos]);

 // 键盘:← → 调整 5%
 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (e.key === 'ArrowLeft') {
 e.preventDefault();
 setPos((p) => Math.max(0, p - 5));
 } else if (e.key === 'ArrowRight') {
 e.preventDefault();
 setPos((p) => Math.min(100, p + 5));
 }
 };

 if (!beforeUrl || !afterUrl) return null;

 return (
 <div
 ref={containerRef}
 className={`relative select-none overflow-hidden rounded-lg ring-1 ring-black/5 ${className}`}
 onMouseDown={handleMouseDown}
 onTouchStart={handleTouchStart}
 >
 {/* after 全图(底层)——决定容器尺寸 */}
 <img
 src={afterUrl}
 alt="After"
 draggable={false}
 className="block max-h-full max-w-full object-contain pointer-events-none"
 />

 {/* before 覆盖层:绝对定位同尺寸,用 clip-path 从右侧裁剪到 pos%
 (避免读取 containerRef.current.clientWidth 这种"渲染期读 ref"反模式) */}
 <div
 className="absolute inset-0"
 style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
 >
 <img
 src={beforeUrl}
 alt="Before"
 draggable={false}
 className="block max-h-full max-w-full object-contain pointer-events-none"
 />
 </div>

 {/* before/after 标签 */}
 <span className="absolute top-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-[var(--lokvis-primary-fg)]">
 Before
 </span>
 <span className="absolute top-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-[var(--lokvis-primary-fg)]">
 After
 </span>

 {/* 分隔条 */}
 <div
 className="absolute top-0 bottom-0 z-10 cursor-ew-resize"
 style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
 role="separator"
 aria-valuenow={Math.round(pos)}
 aria-valuemin={0}
 aria-valuemax={100}
 aria-label="Comparison slider position"
 tabIndex={0}
 onKeyDown={handleKeyDown}
 >
 <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-[var(--lokvis-surface)] shadow-md" />
 <div className="absolute top-1/2 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--lokvis-surface)] shadow-lg ring-1 ring-black/10">
 <Icon size={14} className="text-[var(--lokvis-fg-muted)]">
 <path d="M9 5l-5 7 5 7M15 5l5 7-5 7" />
 </Icon>
 </div>
 </div>

 {/* 元数据对比(底部叠加) */}
 {(beforeAsset || afterAsset) && (
 <div className="absolute bottom-2 inset-x-2 flex justify-between text-[10px] text-[var(--lokvis-primary-fg)]">
 {beforeAsset?.metadata.dimensions && (
 <span className="rounded bg-black/60 px-1.5 py-0.5">
 {beforeAsset.metadata.dimensions.width}×{beforeAsset.metadata.dimensions.height}
 </span>
 )}
 {afterAsset?.metadata.dimensions && (
 <span className="rounded bg-black/60 px-1.5 py-0.5">
 {afterAsset.metadata.dimensions.width}×{afterAsset.metadata.dimensions.height}
 </span>
 )}
 </div>
 )}
 </div>
 );
}
