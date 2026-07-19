/**
 * R1 · JWT 解码器(developer.jwt.decode)
 *
 * 输入 token → 执行 → 显示 header / payload / signature。
 * 调用 plugin-dev 的 developer.jwt.decode capability(不验证签名)。
 */
import { useState } from 'react';
import { useDevTool } from '@/components/toolkit/useDevTool';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface JwtDecodeResult {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string | undefined;
  headerAlg: string | undefined;
  headerTyp: string | undefined;
  payloadIat: number | undefined;
  payloadExp: number | undefined;
  payloadSub: string | undefined;
  payloadIss: string | undefined;
}

const SAMPLE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

export default function JwtDecoder() {
  return (
    <ErrorBoundary>
      <JwtDecoderContent />
    </ErrorBoundary>
  );
}

function JwtDecoderContent() {
  const { ready, busy, error, result, execute } = useDevTool();
  const [token, setToken] = useState(SAMPLE_JWT);

  const handleExecute = () => {
    void execute('developer.jwt.decode', { token });
  };

  const jwtResult = result as JwtDecodeResult | null;

  const formatTime = (ts: number | undefined): string => {
    if (ts === undefined) return '-';
    return `${ts} (${new Date(ts * 1000).toISOString()})`;
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-100">JWT 解码器</h1>
        <p className="mt-1 text-sm text-zinc-500">
          解析 JWT 三段结构(header.payload.signature),提取常见字段。调用 <code className="text-indigo-400">developer.jwt.decode</code> capability。
          <span className="ml-1 text-amber-400">⚠ 不验证签名,不能据此授权。</span>
        </p>
      </header>

      <section className="mb-4 space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">JWT Token</label>
          <textarea
            value={token}
            onChange={(e) => setToken(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
            placeholder="粘贴 JWT 字符串"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setToken(SAMPLE_JWT)}
            className="rounded-md bg-zinc-800 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-700"
          >
            填入示例
          </button>
          <button
            type="button"
            onClick={handleExecute}
            disabled={!ready || busy || !token.trim()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? '解码中...' : '解码'}
          </button>
        </div>
      </section>

      {error && (
        <div className="mb-4 rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {jwtResult && (
        <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="mb-2">
            <h2 className="text-sm font-semibold text-zinc-200">解码结果</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-2">
              <div className="text-zinc-500">alg</div>
              <div className="font-mono text-indigo-400">{jwtResult.headerAlg ?? '-'}</div>
            </div>
            <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-2">
              <div className="text-zinc-500">typ</div>
              <div className="font-mono text-indigo-400">{jwtResult.headerTyp ?? '-'}</div>
            </div>
            <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-2">
              <div className="text-zinc-500">sub</div>
              <div className="font-mono text-emerald-400">{jwtResult.payloadSub ?? '-'}</div>
            </div>
            <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-2">
              <div className="text-zinc-500">iss</div>
              <div className="font-mono text-emerald-400">{jwtResult.payloadIss ?? '-'}</div>
            </div>
            <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-2">
              <div className="text-zinc-500">iat</div>
              <div className="font-mono text-amber-400">{formatTime(jwtResult.payloadIat)}</div>
            </div>
            <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-2">
              <div className="text-zinc-500">exp</div>
              <div className="font-mono text-amber-400">{formatTime(jwtResult.payloadExp)}</div>
            </div>
          </div>

          {jwtResult.signature && (
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-400">Signature</div>
              <pre className="overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950/60 p-3 font-mono text-xs text-zinc-400">
                {jwtResult.signature}
              </pre>
            </div>
          )}

          <div>
            <div className="mb-1 text-xs font-medium text-zinc-400">Header(完整)</div>
            <pre className="overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950/60 p-3 font-mono text-xs text-indigo-300">
              {JSON.stringify(jwtResult.header, null, 2)}
            </pre>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-zinc-400">Payload(完整)</div>
            <pre className="overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950/60 p-3 font-mono text-xs text-emerald-300">
              {JSON.stringify(jwtResult.payload, null, 2)}
            </pre>
          </div>
        </section>
      )}
    </div>
  );
}
