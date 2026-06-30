import { defineConfig } from 'vitest/config';

/**
 * Vitest 根配置
 *
 * 统一管理 monorepo 内所有包的单元测试。
 * 各包测试文件放在 src/__tests__/*.test.ts，直接从 src 源码导入。
 */
export default defineConfig({
  test: {
    // 包含所有包内的测试文件
    include: ['packages/**/src/__tests__/**/*.test.ts'],
    environment: 'node',
    globals: false,
    // 工作区解析由 pnpm 处理，无需额外 alias
  },
});
