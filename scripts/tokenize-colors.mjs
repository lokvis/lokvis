/**
 * 批量 token 化脚本:
 * 1. 删除所有 dark: 变体类
 * 2. 把硬编码 Tailwind 色值替换为 var(--lokvis-*) 引用
 * 3. 合并连续空格
 *
 * 已知需手动修正的歧义点(脚本跑完后用 Edit 处理):
 * - button.tsx primary 的 text-white → 应为 text-[var(--lokvis-bg)](反转按钮)
 * - tooltip.tsx 的 text-white → 应为 text-[var(--lokvis-bg)]
 * - toggle.tsx thumb 的 bg-white → 应为 bg-[var(--lokvis-primary-fg)]
 */
import fs from 'node:fs';

/** @type {Record<string, string>} 硬编码色值 → token 引用 */
const colorMap = {
  // bg - 表面
  'bg-white': 'bg-[var(--lokvis-surface)]',
  'bg-zinc-50': 'bg-[var(--lokvis-surface)]',
  'bg-zinc-100': 'bg-[var(--lokvis-surface-muted)]',
  'bg-zinc-200': 'bg-[var(--lokvis-border)]',
  'bg-zinc-300': 'bg-[var(--lokvis-fg-subtle)]',
  'bg-zinc-400': 'bg-[var(--lokvis-fg-subtle)]',
  'bg-zinc-500': 'bg-[var(--lokvis-fg-muted)]',
  'bg-zinc-600': 'bg-[var(--lokvis-fg-muted)]',
  'bg-zinc-700': 'bg-[var(--lokvis-fg-muted)]',
  'bg-zinc-800': 'bg-[var(--lokvis-surface-muted)]',
  'bg-zinc-900': 'bg-[var(--lokvis-fg)]',

  // bg - black (step number bg 等半透明黑)
  'bg-black/5': 'bg-[var(--lokvis-fg)]/5',

  // text
  'text-white': 'text-[var(--lokvis-primary-fg)]',
  'text-zinc-300': 'text-[var(--lokvis-fg-subtle)]',
  'text-zinc-400': 'text-[var(--lokvis-fg-subtle)]',
  'text-zinc-500': 'text-[var(--lokvis-fg-muted)]',
  'text-zinc-600': 'text-[var(--lokvis-fg-muted)]',
  'text-zinc-700': 'text-[var(--lokvis-fg-muted)]',
  'text-zinc-800': 'text-[var(--lokvis-fg)]',
  'text-zinc-900': 'text-[var(--lokvis-fg)]',

  // border
  'border-zinc-100': 'border-[var(--lokvis-border)]',
  'border-zinc-200': 'border-[var(--lokvis-border)]',
  'border-zinc-300': 'border-[var(--lokvis-border-strong)]',
  'border-zinc-500': 'border-[var(--lokvis-border-strong)]',
  'border-zinc-700': 'border-[var(--lokvis-border)]',
  'border-zinc-800': 'border-[var(--lokvis-border)]',

  // ring
  'ring-zinc-200': 'ring-[var(--lokvis-border)]',
  'ring-indigo-200': 'ring-[var(--lokvis-primary)]/40',
  'ring-indigo-300': 'ring-[var(--lokvis-primary)]/50',
  'ring-indigo-400': 'ring-[var(--lokvis-primary)]',
  'ring-indigo-500': 'ring-[var(--lokvis-primary)]',
  'ring-indigo-600': 'ring-[var(--lokvis-primary)]',

  // accent
  'accent-indigo-600': 'accent-[var(--lokvis-primary)]',
  'accent-indigo-400': 'accent-[var(--lokvis-primary)]',

  // bg - primary
  'bg-indigo-50': 'bg-[var(--lokvis-primary)]/10',
  'bg-indigo-100': 'bg-[var(--lokvis-primary)]/15',
  'bg-indigo-200': 'bg-[var(--lokvis-primary)]/25',
  'bg-indigo-500': 'bg-[var(--lokvis-primary)]',
  'bg-indigo-600': 'bg-[var(--lokvis-primary-hover)]',
  'bg-indigo-700': 'bg-[var(--lokvis-primary-hover)]',

  // text - primary
  'text-indigo-300': 'text-[var(--lokvis-primary)]',
  'text-indigo-400': 'text-[var(--lokvis-primary)]',
  'text-indigo-500': 'text-[var(--lokvis-primary)]',
  'text-indigo-600': 'text-[var(--lokvis-primary)]',
  'text-indigo-700': 'text-[var(--lokvis-primary)]',

  // border - primary
  'border-indigo-200': 'border-[var(--lokvis-primary)]/40',
  'border-indigo-300': 'border-[var(--lokvis-primary)]/50',
  'border-indigo-400': 'border-[var(--lokvis-primary)]',
  'border-indigo-500': 'border-[var(--lokvis-primary)]',
  'border-indigo-700': 'border-[var(--lokvis-primary)]',
  'border-indigo-800': 'border-[var(--lokvis-primary)]',

  // bg - danger
  'bg-red-50': 'bg-[var(--lokvis-danger)]/10',
  'bg-red-100': 'bg-[var(--lokvis-danger)]/15',
  'bg-red-200': 'bg-[var(--lokvis-danger)]/30',
  'bg-red-500': 'bg-[var(--lokvis-danger)]',
  'bg-red-600': 'bg-[var(--lokvis-danger)]',
  'bg-red-700': 'bg-[var(--lokvis-danger-hover)]',

  // text - danger
  'text-red-400': 'text-[var(--lokvis-danger)]',
  'text-red-500': 'text-[var(--lokvis-danger)]',
  'text-red-600': 'text-[var(--lokvis-danger)]',
  'text-red-700': 'text-[var(--lokvis-danger)]',

  // border - danger
  'border-red-200': 'border-[var(--lokvis-danger)]/30',
  'border-red-300': 'border-[var(--lokvis-danger)]/40',
  'border-red-400': 'border-[var(--lokvis-danger)]',
  'border-red-500': 'border-[var(--lokvis-danger)]',
  'border-red-800': 'border-[var(--lokvis-danger)]',

  // bg - success
  'bg-emerald-50': 'bg-[var(--lokvis-success)]/10',
  'bg-emerald-100': 'bg-[var(--lokvis-success)]/15',
  'bg-emerald-500': 'bg-[var(--lokvis-success)]',

  // text - success
  'text-emerald-400': 'text-[var(--lokvis-success)]',
  'text-emerald-500': 'text-[var(--lokvis-success)]',
  'text-emerald-600': 'text-[var(--lokvis-success)]',
  'text-emerald-700': 'text-[var(--lokvis-success)]',

  // bg - warning
  'bg-amber-100': 'bg-[var(--lokvis-warning)]/15',
  'bg-amber-500': 'bg-[var(--lokvis-warning)]',

  // text - warning
  'text-amber-400': 'text-[var(--lokvis-warning)]',
  'text-amber-500': 'text-[var(--lokvis-warning)]',
  'text-amber-600': 'text-[var(--lokvis-warning)]',
  'text-amber-700': 'text-[var(--lokvis-warning)]',

  // bg - info
  'bg-blue-100': 'bg-[var(--lokvis-info)]/15',

  // text - info
  'text-blue-100': 'text-[var(--lokvis-info)]',
  'text-blue-900': 'text-[var(--lokvis-info)]',

  // yellow (badge warning 别名)
  'bg-yellow-100': 'bg-[var(--lokvis-warning)]/15',
  'text-yellow-900': 'text-[var(--lokvis-warning)]',

  // overlay
  'bg-black/30': 'bg-[var(--lokvis-overlay)]',
  'bg-black/20': 'bg-[var(--lokvis-overlay)]',
  'bg-black/50': 'bg-[var(--lokvis-overlay)]',
};

