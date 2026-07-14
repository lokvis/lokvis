/**
 * Re-export 入口(C1: WorkflowBuilder 已迁移至 @lokvis/workflow 包)
 *
 * 此文件保留为 re-export,维持 @lokvis/runtime 公共 API 兼容性
 * (index.ts 的 `export * from './workflow-builder.js'` 不变)。
 * 消费方应逐步迁移为直接依赖 @lokvis/workflow。
 */
export * from '@lokvis/workflow';
