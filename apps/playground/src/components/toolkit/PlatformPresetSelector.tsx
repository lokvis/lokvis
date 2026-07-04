/**
 * PlatformPresetSelector — 平台尺寸预设选择器(W8.2)。
 *
 * 在 resize / crop 工具页内显示一个 dropdown,用户选择平台预设后,通过
 * onSelect 回调返回该预设的 width/height/fit/format。工具页据此填充
 * 自身的参数表单(允许用户再微调,非覆盖式)。
 *
 * 选择器同时展示内置预设(PLATFORM_PRESETS,只读)+ 用户自定义预设
 * (localStorage 持久化,免费 3 个 / Pro 无限,见 useCustomPresets)。
 *
 * 设计为受控组件:`value` 为当前选中的 preset id(null 表示未选)。
 * onSelect 在用户选择新预设时触发,父组件负责把 width/height/fit 应用到
 * 自身状态(由父组件决定是否同时清零/保留微调)。
 *
 * 交互:保存 / 删除自定义预设通过 @lokvis/ui-core 的 Dialog 模态完成,
 * 不使用 window.prompt(原生 prompt 不支持样式 / 校验 / 移动端体验差)。
 * 自定义预设作为独立 optgroup「我的预设」展示,不污染内置 'other' 分类。
 */
import { useMemo, useState } from 'react';
import {
  PLATFORM_PRESETS,
  PLATFORM_PRESET_CATEGORY_LABELS,
  groupPlatformPresetsByCategory,
  type PlatformSizePreset,
  type PlatformPresetCategory,
} from '@lokvis/capability';
import { Dialog } from '@lokvis/ui-core';
import { useCustomPresets, type CustomPreset } from './useCustomPresets';

export interface PlatformPresetSelectorProps {
  /** 当前选中的预设 id(null 表示未选) */
  value: string | null;
  /** 选择新预设时触发(传入 null 表示清空选择) */
  onSelect: (preset: PlatformSizePreset | null) => void;
  /**
   * 是否为 Pro 模式(影响自定义预设上限:免费 3 个 / Pro 无限)。
   * 由父组件从 runtime.isPro 传入。
   */
  isPro?: boolean;
  /**
   * 父组件当前表单的 width/height/fit/format,供"保存为自定义预设"按钮
   * 默认填充。可选 —— 不传时不显示保存按钮(保存逻辑在 selector 内通过
   * useCustomPresets 直接落地到 localStorage,父组件无需提供回调)。
   */
  currentForm?: {
    width: number;
    height: number;
    fit?: PlatformSizePreset['recommendedFit'];
    format?: PlatformSizePreset['recommendedFormat'];
  };
  /** 额外 className */
  className?: string;
}

/**
 * 自定义预设 → PlatformSizePreset 形状。
 *
 * 自定义预设 id 用 `custom.${slug}` 前缀,与内置预设 id 命名空间隔离,
 * 避免用户取了和内置预设同名(如 'youtube.thumbnail')的 name 后产生冲突。
 * category 字段仅用于满足类型约束,实际渲染时自定义预设走独立 optgroup,
 * 不参与内置分类分组。
 */
function toPresetShape(custom: CustomPreset): PlatformSizePreset {
  return {
    id: `custom.${custom.id}`,
    platform: '我的预设',
    name: custom.name,
    width: custom.width,
    height: custom.height,
    category: 'other' as PlatformPresetCategory,
    description: `自定义预设 · ${custom.width}×${custom.height}`,
    recommendedFormat: custom.format,
    recommendedFit: custom.fit,
  };
}

/** 自定义预设分组标签(独立于内置 'other' 通用分类) */
const CUSTOM_GROUP_LABEL = '我的预设';

