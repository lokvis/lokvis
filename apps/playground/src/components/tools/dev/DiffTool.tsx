/**
 * R1 · 文本 Diff 对比工具(developer.diff)
 *
 * 输入 left / right 文本 + context 行数 → 执行 → 显示 unified-diff 风格 hunks。
 * 调用 plugin-dev 的 developer.diff capability(基于 LCS 算法)。
 */
import { useState } from 'react';
import { useDevTool } from '@/components/toolkit/useDevTool';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface DiffLine {
  type: 'equal' | 'delete' | 'insert';
  text: string;
  leftLine?: number;
  rightLine?: number;
}

interface DiffHunk {
  leftStart: number;
  leftCount: number;
  rightStart: number;
  rightCount: number;
  lines: DiffLine[];
}

interface DiffResult {
  leftLineCount: number;
  rightLineCount: number;
  hunkCount: number;
  hunks: DiffHunk[];
}

export default function DiffTool() {
  return (
    <ErrorBoundary>
      <DiffToolContent />
    </ErrorBoundary>
  );
}

function DiffToolContent() {
  const { ready, busy, error, result, execute } = useDevTool();
  const [left, setLeft] = useState('line1\nline2\nline3\nline4');
  const [right, setRight] = useState('line1\nCHANGED\nline3\nline5');
  const [context, setContext] = useState(3);

  const handleExecute = () => {
    void execute('developer.diff', { left, right, context });
  };

  const diffResult = result as DiffResult | null;

  const lineColor = (type: DiffLine['type']) => {
    if (type === 'delete') return 'bg-red-950/40 text-red-300';
    if (type === 'insert') return 'bg-emerald-950/40 text-emerald-300';
    return 'text-zinc-400';
  };

  const linePrefix = (type: DiffLine['type']) => {
    if (type === 'delete') return '-';
    if (type === 'insert') return '+';
    return ' ';
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-100">文本 Diff 对比</h1>
        <p className="mt-1 text-sm text-zinc-500">
          基于 LCS 算法的行级文本对比,生成 unified-diff 风格的 hunks。调用 <code className="text-indigo-400">developer.diff</code> capability。
        </p>
      </header>

      <section className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Left(原始文本)</label>
          <textarea
            value={left}
            onChange={(e) => setLeft(e.target.value)}
            rows={8}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Right(修改后文本)</label>
          <textarea
            value={right}
            onChange={(e) => setRight(e.target.value)}
            rows={8}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </section>

      <section className="mb-4 flex items-end justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Context(上下文行数)</label>
          <input
            type="number"
            min={0}
            max={10}
            value={context}
            onChange={(e) => setContext(Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
            className="w-20 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={handleExecute}
          disabled={!ready || busy}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? '执行中...' : '对比'}
        </button>
      </section>

      {error && (
        <div className="mb-4 rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {diffResult && (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">Diff 结果</h2>
            <span className="text-xs text-zinc-500">
              {diffResult.hunkCount} hunks · left {diffResult.leftLineCount} 行 · right {diffResult.rightLineCount} 行
            </span>
          </div>
          {diffResult.hunks.length === 0 ? (
            <p className="text-sm text-emerald-400">文本完全相同</p>
          ) : (
            <div className="space-y-4">
              {diffResult.hunks.map((hunk, hi) => (
                <div key={hi} className="overflow-hidden rounded-md border border-zinc-800">
                  <div className="border-b border-zinc-800 bg-zinc-950/60 px-3 py-1 text-xs text-zinc-500">
                    @@ -{hunk.leftStart},{hunk.leftCount} +{hunk.rightStart},{hunk.rightCount} @@
                  </div>
                  <pre className="overflow-x-auto text-xs">
                    {hunk.lines.map((line, li) => (
                      <div key={li} className={`px-3 py-0.5 font-mono ${lineColor(line.type)}`}>
                        <span className="mr-2 select-none">{linePrefix(line.type)}</span>
                        <span>{line.text || '<空行>'}</span>
                      </div>
                    ))}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
