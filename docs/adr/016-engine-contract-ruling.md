# ADR-016: Engine 契约裁决 —— 纯函数 + 描述符为标准形态,EngineAdapter 保留为预留契约

- 状态:Accepted
- 日期:2026-07-30
- 关联:ADR-015(Browser Adapter Layer)、O3(engine-ai 定位)、`docs/architecture-v2-tasks.md` B1

## 背景

`@lokvis/engine-core` 定义了 `EngineAdapter` 接口与 `EngineRegistry`(含
`selectBest()` 环境探测式选择、`createEngineRegistry()` 工厂),设计意图是
"每种媒体类型多个引擎实现,运行时按 `isSupported()` 探测选优"。

现实演化结果:**全部五个引擎包都收敛为"纯函数 + 描述符常量"形态,
EngineAdapter / EngineRegistry 在全仓已无任何消费方**(engine-audio /
engine-video / engine-ai 均在模块头注释中记录了移除历史)。真正承担
"选择哪个实现"职责的是 runtime 的 `CapabilityRegistry`(声明式,按
`status` / `performance` / 策略过滤,见 §双注册表分工)。

三种历史现状需要一次裁决:统一回 EngineAdapter,还是承认现状为标准?

## 现状盘点

| 引擎 | 契约形态 | 描述符 | 描述符形状 | stub 判定 |
|------|---------|--------|-----------|----------|
| engine-image | 纯函数(canvas-engine + operations/*)+ worker-adapter(Worker 入口协议) | `IMAGE_ENGINE` | `{ name, version, supportedCapabilities }` | `version.includes('stub')` → false(实装) |
| engine-pdf | 纯函数(pdf-lib) | `PDF_ENGINE` | `{ name, version }` | 同上 → false;另有能力级覆盖 `REAL_STUB_CAPABILITIES`(ocr/sign) |
| engine-video | 纯函数(浏览器 stub;`/node`、`/web` 子路径实装) | `VIDEO_ENGINE` | `{ name, version }` | `'0.7.1-stub'` → true(浏览器侧) |
| engine-audio | 纯函数(浏览器 stub;`/node` 实装) | `AUDIO_ENGINE` | `{ name, version }` | `'0.7.1-stub'` → true(浏览器侧) |
| engine-ai | 纯函数 + 注入式工厂(`AiCloudCaller`) | `transformersEngine` / `cloudProxyEngine` 两个 | `{ name, version, supportedCapabilities }` | transformers 按 version;cloud-proxy 按 `!cloudCaller`(运行时) |

`EngineRegistry.selectBest` 消费方:0。`CapabilityRegistry.resolve`
(runtime/src/capability-registry.ts)是唯一实际生效的选择机制。
engine-image 的 package.json 仍依赖 engine-core,但 src 从不导入(陈旧依赖)。

## 决策

1. **不强推 EngineAdapter 统一。标准引擎契约 = 纯函数 + 描述符常量**:
   - 引擎包导出无状态纯函数(Blob 进 / Blob 出,可选 `AbortSignal`);
   - 导出一个描述符常量(`XXX_ENGINE`),最小形状 `{ name, version }`;
     当插件需要按能力清单推导(如 image 的 10 个能力、ai 的双引擎分账)时
     增加 `supportedCapabilities: string[]`;
   - 插件层(plugin-*)读取描述符单点推导 stub 状态,经 plugin-sdk 工厂
     将 `status: 'stub' | 'stable'` 写入 CapabilityImplementation。

2. **EngineAdapter / EngineRegistry 保留为预留契约,不删除、不扩散**:
   - 启用条件(两者同时满足才引入):同一媒体类型存在 ≥2 个可切换实现,
     且切换判据需要运行时环境探测(`isSupported()`),无法用构建期元数据表达。
     预期场景:image 引入 Squoosh WASM 后 canvas/squoosh 双实现按浏览器
     编码器支持切换;
   - 在此之前,任何引擎不得以"对齐契约"为由包装 adapter 类——历史已证明
     该抽象在单实现场景下是纯负担(audio/video/ai 均引入后又移除)。

3. **stub 约定单点化**:engine 级 stub 以 `version.includes('stub')` 为唯一
   判据。两处能力级豁免(非 engine 级,不视为偏离):
   - plugin-pdf `REAL_STUB_CAPABILITIES`:引擎整体实装,个别能力(ocr/sign)
     未落地,能力级覆盖;
   - plugin-ai cloud-proxy `!cloudCaller`:stub 与否取决于运行时是否注入
     云调用器,构建期版本号无法表达。

## 豁免说明(pdf / image 的"偏离"为何合理)

- **engine-pdf 无 adapter**:pdf-lib 为纯 JS,浏览器 / Node 同构,不存在
  环境分叉,`isSupported()` 恒真——探测式契约无信息量。
- **engine-image 的 worker-adapter 不是引擎选择机制**:它是 Worker 入口的
  协议桥(方法分发、BlobRef transferable 封装、cancel 语义),存在原因是
  Worker 边界(结构化克隆)而非多实现选择,与 EngineAdapter 无竞争关系。
  其与 runtime worker-protocol 的类型刻意重复以避免 Engine→Runtime 反向
  依赖,同步责任已在两处代码注释中声明。

## 双注册表分工(详见 docs/architecture.md)

| | EngineRegistry(engine-core,预留) | CapabilityRegistry(runtime,生效) |
|---|---|---|
| 选择粒度 | 每媒体类型选一个引擎 | 每能力选一个实现 |
| 判据 | 运行时 `isSupported()` 环境探测 | 构建期元数据:`status` 过滤 stub + `performance` × 策略(first/fastest/balanced) |
| 时机 | 异步,首次使用时 | 同步,`resolve(name, preferredEngine?)` |
| 现状 | 0 消费方 | runtime 执行链唯一入口 |

## 后果

- 新增引擎 checklist(E2 将写入 packages/ENGINES.md):纯函数 + 描述符 +
  插件侧 stub 推导 + 浏览器 API 一律经 @lokvis/browser-adapter(ADR-015);
- engine-image 移除对 engine-core 的陈旧依赖(随本 ADR 落地);
- engine-core 保持现状发布(接口无维护成本);若未来两个大版本内预留
  条件仍未出现,可在 1.0 前评估将其并入 schema 或归档;
- 描述符形状不回填统一:pdf/audio/video 补 `supportedCapabilities` 无消费方,
  属过度设计,维持最小形状。
