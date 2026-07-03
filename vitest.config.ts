import { defineConfig } from 'vitest/config';

/**
 * Vitest 根配置
 *
 * 统一管理 monorepo 内所有包的单元测试。
 * 各包测试文件放在 src/__tests__/*.test.ts，直接从 src 源码导入。
 *
 * 覆盖率(PROJECT_PLAN 1.4):
 * - 仅统计「已进入测试的核心包」,排除 stub 引擎 / 未测试的 cli/sdk/ui 等,
 *   避免未实现模块把整体覆盖率拉低到无意义水位。
 * - 阈值采用「当前基线 - 安全余量」作为下限,保证 CI 绿;
 *   目标是 M1.2(2026.10)前随测试补齐逐步 ratchet 到 lines 70%。
 * - `pnpm test` 默认开启覆盖率(每次测试输出覆盖率数据),
 *   `pnpm test:fast` 跳过覆盖率用于快速迭代。
 */
export default defineConfig({
  test: {
    // 包含所有包内的测试文件(.ts 逻辑测试 + .tsx 组件测试)
    // 组件测试文件用 `// @vitest-environment jsdom` 注解单独切换环境,
    // 全局保持 node 以免影响纯逻辑测试。
    include: [
      'packages/**/src/__tests__/**/*.test.ts',
      'packages/**/src/__tests__/**/*.test.tsx',
    ],
    environment: 'node',
    globals: false,
    // 工作区解析由 pnpm 处理，无需额外 alias
    coverage: {
      provider: 'v8',
      // text:终端表格; text-summary:汇总块; json-summary:结构化 JSON(供 CI 消费); lcov:CI/lcov
      reporter: ['text', 'text-summary', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',

      // 仅统计已进入测试范围的核心包源码
      include: [
        'packages/runtime/src/**/*.ts',
        'packages/schema/src/**/*.ts',
        'packages/capability/src/**/*.ts',
        'packages/engine-image/src/**/*.ts',
        'packages/plugin-image/src/**/*.ts',
        // W4.6 后 ui-core 已有 @testing-library/react 单测,纳入覆盖率统计
        'packages/ui-core/src/**/*.{ts,tsx}',
      ],
      // 排除:测试文件、barrel index、纯类型文件、stub/未测试包
      exclude: [
        'packages/**/src/__tests__/**',
        'packages/**/src/**/index.ts',
        'packages/**/src/**/types.ts',
        // ui-core 的样式文件不计入覆盖率
        'packages/ui-core/src/**/*.css',
        // stub 引擎 / 未实现模块
        'packages/engine-pdf/**',
        'packages/engine-video/**',
        'packages/engine-audio/**',
        'packages/engine-ai/**',
        'packages/plugin-pdf/**',
        'packages/plugin-video/**',
        'packages/plugin-dev/**',
        // 尚无测试的包(测试在后续周次补齐后纳入)
        'packages/cli/**',
        'packages/sdk/**',
        'packages/plugin-sdk/**',
        'packages/ui-react/**',
        'packages/examples/**',
        'apps/**',
      ],

      // 阈值:当前基线下限(实测 lines 64.3%),随测试补齐 ratchet 至 lines 70%(M1.2 目标)
      thresholds: {
        lines: 60,
        statements: 60,
        functions: 60,
        branches: 75,
      },
    },
  },
});
