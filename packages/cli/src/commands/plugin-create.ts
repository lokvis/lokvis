/**
 * `lokvis plugin create <name>` 命令
 *
 * 在当前目录下脚手架一个新的 lokvis 插件包。
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface CreatePluginOptions {
  /** 作者名 */
  author?: string;
  /** 描述 */
  description?: string;
}

/**
 * 名称格式校验:支持两种形式
 * - 普通名:`my-plugin`(lowercase kebab-case)
 * - scoped 名:`@scope/name`(npm scoped package)
 *
 * 注意:此前版本用 `^[a-z0-9-]+$` 校验,会拒绝所有 scoped 名,
 * 导致下方 `name.startsWith('@')` 分支成为不可达死代码。
 * 现放宽到 scoped 形式以支持用户自定义命名空间。
 */
const NAME_PATTERN = /^@?[a-z0-9-]+(?:\/[a-z0-9-]+)?$/;

export async function createPlugin(
  name: string,
  targetDir?: string,
  options: CreatePluginOptions = {}
): Promise<string> {
  if (!NAME_PATTERN.test(name)) {
    throw new Error(
      'Plugin name must be lowercase kebab-case (a-z, 0-9, -) or scoped (@scope/name)'
    );
  }

  const dir = resolve(process.cwd(), targetDir ?? name);
  const pkgName = name.startsWith('@') ? name : `@lokvis-plugin/${name}`;
  const author = options.author ?? 'anonymous';
  const description = options.description ?? `${name} - a Lokvis plugin`;

  await mkdir(dir, { recursive: true });
  await mkdir(resolve(dir, 'src'), { recursive: true });

  await writeFile(
    resolve(dir, 'package.json'),
    JSON.stringify(
      {
        name: pkgName,
        version: '0.1.0',
        description,
        license: 'MIT',
        type: 'module',
        main: './dist/index.js',
        types: './dist/index.d.ts',
        exports: {
          '.': {
            types: './dist/index.d.ts',
            import: './dist/index.js',
          },
        },
        files: ['dist', 'src'],
        scripts: {
          build: 'tsc -p tsconfig.json',
          dev: 'tsc -p tsconfig.json --watch',
          typecheck: 'tsc --noEmit',
        },
        dependencies: {
          '@lokvis/schema': 'workspace:*',
          '@lokvis/plugin-sdk': 'workspace:*',
        },
        devDependencies: {
          typescript: '^5.6.0',
        },
        lokvis: {
          kind: 'plugin',
          author,
        },
      },
      null,
      2
    ) + '\n'
  );

  await writeFile(
    resolve(dir, 'tsconfig.json'),
    JSON.stringify(
      {
        extends: '../../tsconfig.base.json',
        compilerOptions: {
          outDir: './dist',
          rootDir: './src',
        },
        include: ['src/**/*'],
      },
      null,
      2
    ) + '\n'
  );

  await writeFile(
    resolve(dir, 'src', 'index.ts'),
    `/**
 * ${name}
 *
 * ${description}
 */

import { definePlugin } from '@lokvis/plugin-sdk';
import type { Capability } from '@lokvis/schema';

const CAPABILITIES: Capability[] = [
  // 在此声明插件提供的能力
];

export default function ${sanitize(name)}Plugin() {
  return definePlugin(
    {
      name: '${pkgName}',
      version: '0.1.0',
      description: '${description}',
      capabilities: CAPABILITIES,
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      // 在此注册能力实现
      // ctx.registerCapability({ capability, engine, execute })
      ctx.log('info', 'Plugin loaded');
    }
  );
}
`
  );

  await writeFile(
    resolve(dir, 'README.md'),
    `# ${name}

${description}

## Develop

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

## License

MIT
`
  );

  return dir;
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '');
}
