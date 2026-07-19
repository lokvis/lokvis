/**
 * R1 · 正则表达式测试器(developer.regex.test)
 *
 * 输入 pattern / flags / testText → 执行 → 显示 matches 列表(match / index / groups)。
 * 调用 plugin-dev 的 developer.regex.test capability。
 */
import { useState } from 'react';
import { useDevTool } from '@/components/toolkit/useDevTool';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface RegexMatch {
  match: string;
  index: number;
  groups: Record<string, string | undefined> | undefined;
}

interface RegexResult {
  pattern: string;
  flags: string;
  inputLength: number;
  matchCount: number;
  matches: RegexMatch[];
}

export default function RegexTester() {
  return (
    <ErrorBoundary>
      <RegexTesterContent />
    </ErrorBoundary>
  );
}

function RegexTesterContent() {
  const { ready, busy, error, result, execute } = useDevTool();
  const [pattern, setPattern] = useState('\\d+');
  const [flags, setFlags] = useState('g');
  const [testText, setTestText] = useState('abc 123 def 456');

  const handleExecute = () => {
    void execute('developer.regex.test', { pattern, flags, testText });
  };

  const regexResult = result as RegexResult | null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-100">正则表达式测试器</h1>
        <p className="mt-1 text-sm text-zinc-500">
          测试正则表达式的匹配结果,支持全局匹配、具名捕获组、零宽匹配防护。调用 <code className="text-indigo-400">developer.regex.test</code> capability。
        </p>
      </header>

      <section className="mb-4 space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Pattern</label>
          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="\\d+"
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Flags</label>
          <input
            type="text"
            value={flags}
            onChange={(e) => setFlags(e.target.value)}
            placeholder="gim"
            className="w-32 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">测试文本</label>
          <textarea
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            rows={5}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
            placeholder="输入要测试的文本"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleExecute}
            disabled={!ready || busy || !pattern}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? '执行中...' : '执行'}
          </button>
        </div>
      </section>

      {error && (
        <div className="mb-4 rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {regexResult && (
        <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">匹配结果</h2>
            <span className="text-xs text-zinc-500">
              {regexResult.matchCount} 个匹配 · 输入 {regexResult.inputLength} 字符
            </span>
          </div>
          {regexResult.matches.length === 0 ? (
            <p className="text-sm text-zinc-500">无匹配</p>
          ) : (
            <ul className="space-y-2">
              {regexResult.matches.map((m, i) => (
                <li key={i} className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs text-zinc-400">
                    <span className="font-mono">#{i + 1}</span>
                    <span>index: {m.index}</span>
                  </div>
                  <div className="font-mono text-sm text-emerald-300">
                    {m.match === '' ? '<空匹配>' : m.match}
                  </div>
                  {m.groups && (
                    <dl className="mt-2 space-y-1 border-t border-zinc-800 pt-2">
                      {Object.entries(m.groups).map(([k, v]) => (
                        <div key={k} className="flex gap-2 text-xs">
                          <dt className="font-mono text-indigo-400">{k}:</dt>
                          <dd className="font-mono text-zinc-300">{v ?? '<undefined>'}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
