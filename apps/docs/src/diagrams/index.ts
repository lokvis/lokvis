/**
 * Mermaid 图表源码聚合
 *
 * 各模块架构图字符串常量由此 re-export,供 pages/architecture.astro 等页面使用。
 * Mermaid 对缩进敏感,字符串内容保持原样,请勿重新格式化。
 */

export { workerSequenceDiagram, workerStateDiagram } from './worker.js';

export { engineWorkerFlow } from './engine.js';

export { historyStackStructure, historyOperationFlow, undoRedoFlow } from './history.js';

export { assetStoreFallbackFlow, assetStoreLayout } from './asset-store.js';

export { runtimeRunSequence } from './runtime.js';