export function PlatformPresetSelector({
  value,
  onSelect,
  isPro = false,
  currentForm,
  className = '',
}: PlatformPresetSelectorProps) {
  const { presets: customPresets, save, remove, canSaveMore, remaining } = useCustomPresets(isPro);

  // 内置预设按 category 分组(自定义预设独立成组,不合并进来)
  const builtinGrouped = useMemo(() => groupPlatformPresetsByCategory(PLATFORM_PRESETS), []);

  // 自定义预设单独作为一组(PlatformPresetCategory 不含 'custom',用独立数组渲染)
  const customShapes = useMemo(() => customPresets.map(toPresetShape), [customPresets]);

  // 按 category 出现顺序遍历(social → ecommerce → video → print → other)
  const categoryOrder: PlatformPresetCategory[] = ['social', 'ecommerce', 'video', 'print', 'other'];

  // ─── 保存对话框状态 ───
  const [saveOpen, setSaveOpen] = useState(false);
  const [presetName, setPresetName] = useState('');

  // ─── 删除对话框状态 ───
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (!id) {
      onSelect(null);
      return;
    }
    // 自定义预设
    if (id.startsWith('custom.')) {
      const customId = id.slice('custom.'.length);
      const custom = customPresets.find((c) => c.id === customId);
      if (custom) onSelect(toPresetShape(custom));
      return;
    }
    // 内置预设
    const preset = PLATFORM_PRESETS.find((p) => p.id === id);
    if (preset) onSelect(preset);
  };

  const openSaveDialog = () => {
    if (!currentForm || !canSaveMore) return;
    setPresetName(`${currentForm.width}×${currentForm.height}`);
    setSaveOpen(true);
  };

  const confirmSave = () => {
    const name = presetName.trim();
    if (!name || !currentForm) return;
    save({
      name,
      width: currentForm.width,
      height: currentForm.height,
      fit: currentForm.fit,
      format: currentForm.format,
    });
    setSaveOpen(false);
  };

  const openDeleteDialog = () => {
    if (customPresets.length === 0) return;
    setDeleteId(customPresets[0]!.id);
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (deleteId) remove(deleteId);
    setDeleteOpen(false);
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[10px] font-medium text-zinc-500">
        平台预设{isPro ? '(Pro)' : `(${remaining} 个可保存)`}
      </span>
      <div className="flex items-center gap-2">
        <select
          value={value ?? ''}
          onChange={handleChange}
          className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
        >
          <option value="">— 选择平台预设 —</option>
          {categoryOrder.map((cat) => {
            const arr = builtinGrouped.get(cat);
            if (!arr || arr.length === 0) return null;
            return (
              <optgroup key={cat} label={PLATFORM_PRESET_CATEGORY_LABELS[cat]}>
                {arr.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.platform} · {p.name} ({p.width}×{p.height})
                  </option>
                ))}
              </optgroup>
            );
          })}
          {/* 自定义预设独立分组,不污染内置 'other' 分类 */}
          {customShapes.length > 0 && (
            <optgroup label={CUSTOM_GROUP_LABEL}>
              {customShapes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.width}×{p.height})
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {currentForm && (
          <button
            type="button"
            onClick={openSaveDialog}
            disabled={!canSaveMore}
            title={canSaveMore ? '保存当前尺寸为新预设' : '已达免费上限(3 个),Pro 用户无限制'}
            className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            保存
          </button>
        )}
        {customPresets.length > 0 && (
          <button
            type="button"
            onClick={openDeleteDialog}
            title="删除自定义预设"
            className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-800"
          >
            删除
          </button>
        )}
      </div>

      {/* 保存自定义预设对话框 */}
      <Dialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="保存为自定义预设"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setSaveOpen(false)}
              className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              取消
            </button>
            <button
              type="button"
              onClick={confirmSave}
              disabled={!presetName.trim()}
              className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              保存
            </button>
          </>
        }
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-400">预设名称</span>
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmSave();
            }}
            autoFocus
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
          />
          {currentForm && (
            <span className="mt-1 text-[10px] text-zinc-500">
              尺寸:{currentForm.width}×{currentForm.height}
            </span>
          )}
        </label>
      </Dialog>

      {/* 删除自定义预设对话框 */}
      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="删除自定义预设"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              取消
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-500"
            >
              删除
            </button>
          </>
        }
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-400">选择要删除的预设</span>
          <select
            value={deleteId ?? ''}
            onChange={(e) => setDeleteId(e.target.value || null)}
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
          >
            {customPresets.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.width}×{c.height})
              </option>
            ))}
          </select>
        </label>
      </Dialog>
    </div>
  );
}
