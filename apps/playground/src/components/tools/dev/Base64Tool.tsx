/**
 * R1 · Base64 编解码工具(developer.base64)
 *
 * 输入 mode(encode/decode) + input → 执行 → 显示 output。
 * 调用 plugin-dev 的 developer.base64 capability。
 */
import { useState } from 'react';
import { useDevTool } from '@/components/toolkit/useDevTool';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface Base64Result {
  mode: 'encode' | 'decode';
  inputBytes: number;
  outputBytes: number;
  outputMimeType: string;
  output: string;
  outputIsHex?: boolean;
}

export default function Base64Tool() {
  return (
    <ErrorBoundary>
      <Base64ToolContent />
    </ErrorBoundary>
  );
}

function Base64ToolContent() {
  const { ready, busy, error, result, execute } = useDevTool();
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [input, setInput] = useState('Hello, World!');

  const handleExecute = () => {
    void execute('developer.base64', { mode, input });
  };

  const base64Result = result as Base64Result | null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-100">Base64 编解码</h1>
        <p className="mt-1 text-sm text-zinc-500">
          编码文本为 Base64,或解码 Base64 为文本/二进制(非 UTF-8 时显示 hex)。调用 <code className="text-indigo-400">developer.base64</code> capability。
        </p>
      </header>

      <section className="mb-4 space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">模式</label>
          <div className="flex gap-2">
            {(['encode', 'decode'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-md px-4 py-2 text-sm font-medium ${
                  mode === m
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {m === 'encode' ? '编码 (text → base64)' : '解码 (base64 → text)'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">
            {mode === 'encode' ? '输入文本' : '输入 Base64'}
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={5}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
            placeholder={mode === 'encode' ? '输入要编码的文本' : '输入要解码的 Base64 字符串'}
          />
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleExecute}
            disabled={!ready || busy}
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

      {base64Result && (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">结果</h2>
            <span className="text-xs text-zinc-500">
              输入 {base64Result.inputBytes} 字节 · 输出 {base64Result.outputBytes} 字节
              {base64Result.outputIsHex && ' · hex 视图'}
            </span>
          </div>
          <pre className="overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950/60 p-3 font-mono text-sm text-emerald-300">
            {base64Result.output || '<空>'}
          </pre>
        </section>
      )}
    </div>
  );
}
