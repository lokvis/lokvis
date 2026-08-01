# @lokvis/browser-adapter

## 0.10.0

## 0.9.0

### Minor Changes

- [`58ecd94`](https://github.com/lokvis/lokvis/commit/58ecd949f5a8685acf19a7faad9cccd8912812e3) Thanks [@xiongyy](https://github.com/xiongyy)! - Browser Adapter Layer(ADR-015):新增 @lokvis/browser-adapter 包,收敛全仓原生浏览器 API 访问点。

  - 新包 `@lokvis/browser-adapter`:EnvProbe(浏览器能力/UA 探测)、FormatSupportProbe(编码格式真实支持探测)、MediaProbe(图像尺寸/媒体时长)、Storage(OPFS 根句柄)、KVStore(Dexie 封装的通用 KV 存储)、CanvasFactory、WorkerFactory,以及 `./test-utils` 子路径的内存 fake。
  - runtime:browser-detect / 媒体探测 / OPFS / IndexedDB 访问全部改经 adapter;Dexie 依赖移入 adapter。测试注入点从 `dbInstance` / `metadataDb`(Dexie 实例)改为 `kvStore` / `metadataKvStore`(KVStore 接口);`browser-detect` 与 `isOpfsSupported` / `isIdbSupported` 保留 deprecated re-export。
  - engine-image:canvas 创建/编解码原语(OffscreenCanvas / document.createElement / toBlob / createImageBitmap)改经 adapter;`detectFormatSupport` 与 embed-image 的 `detectEncodeSupport` 统一为 adapter 单一实现。AVIF worker 的 `new Worker(new URL(...))` 因 bundler 静态识别约束保留字面量形态(ADR-015 豁免)。
  - embed-image:`internal/format-support` 收敛为 adapter re-export。
