/**
 * W11.5 分享链接 encode/decode 单元测试
 *
 * 测试 encodeWorkflowForShare / decodeWorkflowFromShare 纯函数:
 * - 往返一致性(encode → decode 还原)
 * - UTF-8 安全(中文水印)
 * - base64url 安全(无 +/= 字符)
 * - 无效输入容错
 */
import { describe, it, expect } from 'vitest';
import {
  encodeWorkflowForShare,
  decodeWorkflowFromShare,
} from '../hooks/useShareLink.js';

describe('W11.5 分享链接编解码', () => {
  const sampleNodes = [
    { capability: 'image.resize', params: { width: 1920, fit: 'inside' } },
    { capability: 'image.compress', params: { format: 'webp', quality: 80 } },
  ];

  it('encode → decode 应还原原始节点', () => {
    const encoded = encodeWorkflowForShare(sampleNodes);
    const decoded = decodeWorkflowFromShare(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded).toHaveLength(2);
    const node0 = decoded![0];
    const node1 = decoded![1];
    expect(node0?.capability).toBe('image.resize');
    expect(node0?.params).toEqual({ width: 1920, fit: 'inside' });
    expect(node1?.capability).toBe('image.compress');
    expect(node1?.params).toEqual({ format: 'webp', quality: 80 });
  });

  it('编码结果应为 base64url(无 + / = 字符)', () => {
    const encoded = encodeWorkflowForShare(sampleNodes);
    expect(encoded).not.toMatch(/[+/=]/);
    // 应只包含 base64url 字符
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('中文水印(UTF-8)应正确编解码', () => {
    const nodesWithChinese = [
      {
        capability: 'image.watermark',
        params: { text: '@用户名', position: 'bottom-right' },
      },
    ];
    const encoded = encodeWorkflowForShare(nodesWithChinese);
    const decoded = decodeWorkflowFromShare(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded![0]?.params.text).toBe('@用户名');
  });

  it('空节点数组应可编码(空 JSON 数组)', () => {
    const encoded = encodeWorkflowForShare([]);
    const decoded = decodeWorkflowFromShare(encoded);
    expect(decoded).toEqual([]);
  });

  it('单节点应正确编解码', () => {
    const single = [{ capability: 'image.crop', params: { x: 0, y: 0, width: 100, height: 100 } }];
    const encoded = encodeWorkflowForShare(single);
    const decoded = decodeWorkflowFromShare(encoded);
    expect(decoded).toHaveLength(1);
    expect(decoded![0]?.capability).toBe('image.crop');
  });

  it('5 步工作流(上限)应正确编解码', () => {
    const fiveNodes = Array.from({ length: 5 }, (_, i) => ({
      capability: 'image.resize',
      params: { step: i + 1 },
    }));
    const encoded = encodeWorkflowForShare(fiveNodes);
    const decoded = decodeWorkflowFromShare(encoded);
    expect(decoded).toHaveLength(5);
    expect(decoded![4]?.params.step).toBe(5);
  });

  it('无效 base64 字符串应返回 null', () => {
    expect(decodeWorkflowFromShare('!!!invalid!!!')).toBeNull();
  });

  it('非 JSON 内容应返回 null', () => {
    // 编码一个非 JSON 字符串
    const encoded = btoa('not a json');
    expect(decodeWorkflowFromShare(encoded)).toBeNull();
  });

  it('缺少 v 字段应返回 null(向前兼容校验)', () => {
    const invalid = btoa(JSON.stringify({ nodes: [] }));
    expect(decodeWorkflowFromShare(invalid)).toBeNull();
  });

  it('v 字段不为 1 应返回 null(版本不兼容)', () => {
    const invalid = btoa(JSON.stringify({ v: 2, nodes: [] }));
    expect(decodeWorkflowFromShare(invalid)).toBeNull();
  });

  it('nodes 非数组应返回 null', () => {
    const invalid = btoa(JSON.stringify({ v: 1, nodes: 'not-array' }));
    expect(decodeWorkflowFromShare(invalid)).toBeNull();
  });

  it('params 字段缺失时应默认为空对象', () => {
    const nodesWithoutParams = [{ c: 'image.resize' }];
    const encoded = btoa(JSON.stringify({ v: 1, nodes: nodesWithoutParams }));
    const decoded = decodeWorkflowFromShare(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded![0]?.params).toEqual({});
  });

  it('capability 字段应为字符串', () => {
    const encoded = btoa(
      JSON.stringify({ v: 1, nodes: [{ c: 123, p: {} }] })
    );
    const decoded = decodeWorkflowFromShare(encoded);
    expect(decoded).not.toBeNull();
    expect(typeof decoded![0]?.capability).toBe('string');
    expect(decoded![0]?.capability).toBe('123');
  });
});
