/**
 * R1 · 哈希计算器(developer.hash)
 *
 * 输入 algorithm + input → 执行 → 显示 digestHex / digest(base64)。
 * 调用 plugin-dev 的 developer.hash capability。
 * SHA-* 用 Web Crypto API,MD5 用纯 TS 实现。
 */
import { useState } from 'react';
import { useDevTool } from '@/components/toolkit/useDevTool';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface HashResult {
  algorithm: string;
  inputBytes: number;
  digest: string;
  digestHex: string;
}

const ALGORITHMS = ['sha-1', 'sha-256', 'sha-384', 'sha-512', 'md5'] as const;

export default function HashTool() {
  return (
    <ErrorBoundary>
      <HashToolContent />
    </ErrorBoundary>
  );
}

function HashToolContent() {
  const { ready, busy, error, result, execute } = useDevTool();
  const [algorithm, setAlgorithm] = useState<string>('sha-256');
  const [input, setInput] = useState('Hello, World!');

  const handleExecute = () => {
    void execute('developer.hash', { algorithm, input });
  };

  const hashResult = result as HashResult | null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-100">哈希计算器</h1>
        <p className="mt-1 text-sm text-zinc-500">
          计算输入文本的哈希值,支持 SHA-1/SHA-256/SHA-384/SHA-512/MD5。调用 <code className="text-indigo-400">developer.hash</code> capability。
          {algorithm === 'md5' && (
            <span className="ml-1 text-amber-400">⚠ MD5 已被破解,不应用于安全场景。</span>
          )}
        </p>
      </header>

      <section className="mb-4 space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">算法</label>
          <div className="flex flex-wrap gap-2">
            {ALGORITHMS.map((alg) => (
              <button
                key={alg}
                type="button"
                onClick={() => setAlgorithm(alg)}
                className={`rounded-md px-3 py-1.5 font-mono text-xs ${
                  algorithm === alg
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {alg}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">输入文本</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={5}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
            placeholder="输入要计算哈希的文本"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleExecute}
            disabled={!ready || busy}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? '计算中...' : '计算哈希'}
          </button>
        </div>
      </section>

      {error && (
        <div className="mb-4 rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {hashResult && (
        <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">{hashResult.algorithm.toUpperCase()} 结果</h2>
            <span className="text-xs text-zinc-500">输入 {hashResult.inputBytes} 字节</span>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-400">Hex</div>
            <pre className="overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950/60 p-3 font-mono text-xs text-emerald-300">
              {hashResult.digestHex}
            </pre>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-400">Base64</div>
            <pre className="overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950/60 p-3 font-mono text-xs text-zinc-300">
              {hashResult.digest}
            </pre>
          </div>
        </section>
      )}
    </div>
  );
}