/** 按键长度降序排列,避免短键误匹配 */
const sortedEntries = Object.entries(colorMap).sort(
  (a, b) => b[0].length - a[0].length,
);

/**
 * dark: 类匹配:可选前导空格 + dark: + Tailwind 合法字符
 * 仅匹配 Tailwind class 合法字符集(a-zA-Z0-9 _ / : . -),避免误吞引号/反引号
 */
const darkClassRe = new RegExp(' ?dark:[a-zA-Z0-9_/:.-]+', 'g');

/**
 * @param {string} filePath
 */
function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  let content = original;

  // 阶段 1:删除所有 dark: 变体类
  content = content.replace(darkClassRe, '');

  // 阶段 2:按映射表替换(长键优先)
  for (const [from, to] of sortedEntries) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
    }
  }

  // 阶段 3:合并连续空格(仅处理 className 中的空格,不触碰其他内容)
  content = content.replace(/ {2,}/g, ' ');

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  return false;
}

const files = [
  // ui-core (12)
  'packages/ui-core/src/components/badge.tsx',
  'packages/ui-core/src/components/button.tsx',
  'packages/ui-core/src/components/card.tsx',
  'packages/ui-core/src/components/dialog.tsx',
  'packages/ui-core/src/components/empty-state.tsx',
  'packages/ui-core/src/components/icon.tsx',
  'packages/ui-core/src/components/select.tsx',
  'packages/ui-core/src/components/slider.tsx',
  'packages/ui-core/src/components/spinner.tsx',
  'packages/ui-core/src/components/tabs.tsx',
  'packages/ui-core/src/components/toggle.tsx',
  'packages/ui-core/src/components/tooltip.tsx',
  // ui-react (19)
  'packages/ui-react/src/components/AssetPanel.tsx',
  'packages/ui-react/src/components/Canvas.tsx',
  'packages/ui-react/src/components/CommandPalette.tsx',
  'packages/ui-react/src/components/CompareSlider.tsx',
  'packages/ui-react/src/components/DownloadPanel.tsx',
  'packages/ui-react/src/components/ErrorBanner.tsx',
  'packages/ui-react/src/components/ExifPanel.tsx',
  'packages/ui-react/src/components/GlobalDropzone.tsx',
  'packages/ui-react/src/components/HistoryPanel.tsx',
  'packages/ui-react/src/components/Inspector.tsx',
  'packages/ui-react/src/components/ParamForm.tsx',
  'packages/ui-react/src/components/PipelineBar.tsx',
  'packages/ui-react/src/components/ProgressBar.tsx',
  'packages/ui-react/src/components/StatusBar.tsx',
  'packages/ui-react/src/components/ThemeToggle.tsx',
  'packages/ui-react/src/components/Toolbar.tsx',
  'packages/ui-react/src/components/WorkflowEditor.tsx',
  'packages/ui-react/src/components/WorkflowTemplates.tsx',
  'packages/ui-react/src/components/Workspace.tsx',
];

let changed = 0;
for (const f of files) {
  if (processFile(f)) {
    console.log('CHANGED', f);
    changed++;
  } else {
    console.log('skip   ', f);
  }
}
console.log('\nTotal changed: ' + changed + '/' + files.length);
