import { useEffect, useState } from 'react';
import { createLokvis } from '@lokvis/sdk';
import type { LokvisRuntime } from '@lokvis/runtime';
import imageToolsPlugin from '@lokvis/plugin-image';
import devToolsPlugin from '@lokvis/plugin-dev';
import { Button } from '@lokvis/ui-core';

/**
 * Lokvis Playground
 *
 * 一个简化的代码编辑器，让用户在浏览器里尝试 @lokvis/sdk API。
 * 左侧代码，右侧输出。
 */

const DEFAULT_CODE = `// Lokvis Playground
// 在浏览器中尝试 Lokvis SDK

const lokvis = await createLokvis({
  plugins: [imageToolsPlugin(), devToolsPlugin()],
});

// 列出所有能力
const caps = await lokvis.capabilities();
console.log('已注册能力：', caps.length, '个');

// 导入示例图片（用 fetch 替代 File）
// const blob = await fetch('/sample.png').then(r => r.blob());
// const id = await lokvis.importAsset({ kind: 'blob', blob, name: 'sample.png' });
// console.log('Asset ID:', id);
`;

export function Playground() {
  const [runtime, setRuntime] = useState<LokvisRuntime | null>(null);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [output, setOutput] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const rt = await createLokvis({
          plugins: [imageToolsPlugin(), devToolsPlugin()],
        });
        setRuntime(rt);
        rt.eventBus.onAny((e) => {
          setOutput((prev) => [
            ...prev,
            `[event] ${e.type}`,
          ]);
        });
      } catch (err) {
        setOutput((prev) => [
          ...prev,
          `[error] ${err instanceof Error ? err.message : String(err)}`,
        ]);
      }
    })();
  }, []);

  async function handleRun() {
    if (!runtime) return;
    setRunning(true);
    setOutput([]);
    const originalLog = console.log;
    const originalError = console.error;
    const logs: string[] = [];
    console.log = (...args) => {
      logs.push(args.map(String).join(' '));
      originalLog(...args);
    };
    console.error = (...args) => {
      logs.push(`[error] ${args.map(String).join(' ')}`);
      originalError(...args);
    };
    try {
      // 用 new Function 在隔离作用域执行
      const fn = new Function(
        'createLokvis',
        'imageToolsPlugin',
        'devToolsPlugin',
        'lokvis',
        `"use strict";\nreturn (async () => {\n${code}\n})();`
      );
      await fn(createLokvis, imageToolsPlugin, devToolsPlugin, runtime);
    } catch (err) {
      logs.push(`[error] ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      console.log = originalLog;
      console.error = originalError;
      setOutput(logs);
      setRunning(false);
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span>◆</span>
          <span className="font-semibold">Lokvis Playground</span>
          {runtime && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              Runtime ready
            </span>
          )}
        </div>
        <Button onClick={handleRun} loading={running} size="sm">
          Run
        </Button>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          className="flex-1 resize-none bg-zinc-50 p-4 font-mono text-sm dark:bg-zinc-950"
        />
        <pre className="flex-1 overflow-auto bg-zinc-900 p-4 text-xs text-zinc-100">
          {output.length === 0
            ? '/* output will appear here */'
            : output.join('\n')}
        </pre>
      </div>
    </div>
  );
}
