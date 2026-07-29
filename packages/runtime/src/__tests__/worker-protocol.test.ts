/**
 * worker-protocol 单元测试
 *
 * 覆盖协议助手函数与类型守卫:
 * - createRequestId(UUID / 回退)
 * - isWorkerResponse / isWorkerPong / isWorkerReady / isWorkerEvent /
 *   isWorkerFatalError / isWorkerMessageToHost / isProtocolCompatible
 * - BlobRef / isBlobRef / unwrapBlobRef(Transferable 信封解包)
 */
import { describe, it, expect, vi } from 'vitest';
import {
  WORKER_PROTOCOL_VERSION,
  createRequestId,
  isWorkerResponse,
  isWorkerPong,
  isWorkerReady,
  isWorkerEvent,
  isWorkerFatalError,
  isWorkerMessageToHost,
  isProtocolCompatible,
  isBlobRef,
  unwrapBlobRef,
  type BlobRef,
} from '../worker-protocol.js';

describe('worker-protocol 助手', () => {
  it('createRequestId 应返回唯一字符串', () => {
    const a = createRequestId();
    const b = createRequestId();
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it('isWorkerResponse 应识别响应消息', () => {
    expect(isWorkerResponse({ id: '1', type: 'response', ok: true, result: 42 })).toBe(true);
    expect(
      isWorkerResponse({ id: '1', type: 'response', ok: false, error: { message: 'x' } })
    ).toBe(true);
    expect(isWorkerResponse({ type: 'pong' })).toBe(false);
    expect(isWorkerResponse(null)).toBe(false);
  });

  it('isWorkerPong / isWorkerReady / isWorkerEvent / isWorkerFatalError 类型守卫', () => {
    expect(isWorkerPong({ id: '1', type: 'pong', ts: 1 })).toBe(true);
    expect(isWorkerReady({ type: 'ready', protocolVersion: '0.1.0' })).toBe(true);
    expect(isWorkerEvent({ type: 'event', event: 'progress' })).toBe(true);
    expect(isWorkerFatalError({ type: 'error', message: 'boom' })).toBe(true);
    expect(isWorkerEvent({ type: 'error', message: 'boom' })).toBe(false);
  });

  it('isProtocolCompatible 应严格匹配版本', () => {
    expect(isProtocolCompatible(WORKER_PROTOCOL_VERSION)).toBe(true);
    expect(isProtocolCompatible('0.2.0')).toBe(false);
  });

  it('isWorkerMessageToHost 应识别所有合法的 Worker→Host 消息', () => {
    expect(isWorkerMessageToHost({ id: '1', type: 'response', ok: true, result: 1 })).toBe(true);
    expect(isWorkerMessageToHost({ id: '1', type: 'pong', ts: 1 })).toBe(true);
    expect(isWorkerMessageToHost({ type: 'event', event: 'progress' })).toBe(true);
    expect(isWorkerMessageToHost({ type: 'ready', protocolVersion: '0.1.0' })).toBe(true);
    expect(isWorkerMessageToHost({ type: 'error', message: 'boom' })).toBe(true);
  });

  it('isWorkerMessageToHost 应拒绝非消息对象 / 未知 type / Host→Worker 消息', () => {
    expect(isWorkerMessageToHost(null)).toBe(false);
    expect(isWorkerMessageToHost(undefined)).toBe(false);
    expect(isWorkerMessageToHost('string')).toBe(false);
    expect(isWorkerMessageToHost(42)).toBe(false);
    expect(isWorkerMessageToHost({ type: 'request' })).toBe(false);
    expect(isWorkerMessageToHost({ type: 'ping' })).toBe(false);
    expect(isWorkerMessageToHost({ type: 'cancel' })).toBe(false);
    expect(isWorkerMessageToHost({})).toBe(false);
    expect(isWorkerMessageToHost({ type: 'unknown' })).toBe(false);
  });

  it('createRequestId 在无 crypto.randomUUID 时应回退到 Date+random', () => {
    const original = globalThis.crypto;
    // 临时移除 randomUUID
    const cryptoStub = { ...original, randomUUID: undefined as unknown };
    vi.stubGlobal('crypto', cryptoStub);
    try {
      const id = createRequestId();
      expect(id).toMatch(/^req_\d+_/);
      const a = createRequestId();
      const b = createRequestId();
      expect(a).not.toBe(b);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('createRequestId 在有 crypto.randomUUID 时应返回 UUID', () => {
    // Node 24 默认有 crypto.randomUUID
    const id = createRequestId();
    // UUID 格式 8-4-4-4-12
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  // ─── BlobRef / unwrapBlobRef(Transferable 信封解包)──────

  it('isBlobRef 应识别合法 BlobRef 信封', () => {
    const ref: BlobRef = {
      kind: 'blob',
      meta: { size: 5, type: 'image/png' },
      buffer: new ArrayBuffer(5),
    };
    expect(isBlobRef(ref)).toBe(true);
  });

  it('isBlobRef 应拒绝非 BlobRef 值', () => {
    // 缺少 kind 字段(普通元数据对象,如 ImageProbeResult)
    expect(isBlobRef({ width: 100, height: 100 })).toBe(false);
    // kind 不匹配
    expect(isBlobRef({ kind: 'other', meta: {}, buffer: new ArrayBuffer(1) })).toBe(false);
    // buffer 不是 ArrayBuffer
    expect(
      isBlobRef({ kind: 'blob', meta: { size: 1, type: 'image/png' }, buffer: [1, 2, 3] })
    ).toBe(false);
    // meta 不是对象
    expect(
      isBlobRef({ kind: 'blob', meta: null, buffer: new ArrayBuffer(1) })
    ).toBe(false);
    // 原始值 / null / undefined
    expect(isBlobRef(null)).toBe(false);
    expect(isBlobRef(undefined)).toBe(false);
    expect(isBlobRef('string')).toBe(false);
    expect(isBlobRef(42)).toBe(false);
  });

  it('unwrapBlobRef 应从 BlobRef 重组 Blob(保留 size/type)', async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]);
    const buffer = bytes.buffer; // underlying ArrayBuffer
    const ref: BlobRef = {
      kind: 'blob',
      meta: { size: bytes.length, type: 'image/png' },
      buffer,
    };
    const result = unwrapBlobRef(ref);
    expect(result).toBeInstanceOf(Blob);
    const blob = result as Blob;
    expect(blob.size).toBe(bytes.length);
    expect(blob.type).toBe('image/png');
    // 内容一致(重组后的 Blob 字节与原 buffer 相同)
    const out = new Uint8Array(await blob.arrayBuffer());
    expect(out).toEqual(bytes);
  });

  it('unwrapBlobRef 对非 BlobRef 应原样返回(不重组)', () => {
    // ImageProbeResult 元数据对象(无 kind 字段)
    const probeResult = { width: 100, height: 100, mimeType: 'image/png', format: 'png', size: 42 };
    expect(unwrapBlobRef(probeResult)).toBe(probeResult);

    // 原始值
    expect(unwrapBlobRef(42)).toBe(42);
    expect(unwrapBlobRef('string')).toBe('string');
    expect(unwrapBlobRef(null)).toBe(null);
    expect(unwrapBlobRef(undefined)).toBe(undefined);
  });
});
