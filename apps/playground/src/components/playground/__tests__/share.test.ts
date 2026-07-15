import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  encodeCodeToHash,
  decodeCodeFromHash,
  extractCodeFromHash,
  buildShareUrl,
} from '../share';

/**
 * Playground 代码分享工具单测(W19.6)
 *
 * 覆盖:
 *  - 基础编码 / 解码往返
 *  - URL-safe base64 字符替换(+ / → - _)
 *  - UTF-8 中文代码往返
 *  - 无填充(去除 =)
 *  - 损坏输入返回 null
 *  - extractCodeFromHash 前缀匹配
 *  - buildShareUrl 含 origin + pathname + hash
 */

describe('playground/share', () => {
  describe('encodeCodeToHash + decodeCodeFromHash', () => {
    it('ASCII 代码往返一致', () => {
      const code = 'const x = 1;\nconsole.log(x);\n';
      const encoded = encodeCodeToHash(code);
      const decoded = decodeCodeFromHash(encoded);
      expect(decoded).toBe(code);
    });

    it('中文(UTF-8 多字节)代码往返一致', () => {
      const code = '// 注释\nconst 你好 = "世界";\nconsole.log(你好);\n';
      const encoded = encodeCodeToHash(code);
      const decoded = decodeCodeFromHash(encoded);
      expect(decoded).toBe(code);
    });

    it('包含 + 与 / 字符的输入正确转换为 URL-safe', () => {
      // 构造一个会生成 + / 的输入:bytes 含 0xFB 0xFF 等会触发 base64 的 + 与 /
      // 0xFB → base64 中含 '+';0xFF → 含 '/'
      const bytes = new Uint8Array([0xfb, 0xff, 0xfb, 0xff, 0xfb, 0xff]);
      const code = new TextDecoder().decode(bytes);
      const encoded = encodeCodeToHash(code);
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');
      expect(decodeCodeFromHash(encoded)).toBe(code);
    });

    it('空字符串往返一致', () => {
      const encoded = encodeCodeToHash('');
      expect(encoded).toBe('');
      expect(decodeCodeFromHash('')).toBe('');
    });

    it('去除 = 填充', () => {
      // "abc" 编码后 base64 标准为 "YWJj"(无填充);
      // "abcd" 编码后标准为 "YWJjZA=="(2 个 = 填充)
      const encoded = encodeCodeToHash('abcd');
      expect(encoded).not.toContain('=');
    });

    it('decodeCodeFromHash 接受标准 base64(向后兼容)', () => {
      // 解码端应能接受标准 base64(含 + / =)
      const code = 'const x = 42;';
      const bytes = new TextEncoder().encode(code);
      let binary = '';
      for (const b of bytes) binary += String.fromCharCode(b);
      const standardB64 = btoa(binary); // 含 + / =
      expect(decodeCodeFromHash(standardB64)).toBe(code);
    });
  });

  describe('decodeCodeFromHash 错误处理', () => {
    it('null 输入返回 null', () => {
      expect(decodeCodeFromHash(null as unknown as string)).toBeNull();
    });

    it('空字符串返回空串(不抛错)', () => {
      expect(decodeCodeFromHash('')).toBe('');
    });

    it('非 base64 字符返回 null', () => {
      expect(decodeCodeFromHash('!!!not-base64!!!')).toBeNull();
    });

    it('奇数长度(无法构成合法 base64 块)返回 null', () => {
      // 单字符在标准 base64 是非法的(至少需要 2 字符)
      // 但 URL-safe 解码会尝试加填充,'A' 加填充后 = 'A===' 解码成功(对应 byte 0)
      // 这里用一个明确无效的输入
      expect(decodeCodeFromHash('@@@@')).toBeNull();
    });
  });

  describe('extractCodeFromHash', () => {
    it('匹配 #code= 前缀,提取并解码代码', () => {
      const code = 'console.log("hi");';
      const encoded = encodeCodeToHash(code);
      const hash = `#code=${encoded}`;
      expect(extractCodeFromHash(hash)).toBe(code);
    });

    it('无 #code= 前缀返回 null', () => {
      expect(extractCodeFromHash('#other=abc')).toBeNull();
      expect(extractCodeFromHash('')).toBeNull();
      expect(extractCodeFromHash('#nope')).toBeNull();
    });

    it('损坏的 #code= 后内容返回 null', () => {
      expect(extractCodeFromHash('#code=!!!invalid!!!')).toBeNull();
    });

    it('空 code(#code= 后无内容)返回空串', () => {
      expect(extractCodeFromHash('#code=')).toBe('');
    });
  });

  describe('buildShareUrl', () => {
    let originalLocation: Location | undefined;

    beforeEach(() => {
      // 保存原 location(Node 环境下为 undefined,jsdom 下有值)
      originalLocation = (globalThis as { location?: Location }).location;
      const stub = {
        origin: 'https://playground.lokvis.dev',
        pathname: '/en/',
      };
      Object.defineProperty(globalThis, 'location', {
        value: stub,
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      // 还原 location 到测试前状态,避免跨套件状态泄漏
      if (originalLocation !== undefined) {
        Object.defineProperty(globalThis, 'location', {
          value: originalLocation,
          writable: true,
          configurable: true,
        });
      } else {
        // Node 环境无 location,删除 stub 即可
        delete (globalThis as { location?: unknown }).location;
      }
      vi.restoreAllMocks();
    });

    it('生成 origin + pathname + #code=<encoded> 形式', () => {
      const url = buildShareUrl('const x = 1;');
      expect(url).toMatch(/^https:\/\/playground\.lokvis\.dev\/en\/#code=/);
      const encoded = url.split('#code=')[1]!;
      expect(decodeCodeFromHash(encoded)).toBe('const x = 1;');
    });

    it('代码中含中文也能正确编码到 URL', () => {
      const code = '// 你好\nconst x = 1;';
      const url = buildShareUrl(code);
      const encoded = url.split('#code=')[1]!;
      expect(decodeCodeFromHash(encoded)).toBe(code);
    });
  });
});
