# Lokvis Engines

Engine 层是五层架构的最底层,职责是 **Blob ↔ Blob 的纯函数操作**,不感知
Asset / Workflow / Capability。本文档描述各 engine 包的现状、标准契约形态,
以及新增 engine 的 checklist。

> 契约裁决依据:[ADR-016](../docs/adr/016-engine-contract-ruling.md)。
> 浏览器 API 访问一律经 `@lokvis/browser-adapter`(见 [ADR-015](../docs/adr/015-browser-adapter-layer.md))。

## 标准契约:纯函数 + 描述符常量

所有 engine 包收敛为同一形态(**不强推 EngineAdapter 类**):

1. **无状态纯函数**:Blob 进 / Blob 出,可选 `AbortSignal`。参数统一接受
   `Record<string, any>`(见 AGENTS.md「Engine 操作函数的参数签名」),内部用
   单次 `as` 断言,避免上游 `as unknown as` 双断言。
2. **描述符常量**:导出一个 `XXX_ENGINE` 常量,最小形状 `{ name, version }`;
   当插件需按能力清单推导时增加 `supportedCapabilities: string[]`。
3. **stub 单点判定**:engine 级 stub 以 `version.includes('stub')` 为唯一判据;
   插件层(plugin-*)读取描述符一次性推导,经 plugin-sdk 工厂写入
   `CapabilityImplementation.status`。

## 各 engine 现状

| 引擎 | 契约形态 | 描述符 | 实现依赖 | stub 状态 |
|------|---------|--------|---------|----------|
| `engine-image` | 纯函数(canvas-engine + operations/*)+ worker-adapter(Worker 入口协议) | `IMAGE_ENGINE` `{ name:'canvas', version, supportedCapabilities }` | 原生 Canvas + `@jsquash/avif`(WASM) | 实装 |
| `engine-pdf` | 纯函数 | `PDF_ENGINE` `{ name:'pdf-lib', version }` | pdf-lib(浏览器/Node 同构) | 实装;能力级豁免 ocr/sign(`REAL_STUB_CAPABILITIES`) |
| `engine-video` | 纯函数(浏览器 stub;`/node`、`/web` 子路径实装) | `VIDEO_ENGINE` `{ name:'ffmpeg-wasm', version }` | ffmpeg.wasm(浏览器)/ ffmpeg-static(Node) | 浏览器侧 `version` 含 `stub` |
| `engine-audio` | 纯函数(浏览器 stub;`/node` 实装) | `AUDIO_ENGINE` `{ name:'ffmpeg-wasm', version }` | ffmpeg-static(Node)/ Web Audio | 浏览器侧 `version` 含 `stub` |
| `engine-ai` | 纯函数 + 注入式工厂(`AiCloudCaller`) | `transformersEngine` / `cloudProxyEngine` 两个 | Cloud AI proxy | transformers 按 version;cloud-proxy 按运行时 `!cloudCaller` |

## EngineAdapter 契约的适用范围

`@lokvis/engine-core` 的 `EngineAdapter` / `EngineRegistry`(含 `selectBest()`
环境探测式选择)**保留为预留契约,当前 0 消费方**。真正承担"选哪个实现"职责
的是 runtime 的 `CapabilityRegistry`(声明式,按 `status` / `performance` / 策略
过滤,见 [docs/architecture.md](../docs/architecture.md) 双注册表一节)。

**启用条件**(两者同时满足才引入):

1. 同一媒体类型存在 ≥2 个可切换实现;
2. 切换判据需要运行时环境探测(`isSupported()`),无法用构建期元数据表达。

预期场景:image 引入 Squoosh WASM 后,canvas / squoosh 双实现按浏览器编码器
支持切换。在此之前,任何引擎不得以"对齐契约"为由包装 adapter 类——历史已证明
该抽象在单实现场景下是纯负担(audio/video/ai 均引入后又移除)。

### 豁免说明

- **engine-pdf 无 adapter**:pdf-lib 纯 JS,浏览器 / Node 同构,`isSupported()`
  恒真,探测式契约无信息量。
- **engine-image 的 worker-adapter 不是引擎选择机制**:它是 Worker 入口的协议
  桥(方法分发、BlobRef transferable 封装、cancel 语义),存在原因是 Worker 边界
  (结构化克隆)而非多实现选择,与 EngineAdapter 无竞争关系。

## 新增 engine checklist

1. 脚手架 `packages/engine-<name>`(对齐现有包模板:tsconfig / vitest / exports)。
2. 导出无状态纯函数(Blob ↔ Blob,参数 `Record<string, any>`)。
3. 导出描述符常量 `<NAME>_ENGINE`,最小 `{ name, version }`;需能力推导时加
   `supportedCapabilities`。
4. 浏览器 API(Canvas / OPFS / Workers / WebCodecs 等)一律经
   `@lokvis/browser-adapter`,**禁止**在 engine 源码直接触碰原生 API。
5. stub 实现:`version` 含 `'stub'`,所有操作方法抛
   `new Error('xxx not implemented in stub')`,`supportedCapabilities` 列出未来
   计划支持的能力(见 AGENTS.md「Stub Engine 处理」)。
6. 对应 plugin-* 包在 `buildXxxCapabilityImplementations()` 单点读取
   `version.includes('stub')`,经 plugin-sdk 工厂写入 `status`。
7. 测试:`src/__tests__/` 覆盖核心操作;浏览器 API 用 fake 实现。
8. 仅当满足上文「启用条件」时才引入 EngineAdapter,否则维持纯函数 + 描述符。
