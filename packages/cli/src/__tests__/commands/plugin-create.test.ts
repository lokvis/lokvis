/**
 * `lokvis plugin create <name>` 命令单元测试
 *
 * 验证 createPlugin 的:
 * 1. 名称格式校验(kebab-case)
 * 2. 目录创建(根目录 + src/)
 * 3. 文件生成内容(package.json / tsconfig.json / src/index.ts / README.md)
 * 4. options(author / description)透传
 * 5. scoped name(@scope/name)处理
 *
 * 通过 vi.mock 替换 node:fs/promises,避免触碰真实文件系统;
 * process.cwd() 通过 vi.spyOn 替换为固定值,使 resolve 结果可预测。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolve } from 'node:path';

// 桩 fs/promises,捕获 mkdir / writeFile 调用而不触碰真实文件系统
const mkdirMock = vi.fn(async (_path: string, _opts?: { recursive: boolean }) => undefined);
const writeFileMock = vi.fn(async (_path: string, _data: string) => undefined);
vi.mock('node:fs/promises', () => ({
  mkdir: mkdirMock,
  writeFile: writeFileMock,
}));

const { createPlugin } = await import('../../commands/plugin-create.js');

const FAKE_CWD = '/fake/cwd';

describe('createPlugin', () => {
  beforeEach(() => {
    mkdirMock.mockReset();
    writeFileMock.mockReset();
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);
    vi.spyOn(process, 'cwd').mockReturnValue(FAKE_CWD);
  });

  describe('名称校验', () => {
    it.each([
      ['含大写', 'MyPlugin'],
      ['含下划线', 'my_plugin'],
      ['含空格', 'my plugin'],
      ['含点', 'my.plugin'],
      ['空字符串', ''],
    ])('非法名称 "%s" (%s) 应抛错', async (_label, name) => {
      await expect(createPlugin(name)).rejects.toThrow(
        'Plugin name must be lowercase kebab-case (a-z, 0-9, -) or scoped (@scope/name)'
      );
      expect(mkdirMock).not.toHaveBeenCalled();
      expect(writeFileMock).not.toHaveBeenCalled();
    });

    it.each([
      ['simple', 'my-plugin'],
      ['含数字', 'plugin-123'],
      ['单段', 'plugin'],
      ['多段', 'a-b-c-d'],
      ['scoped', '@my-scope/my-plugin'],
    ])('合法名称 "%s" (%s) 应通过校验', async (_label, name) => {
      await createPlugin(name);
      expect(mkdirMock).toHaveBeenCalled();
    });
  });

  describe('目录创建', () => {
    it('未指定 targetDir 时应在 cwd/<name> 创建', async () => {
      await createPlugin('my-plugin');
      // 应调用 mkdir 两次:根目录 + src/
      expect(mkdirMock).toHaveBeenCalledTimes(2);
      expect(mkdirMock).toHaveBeenCalledWith(
        resolve(FAKE_CWD, 'my-plugin'),
        { recursive: true }
      );
      expect(mkdirMock).toHaveBeenCalledWith(
        resolve(FAKE_CWD, 'my-plugin', 'src'),
        { recursive: true }
      );
    });

    it('指定 targetDir 时应在 cwd/<targetDir> 创建', async () => {
      await createPlugin('my-plugin', './some/nested/dir');
      expect(mkdirMock).toHaveBeenCalledWith(
        resolve(FAKE_CWD, './some/nested/dir'),
        { recursive: true }
      );
      expect(mkdirMock).toHaveBeenCalledWith(
        resolve(FAKE_CWD, './some/nested/dir', 'src'),
        { recursive: true }
      );
    });

    it('应返回目录的绝对路径', async () => {
      const dir = await createPlugin('my-plugin');
      expect(dir).toBe(resolve(FAKE_CWD, 'my-plugin'));
    });
  });

  describe('文件生成', () => {
    it('应生成 4 个文件(package.json / tsconfig.json / src/index.ts / README.md)', async () => {
      await createPlugin('my-plugin');
      expect(writeFileMock).toHaveBeenCalledTimes(4);
      const paths = writeFileMock.mock.calls.map((c) => c[0]);
      expect(paths).toContain(resolve(FAKE_CWD, 'my-plugin', 'package.json'));
      expect(paths).toContain(resolve(FAKE_CWD, 'my-plugin', 'tsconfig.json'));
      expect(paths).toContain(resolve(FAKE_CWD, 'my-plugin', 'src', 'index.ts'));
      expect(paths).toContain(resolve(FAKE_CWD, 'my-plugin', 'README.md'));
    });

    it('package.json 应包含 @lokvis-plugin 命名空间与 lokvis 字段', async () => {
      await createPlugin('my-plugin');
      const pkgCall = writeFileMock.mock.calls.find(
        (c) => c[0] === resolve(FAKE_CWD, 'my-plugin', 'package.json')
      )!;
      const pkg = JSON.parse(pkgCall[1] as string);
      expect(pkg.name).toBe('@lokvis-plugin/my-plugin');
      expect(pkg.version).toBe('0.1.0');
      expect(pkg.license).toBe('MIT');
      expect(pkg.type).toBe('module');
      expect(pkg.dependencies['@lokvis/schema']).toBe('workspace:*');
      expect(pkg.dependencies['@lokvis/plugin-sdk']).toBe('workspace:*');
      expect(pkg.lokvis).toEqual({ kind: 'plugin', author: 'anonymous' });
    });

    it('package.json 应反映 options.author 与 options.description', async () => {
      await createPlugin('my-plugin', undefined, {
        author: 'alice',
        description: 'A cool plugin',
      });
      const pkgCall = writeFileMock.mock.calls.find(
        (c) => c[0] === resolve(FAKE_CWD, 'my-plugin', 'package.json')
      )!;
      const pkg = JSON.parse(pkgCall[1] as string);
      expect(pkg.description).toBe('A cool plugin');
      expect(pkg.lokvis.author).toBe('alice');
    });

    it('tsconfig.json 应继承 ../../tsconfig.base.json', async () => {
      await createPlugin('my-plugin');
      const tsCall = writeFileMock.mock.calls.find(
        (c) => c[0] === resolve(FAKE_CWD, 'my-plugin', 'tsconfig.json')
      )!;
      const ts = JSON.parse(tsCall[1] as string);
      expect(ts.extends).toBe('../../tsconfig.base.json');
      expect(ts.compilerOptions.outDir).toBe('./dist');
      expect(ts.compilerOptions.rootDir).toBe('./src');
      expect(ts.include).toEqual(['src/**/*']);
    });

    it('src/index.ts 应包含 definePlugin 调用与插件名', async () => {
      await createPlugin('my-plugin');
      const idxCall = writeFileMock.mock.calls.find(
        (c) => c[0] === resolve(FAKE_CWD, 'my-plugin', 'src', 'index.ts')
      )!;
      const content = idxCall[1] as string;
      expect(content).toContain("import { definePlugin } from '@lokvis/plugin-sdk'");
      expect(content).toContain("'@lokvis-plugin/my-plugin'");
      // 函数名应去除连字符(sanitize)
      expect(content).toContain('function mypluginPlugin()');
    });

    it('README.md 应包含插件名与描述', async () => {
      await createPlugin('my-plugin', undefined, {
        description: 'A cool plugin',
      });
      const rdCall = writeFileMock.mock.calls.find(
        (c) => c[0] === resolve(FAKE_CWD, 'my-plugin', 'README.md')
      )!;
      const content = rdCall[1] as string;
      expect(content).toContain('# my-plugin');
      expect(content).toContain('A cool plugin');
      expect(content).toContain('MIT');
    });
  });

  describe('scoped name', () => {
    it('以 @ 开头的名称应原样作为包名', async () => {
      await createPlugin('@my-scope/my-plugin');
      const pkgCall = writeFileMock.mock.calls.find(
        (c) => c[0] === resolve(FAKE_CWD, '@my-scope/my-plugin', 'package.json')
      )!;
      const pkg = JSON.parse(pkgCall[1] as string);
      expect(pkg.name).toBe('@my-scope/my-plugin');
    });
  });

  describe('错误传播', () => {
    it('mkdir 失败应上抛', async () => {
      mkdirMock.mockRejectedValue(new Error('EACCES'));
      await expect(createPlugin('my-plugin')).rejects.toThrow('EACCES');
    });

    it('writeFile 失败应上抛', async () => {
      writeFileMock.mockRejectedValue(new Error('disk full'));
      await expect(createPlugin('my-plugin')).rejects.toThrow('disk full');
    });
  });
});
