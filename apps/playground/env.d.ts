/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Sentry DSN,未配置时 Sentry 模块退化为 no-op(W12.3) */
  readonly PUBLIC_SENTRY_DSN?: string;
  /** Sentry release 标签,默认 'playground@0.1.0' */
  readonly PUBLIC_SENTRY_RELEASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
