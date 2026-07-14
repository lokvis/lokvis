/**
 * @lokvis/workflow
 *
 * Lokvis Workflow 层 - 线性工作流构造工具(WorkflowBuilder + buildLinearWorkflow)。
 *
 * 架构位置:UI → Workflow → Runtime → Capability → Engine
 * 依赖方向:@lokvis/workflow 依赖 @lokvis/schema(类型 + 校验常量),
 * 不依赖 @lokvis/runtime(执行器属于 Runtime 层)。
 */

export * from './workflow-builder.js';
export * from './build-linear-workflow.js';
