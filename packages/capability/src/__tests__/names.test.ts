/**
 * 能力命名工具单元测试
 */
import { describe, it, expect } from 'vitest';
import {
  CAPABILITY_DOMAINS,
  CAPABILITY_NAMES,
  domainOf,
  actionOf,
  sameDomain,
} from '../names.js';

describe('domainOf', () => {
  it('应返回点分前的领域部分', () => {
    expect(domainOf('image.resize')).toBe('image');
    expect(domainOf('pdf.merge')).toBe('pdf');
    expect(domainOf('ai.generate-workflow')).toBe('ai');
  });

  it('多点情况应取第一段', () => {
    expect(domainOf('developer.inspect.capabilities')).toBe('developer');
  });

  it('无点时应返回原字符串', () => {
    expect(domainOf('asset')).toBe('asset');
  });
});

describe('actionOf', () => {
  it('应返回点分后的动作部分', () => {
    expect(actionOf('image.resize')).toBe('resize');
    expect(actionOf('pdf.merge')).toBe('merge');
  });

  it('多点情况应返回第一个点之后的所有内容', () => {
    expect(actionOf('developer.inspect.capabilities')).toBe('inspect.capabilities');
  });

  it('无点时应返回空字符串', () => {
    expect(actionOf('asset')).toBe('');
  });
});

describe('sameDomain', () => {
  it('同领域应返回 true', () => {
    expect(sameDomain('image.resize', 'image.compress')).toBe(true);
  });

  it('不同领域应返回 false', () => {
    expect(sameDomain('image.resize', 'pdf.merge')).toBe(false);
  });

  it('多点能力应按第一段比较', () => {
    expect(sameDomain('developer.inspect.asset', 'developer.profile')).toBe(true);
  });
});

describe('CAPABILITY_DOMAINS', () => {
  it('应包含所有核心领域', () => {
    expect(CAPABILITY_DOMAINS).toContain('image');
    expect(CAPABILITY_DOMAINS).toContain('video');
    expect(CAPABILITY_DOMAINS).toContain('audio');
    expect(CAPABILITY_DOMAINS).toContain('pdf');
    expect(CAPABILITY_DOMAINS).toContain('ai');
    expect(CAPABILITY_DOMAINS).toContain('asset');
  });
});

describe('CAPABILITY_NAMES', () => {
  it('每个能力名应符合 domain.action 命名规范', () => {
    for (const [, name] of Object.entries(CAPABILITY_NAMES)) {
      expect(name).toMatch(/^[a-z]+\.[a-z-]+$/);
    }
  });

  it('应包含图像核心能力', () => {
    expect(CAPABILITY_NAMES.IMAGE_RESIZE).toBe('image.resize');
    expect(CAPABILITY_NAMES.IMAGE_COMPRESS).toBe('image.compress');
    expect(CAPABILITY_NAMES.IMAGE_CONVERT).toBe('image.convert');
    expect(CAPABILITY_NAMES.IMAGE_CROP).toBe('image.crop');
  });

  it('应包含 PDF 核心能力', () => {
    expect(CAPABILITY_NAMES.PDF_MERGE).toBe('pdf.merge');
    expect(CAPABILITY_NAMES.PDF_SPLIT).toBe('pdf.split');
    expect(CAPABILITY_NAMES.PDF_ADD_PAGE_NUMBERS).toBe('pdf.add-page-numbers');
  });

  it('应包含视频核心能力', () => {
    expect(CAPABILITY_NAMES.VIDEO_COMPRESS).toBe('video.compress');
    expect(CAPABILITY_NAMES.VIDEO_TRIM).toBe('video.trim');
    expect(CAPABILITY_NAMES.VIDEO_RESIZE).toBe('video.resize');
    expect(CAPABILITY_NAMES.VIDEO_CROP).toBe('video.crop');
    expect(CAPABILITY_NAMES.VIDEO_NORMALIZE_AUDIO).toBe('video.normalize-audio');
  });

  it('应包含 AI 能力', () => {
    expect(CAPABILITY_NAMES.AI_GENERATE_WORKFLOW).toBe('ai.generate-workflow');
    expect(CAPABILITY_NAMES.AI_CAPTION).toBe('ai.caption');
  });
});
