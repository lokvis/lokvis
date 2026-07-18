/**
 * @lokvis/engine-ai 单元测试(F1)
 *
 * 遵循 AGENTS.md 测试约定:
 * - Vitest,globals: false(显式 import)
 * - 中文测试描述
 * - 覆盖:6 个 stub 操作 / 3 个 cloud-proxy 工厂 / 引擎元数据 / 类型导出
 *
 * O-16:ocr / caption 已移至 `@lokvis/engine-ai/structured` 子路径,
 * 测试从 ../structured.js 导入。
 */
import { describe, it, expect } from 'vitest';
import {
  removeBackground,
  generateWorkflow,
  optimizeWorkflow,
  diagnoseError,
  createGenerateWorkflowOperation,
  createOptimizeWorkflowOperation,
  createDiagnoseErrorOperation,
  transformersEngine,
  cloudProxyEngine,
  CLOUD_PROXY_ENGINE_VERSION,
  TRANSFORMERS_ENGINE_VERSION,
} from '../index.js';
import type {
  AiCloudCaller,
  GenerateWorkflowParams,
  OptimizeWorkflowParams,
  DiagnoseErrorParams,
  DiagnoseErrorReport,
} from '../index.js';
// O-16:ocr / caption 从 structured 子路径导入
import { ocr, caption } from '../structured.js';
import type { OcrResult, CaptionResult } from '../structured.js';

describe('engine-ai 引擎版本常量', () => {
  it('TRANSFORMERS_ENGINE_VERSION 应为 0.0.0-stub', () => {
    expect(TRANSFORMERS_ENGINE_VERSION).toBe('0.0.0-stub');
    expect(TRANSFORMERS_ENGINE_VERSION.includes('stub')).toBe(true);
  });

  it('CLOUD_PROXY_ENGINE_VERSION 应为 0.1.0(非 stub,F1 实装)', () => {
    expect(CLOUD_PROXY_ENGINE_VERSION).toBe('0.1.0');
    expect(CLOUD_PROXY_ENGINE_VERSION.includes('stub')).toBe(false);
  });
});

describe('transformersEngine 元数据', () => {
  it('应包含正确的 name / version / supportedCapabilities', () => {
    expect(transformersEngine.name).toBe('transformers-js');
    expect(transformersEngine.version).toBe(TRANSFORMERS_ENGINE_VERSION);
    expect(transformersEngine.supportedCapabilities).toEqual([
      'ai.ocr',
      'ai.caption',
      'ai.background-remove',
    ]);
  });
});

describe('cloudProxyEngine 元数据', () => {
  it('应包含正确的 name / version / supportedCapabilities', () => {
    expect(cloudProxyEngine.name).toBe('cloud-proxy');
    expect(cloudProxyEngine.version).toBe(CLOUD_PROXY_ENGINE_VERSION);
    expect(cloudProxyEngine.supportedCapabilities).toEqual([
      'ai.generate-workflow',
      'ai.optimize-workflow',
      'ai.diagnose-error',
    ]);
  });
});

describe('transformers-js 浏览器 stub 操作', () => {
  it('ocr 应抛 "not implemented in stub"', async () => {
    await expect(ocr(new Blob([]))).rejects.toThrow(/not implemented in stub/);
    await expect(ocr(new Blob([]))).rejects.toThrow(/transformers-js/);
  });

  it('caption 应抛 "not implemented in stub"', async () => {
    await expect(caption(new Blob([]))).rejects.toThrow(
      /not implemented in stub/
    );
    await expect(caption(new Blob([]))).rejects.toThrow(/transformers-js/);
  });

  it('removeBackground 应抛 "not implemented in stub"', async () => {
    await expect(removeBackground(new Blob([]))).rejects.toThrow(
      /not implemented in stub/
    );
    await expect(removeBackground(new Blob([]))).rejects.toThrow(
      /transformers-js/
    );
  });
});

describe('cloud-proxy 默认 stub 操作(无 caller 注入)', () => {
  it('generateWorkflow 应抛 "not implemented in stub"', async () => {
    await expect(generateWorkflow({ prompt: 'x' })).rejects.toThrow(
      /not implemented in stub/
    );
    await expect(generateWorkflow({ prompt: 'x' })).rejects.toThrow(
      /cloud-proxy/
    );
  });

  it('optimizeWorkflow 应抛 "not implemented in stub"', async () => {
    await expect(optimizeWorkflow({ workflow: {} })).rejects.toThrow(
      /not implemented in stub/
    );
    await expect(optimizeWorkflow({ workflow: {} })).rejects.toThrow(
      /cloud-proxy/
    );
  });

  it('diagnoseError 应抛 "not implemented in stub"', async () => {
    await expect(
      diagnoseError({ error: { message: 'fail' } })
    ).rejects.toThrow(/not implemented in stub/);
    await expect(
      diagnoseError({ error: { message: 'fail' } })
    ).rejects.toThrow(/cloud-proxy/);
  });
});

describe('cloud-proxy 操作工厂(注入 caller)', () => {
  /** Mock caller:把传入参数回显为结果,便于验证参数透传 */
  const mockCaller: AiCloudCaller = {
    generateWorkflow: async (p: GenerateWorkflowParams) => ({
      called: 'generateWorkflow',
      params: p,
    }),
    optimizeWorkflow: async (p: OptimizeWorkflowParams) => ({
      called: 'optimizeWorkflow',
      params: p,
    }),
    diagnoseError: async (
      p: DiagnoseErrorParams
    ): Promise<DiagnoseErrorReport> => ({
      rootCause: 'mock root cause',
      remediation: ['step1', 'step2'],
      suspectNodeId: p.nodeId,
      severity: 'error',
    }),
  };

  it('createGenerateWorkflowOperation 应委托 caller.generateWorkflow', async () => {
    const op = createGenerateWorkflowOperation(mockCaller);
    const result = (await op({ prompt: 'resize image' })) as {
      called: string;
      params: GenerateWorkflowParams;
    };
    expect(result.called).toBe('generateWorkflow');
    expect(result.params.prompt).toBe('resize image');
  });

  it('createOptimizeWorkflowOperation 应委托 caller.optimizeWorkflow', async () => {
    const op = createOptimizeWorkflowOperation(mockCaller);
    const result = (await op({
      workflow: { id: 'wf' },
      prompt: 'faster',
    })) as { called: string; params: OptimizeWorkflowParams };
    expect(result.called).toBe('optimizeWorkflow');
    expect(result.params.workflow).toEqual({ id: 'wf' });
    expect(result.params.prompt).toBe('faster');
  });

  it('createDiagnoseErrorOperation 应委托 caller.diagnoseError 并返回报告', async () => {
    const op = createDiagnoseErrorOperation(mockCaller);
    const report = await op({
      error: { message: 'exec failed' },
      nodeId: 'node-3',
    });
    expect(report.rootCause).toBe('mock root cause');
    expect(report.remediation).toEqual(['step1', 'step2']);
    expect(report.suspectNodeId).toBe('node-3');
    expect(report.severity).toBe('error');
  });
});

describe('类型导出', () => {
  it('OcrResult / CaptionResult / DiagnoseErrorReport 类型应可被引用', () => {
    const ocrResult: OcrResult = {
      text: 'hello',
      confidence: 0.95,
    };
    const captionResult: CaptionResult = {
      text: 'a cat',
      confidence: 0.9,
    };
    const report: DiagnoseErrorReport = {
      rootCause: 'x',
      remediation: [],
      severity: 'info',
    };
    expect(ocrResult.text).toBe('hello');
    expect(captionResult.text).toBe('a cat');
    expect(report.rootCause).toBe('x');
  });
});
