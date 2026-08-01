# ADR-018: FilePickerAdapter 实装并入 @lokvis/browser-adapter

- 状态:Accepted
- 日期:2026-07-31
- 关联:ADR-015(Browser Adapter Layer)、`docs/architecture-v2-tasks.md` G3、
  runtime `plugin-permissions.ts`(filesystem 权限)

## 背景

`packages/browser-adapter/src/file-picker.ts` 此前仅有类型声明(type-only stub),
无实现。G3 要求实装文件选择/保存/目录遍历能力面,覆盖:
- Chrome/Edge:原生 File System Access(`showOpenFilePicker` / `showSaveFilePicker` /
  `showDirectoryPicker`,真"另存为"对话框 + 目录句柄递归);
- Safari/Firefox:降级(`input[type=file]` / `a[download]` / `input[webkitdirectory]`);
- Node/SSR:无 window/document 时返回空/false,不抛 ReferenceError。

两个岔口需裁决:
1. 独立 `@lokvis/fs` 包承载,还是并入 `@lokvis/browser-adapter`?
2. 插件访问本地文件系统的权限如何强制?是否需为 FilePicker 加 monkey-patch 守卫?

## 决策

1. **并入 `@lokvis/browser-adapter`(不新建 `@lokvis/fs`)**:
   - File System Access 与 canvas / OPFS / Worker 同属"原生浏览器 API 抽象",
     同一 L1 层职责,ADR-015 已将 browser-adapter 定为**唯一**允许触碰
     `showOpenFilePicker` 等原生 API 的非展示层。独立成包只会增加包碎片与循环
     依赖风险。
   - 新增 `src/file-picker.ts` 模块,经主入口 `src/index.ts` 导出;
     `src/test-utils.ts` 增 `createFakeFilePicker()` 并入 `createFakeAdapter()`。

2. **依赖注入的 host 抽象,便于测试**:
   - `createFilePickerAdapter(host?: FilePickerHost)` 接受可选 window-like host,
     默认从 `globalThis` 解析(`showOpenFilePicker` / `showSaveFilePicker` /
     `showDirectoryPicker` / `document`)。
   - 测试注入 fake host 覆盖 native / fallback 两路 + 目录递归,不散乱
     `vi.stubGlobal`(ADR-015 测试约定)。
   - 取消(`AbortError`)语义:`pickFiles`/`pickDirectory` 返回空数组,
     `saveFile` 返回 `false`;其余错误上抛。

3. **权限模型:保持 runtime sandbox 主动断言,不为 FilePicker 加 monkey-patch 守卫**:
   - FilePicker 是**展示层/UI 使用的原生原语**,不绑定插件上下文;与 network
     guard(installPlugin 期间 monkey-patch fetch/XHR)语义不同。
   - 插件若需本地文件系统访问,应声明 `filesystem:local` / `filesystem:opfs` 并在
     调用前经 `ctx.sandbox.assertFilesystemAllowed(scope, reason)` 自检
     (runtime `plugin-permissions.ts` 已实现,抛 `PluginPermissionError`)。
   - `FilesystemGuardError`(预留未启用)保持占位:强行为 FilePicker 全局
     monkey-patch `showOpenFilePicker` 等属过度设计(覆盖面有限、破坏展示层
     正常用法),留待后续 W18.x strict mode 统一处理。ADR 明确此为**有意为之**,
     避免误判为遗漏接线。

4. **embed-kit 改道 FilePickerAdapter**:
   - `embed-kit/src/download.ts` 的 DOM 保存动作(`a[download]`)委托给
     FilePickerAdapter,不再散写 `document.createElement('a')`。
   - `downloadBlob(blob, name)`(同步、即时下载):构造 host **只传 document**
     (不含 `showSaveFilePicker`),强制走 `a[download]` 降级路径,**保持既有
     embed-* / playground 调用点与 e2e 行为不变**(不弹原生"另存为")。
   - 新增 `saveBlob(blob, name)`(异步):优先原生"另存为"对话框,降级 `a[download]`,
     供需要用户选择保存位置的新调用点 opt-in。
   - MIME 兜底修复(OPFS `application/octet-stream` → 据扩展名补全)保留在 embed-kit,
     属下载特定关切。embed-pdf / embed-video 的 re-export 保持不变。

## 影响

- `packages/browser-adapter/src/file-picker.ts`:type-only stub → 完整实现。
- `packages/browser-adapter/src/test-utils.ts`:新增 `createFakeFilePicker` +
  `FakeAdapterOverrides.filePicker`。
- `packages/browser-adapter/src/__tests__/file-picker.test.ts`:native / fallback /
  目录遍历 / 取消四类断言(注入 fake host)。
- `packages/embed-kit/package.json`:新增 `@lokvis/browser-adapter` 依赖。
- `packages/embed-kit/src/download.ts`:`downloadBlob` 改道 + 新增 `saveBlob`。

## 备选与放弃理由

- **独立 `@lokvis/fs` 包**:与 ADR-015 单一 adapter 层职责冲突,增加包碎片,放弃。
- **为 FilePicker monkey-patch filesystem guard**:破坏展示层正常用法且覆盖面有限,
  过度设计,放弃;权限交由 runtime sandbox 主动断言。
- **downloadBlob 直接改为优先原生另存为**:会改变既有下载按钮 UX 并破坏 playground
  e2e(依赖即时 `URL.createObjectURL` + a[download]),故拆分为 downloadBlob(即时)
  与 saveBlob(原生优先)两个 API。
