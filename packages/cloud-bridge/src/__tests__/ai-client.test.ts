/**
 * CloudAiClient 单元测试(F1)
 *
 * 覆盖:
 * - 无 apiKey 时所有方法抛 auth 错误
 * - 参数校验(prompt / workflow / error 必填)
 * - HTTP 200 路径(成功返回 JSON)
 * - HTTP 401 / 402 / 500 错误分类
 * - 网络错误 / 超时(AbortError)
 * - createAiClient 工厂
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CloudAiClient,
  CloudAiError,
  createAiClient,
  CLOUD_PROXY_ENGINE_NAME,
  CLOUD_PROXY_ENGINE_VERSION,
} from '../ai-client.js';
import { resolveCloudConfig } from '../cloud-config.js';

describe('CloudAiClient 常量', () => {
  it('CLOUD_PROXY_ENGINE_NAME 应为 cloud-proxy', () => {
    expect(CLOUD_PROXY_ENGINE_NAME).toBe('cloud-proxy');
  });

  it('CLOUD_PROXY_ENGINE_VERSION 应为非 stub 的 0.1.0', () => {
    expect(CLOUD_PROXY_ENGINE_VERSION).toBe('0.1.0');
    expect(CLOUD_PROXY_ENGINE_VERSION.includes('stub')).toBe(false);
  });
});

describe('CloudAiClient 无 apiKey', () => {
  let client: CloudAiClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new CloudAiClient({ apiKey: undefined });
  });

  it('hasApiKey 应返回 false', () => {
    expect(client.hasApiKey()).toBe(false);
  });

  it('generateWorkflow 应抛 auth CloudAiError', async () => {
    await expect(
      client.generateWorkflow({ prompt: 'test' })
    ).rejects.toMatchObject({
      name: 'CloudAiError',
      kind: 'auth',
    });
  });

  it('optimizeWorkflow 应抛 auth CloudAiError', async () => {
    await expect(
      client.optimizeWorkflow({ workflow: { id: 'wf' } })
    ).rejects.toMatchObject({
      name: 'CloudAiError',
      kind: 'auth',
    });
  });

  it('diagnoseError 应抛 auth CloudAiError', async () => {
    await expect(
      client.diagnoseError({ error: { message: 'fail' } })
    ).rejects.toMatchObject({
      name: 'CloudAiError',
      kind: 'auth',
    });
  });
});

describe('CloudAiClient 参数校验', () => {
  let client: CloudAiClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new CloudAiClient({ apiKey: 'lk_' + 'a'.repeat(64) });
  });

  it('generateWorkflow 空 prompt 应抛 unknown 错误', async () => {
    await expect(
      client.generateWorkflow({ prompt: '' })
    ).rejects.toMatchObject({
      name: 'CloudAiError',
      kind: 'unknown',
    });
  });

  it('optimizeWorkflow 无 workflow 应抛 unknown 错误', async () => {
    await expect(
      client.optimizeWorkflow({ workflow: undefined })
    ).rejects.toMatchObject({
      name: 'CloudAiError',
      kind: 'unknown',
    });
  });

  it('diagnoseError 无 error.message 应抛 unknown 错误', async () => {
    await expect(
      client.diagnoseError({ error: { message: '' } })
    ).rejects.toMatchObject({
      name: 'CloudAiError',
      kind: 'unknown',
    });
  });
});

describe('CloudAiClient 成功路径', () => {
  let client: CloudAiClient;
  const mockResponse = { id: 'wf-1', nodes: [] };

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new CloudAiClient({ apiKey: 'lk_' + 'a'.repeat(64) });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response);
  });

  it('generateWorkflow 应 POST 并返回 JSON', async () => {
    const result = await client.generateWorkflow({ prompt: 'resize image' });
    expect(result).toEqual(mockResponse);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call![0]).toBe('https://api.lokvis.com/v1/ai/generate-workflow');
    expect(call![1]!.method).toBe('POST');
    const headers = call![1]!.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('lk_' + 'a'.repeat(64));
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('optimizeWorkflow 应 POST 并返回 JSON', async () => {
    const result = await client.optimizeWorkflow({ workflow: { id: 'wf' } });
    expect(result).toEqual(mockResponse);
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call![0]).toBe('https://api.lokvis.com/v1/ai/optimize-workflow');
  });

  it('diagnoseError 应 POST 并返回诊断报告', async () => {
    const report = {
      rootCause: 'bad node',
      remediation: ['fix it'],
      severity: 'error',
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => report,
    } as Response);
    const result = await client.diagnoseError({
      error: { message: 'exec failed' },
    });
    expect(result).toEqual(report);
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call![0]).toBe('https://api.lokvis.com/v1/ai/diagnose-error');
  });

  it('应使用自定义 apiBaseUrl', async () => {
    const custom = new CloudAiClient({
      apiKey: 'lk_' + 'a'.repeat(64),
      apiBaseUrl: 'https://custom.example.com',
    });
    await custom.generateWorkflow({ prompt: 'x' });
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call![0]).toBe('https://custom.example.com/v1/ai/generate-workflow');
  });
});

describe('CloudAiClient 错误分类', () => {
  let client: CloudAiClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new CloudAiClient({ apiKey: 'lk_' + 'a'.repeat(64) });
  });

  it('401 应抛 auth 错误', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ error: 'Invalid API key' }),
    } as Response);
    await expect(
      client.generateWorkflow({ prompt: 'x' })
    ).rejects.toMatchObject({
      name: 'CloudAiError',
      kind: 'auth',
      statusCode: 401,
    });
  });

  it('402 应抛 billing 错误并含 upgradeUrl', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 402,
      statusText: 'Payment Required',
      json: async () => ({ error: 'Insufficient credits' }),
    } as Response);
    await expect(
      client.generateWorkflow({ prompt: 'x' })
    ).rejects.toMatchObject({
      name: 'CloudAiError',
      kind: 'billing',
      statusCode: 402,
      upgradeUrl: 'https://app.lokvis.com/billing',
    });
  });

  it('500 应抛 server 错误', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ error: 'Cloud AI is down' }),
    } as Response);
    await expect(
      client.generateWorkflow({ prompt: 'x' })
    ).rejects.toMatchObject({
      name: 'CloudAiError',
      kind: 'server',
      statusCode: 500,
    });
  });

  it('400 应抛 unknown 错误(非 401/402/5xx)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ error: 'Invalid prompt' }),
    } as Response);
    await expect(
      client.generateWorkflow({ prompt: 'x' })
    ).rejects.toMatchObject({
      name: 'CloudAiError',
      kind: 'unknown',
      statusCode: 400,
    });
  });

  it('网络错误应抛 network 错误', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('failed to fetch')
    );
    await expect(
      client.generateWorkflow({ prompt: 'x' })
    ).rejects.toMatchObject({
      name: 'CloudAiError',
      kind: 'network',
    });
  });

  it('AbortError(超时)应抛 network 错误含 timed out', async () => {
    const abortErr = new DOMException('Aborted', 'AbortError');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(abortErr);
    await expect(
      client.generateWorkflow({ prompt: 'x' })
    ).rejects.toMatchObject({
      name: 'CloudAiError',
      kind: 'network',
    });
  });

  it('错误响应体非 JSON 时应回退到 statusText', async () => {
    // 用非 JSON 字符串构造 Response,使 res.json() 抛错(走 catch 回退到 statusText)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('not JSON', {
        status: 503,
        statusText: 'Service Unavailable',
      })
    );
    await expect(
      client.generateWorkflow({ prompt: 'x' })
    ).rejects.toMatchObject({
      name: 'CloudAiError',
      kind: 'server',
      statusCode: 503,
    });
  });
});

describe('createAiClient 工厂', () => {
  it('应从 CloudConfig 构造 CloudAiClient', () => {
    const config = resolveCloudConfig({
      LOKVIS_API_KEY: 'lk_' + 'a'.repeat(64),
      LOKVIS_API_BASE_URL: 'https://factory.example.com',
      LOKVIS_UPGRADE_URL: 'https://factory.example.com/billing',
    });
    const client = createAiClient(config);
    expect(client).toBeInstanceOf(CloudAiClient);
    expect(client.hasApiKey()).toBe(true);
  });

  it('无 LOKVIS_API_KEY 时 hasApiKey 应为 false', () => {
    const config = resolveCloudConfig({});
    const client = createAiClient(config);
    expect(client.hasApiKey()).toBe(false);
  });
});

describe('CloudAiError', () => {
  it('应正确设置 name / kind / statusCode / upgradeUrl', () => {
    const err = new CloudAiError('test', 'billing', 402, 'https://x');
    expect(err.name).toBe('CloudAiError');
    expect(err.message).toBe('test');
    expect(err.kind).toBe('billing');
    expect(err.statusCode).toBe(402);
    expect(err.upgradeUrl).toBe('https://x');
    expect(err).toBeInstanceOf(Error);
  });
});
