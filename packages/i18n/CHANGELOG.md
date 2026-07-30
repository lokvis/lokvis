# @lokvis/i18n

## 0.9.0

## 0.8.1

## 0.8.0

### Minor Changes

- [`b34013d`](https://github.com/lokvis/lokvis/commit/b34013dde7f4d1801e19c2cb27009d3a2383b858) Thanks [@xiongyy](https://github.com/xiongyy)! - 新增 @lokvis/i18n 最底层 i18n 核心包，收敛此前分散在 ui-react / embed-image / embed-video / embed-pdf / playground 的 5 份重复实现。

  核心包统一导出语言配置（languages / defaultLang / langList / Language）、URL·路径处理（isLanguage / getLangFromUrl / localizePath / switchLangPath / LANG_PREFIX_RE）与字典翻译原语（interpolate / translate / pluralKey）。各消费包仅保留自身 `ui` 字典、Provider 与类型化 hook 封装（config.ts 改为 re-export，utils.ts 委托核心），字典 key 命名空间仍独立演进。
