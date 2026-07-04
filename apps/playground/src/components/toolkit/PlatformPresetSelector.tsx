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
 */
import { useMemo } from 'react';
import {
  PLATFORM_PRESETS,
  PLATFORM_PRESET_CATEGORY_LABELS,
  groupPlatformPresetsByCategory,
  type PlatformSizePreset,
  type PlatformPresetCategory,
} from '@lokvis/capability';
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
 * 把自定义预设归入 'other' 分类,在选择器末尾以"我的预设"分组展示。
 *
 * 自定义预设 id 用 `custom.${slug}` 前缀,与内置预设 id 命名空间隔离,
 * 避免用户取了和内置预设同名(如 'youtube.thumbnail')的 name 后产生冲突。
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

export function PlatformPresetSelector({
  value,
  onSelect,
  isPro = false,
  currentForm,
  className = '',
}: PlatformPresetSelectorProps) {
  const { presets: customPresets, save, remove, canSaveMore, remaining } = useCustomPresets(isPro);

  // 合并内置 + 自定义预设,按 category 分组
  const grouped = useMemo(() => {
    const groups = groupPlatformPresetsByCategory(PLATFORM_PRESETS);
    // 自定义预设单独作为一组,放在最后(用 'other' 分类下的特殊分组)
    if (customPresets.length > 0) {
      const customGroup = customPresets.map(toPresetShape);
      // 合并到 'other' 分组末尾,保持选择器单 select 简洁
      const otherArr = groups.get('other') ?? [];
      groups.set('other', [...otherArr, ...customGroup]);
    }
    return groups;
  }, [customPresets]);

  // 按 category 出现顺序遍历(social → ecommerce → video → print → other)
  const categoryOrder: PlatformPresetCategory[] = ['social', 'ecommerce', 'video', 'print', 'other'];

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

  const handleSave = () => {
    if (!currentForm) return;
    if (!canSaveMore) return;
    const name = window.prompt('预设名称', `${currentForm.width}×${currentForm.height}`);
    if (!name) return;
    save({
      name,
      width: currentForm.width,
      height: currentForm.height,
      fit: currentForm.fit,
      format: currentForm.format,
    });
  };

  const handleDeleteCustom = () => {
    if (customPresets.length === 0) return;
    const list = customPresets.map((c, i) => `${i + 1}. ${c.name} (${c.width}×${c.height})`).join('\n');
    const input = window.prompt(`要删除哪个预设?输入序号:\n\n${list}`);
    if (!input) return;
    const idx = Number(input) - 1;
    if (Number.isNaN(idx) || idx < 0 || idx >= customPresets.length) return;
    remove(customPresets[idx]!.id);
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
            const arr = grouped.get(cat);
            if (!arr || arr.length === 0) return null;
            const label =
              cat === 'other' && customPresets.length > 0
                ? `${PLATFORM_PRESET_CATEGORY_LABELS[cat]}(含我的预设)`
                : PLATFORM_PRESET_CATEGORY_LABELS[cat];
            return (
              <optgroup key={cat} label={label}>
                {arr.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.platform} · {p.name} ({p.width}×{p.height})
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
        {currentForm && (
          <button
            type="button"
            onClick={handleSave}
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
            onClick={handleDeleteCustom}
            title="删除自定义预设"
            className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-800"
          >
            删除
          </button>
        )}
      </div>
    </div>
  );
}
