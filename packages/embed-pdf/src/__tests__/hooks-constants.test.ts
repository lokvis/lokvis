/**
 * hooks 常量与导出单元测试
 *
 * 验证 usePdfPageNumbers / usePdfSplit 的常量表与导出符号
 * (hook 运行时行为依赖完整 runtime,不在单测覆盖范围)。
 */
import { describe, it, expect } from 'vitest';
import {
  usePdfPageNumbers,
  PDF_PAGE_NUMBER_POSITIONS,
  DEFAULT_PAGE_NUMBER_FORMAT,
} from '../hooks/usePdfPageNumbers';
import { usePdfSplit, PDF_SPLIT_PRESETS } from '../hooks/usePdfSplit';

describe('usePdfPageNumbers 常量', () => {
  it('PDF_PAGE_NUMBER_POSITIONS 应包含 4 个位置', () => {
    expect(PDF_PAGE_NUMBER_POSITIONS).toHaveLength(4);
    expect(PDF_PAGE_NUMBER_POSITIONS).toContain('bottom-center');
    expect(PDF_PAGE_NUMBER_POSITIONS).toContain('bottom-right');
    expect(PDF_PAGE_NUMBER_POSITIONS).toContain('top-center');
    expect(PDF_PAGE_NUMBER_POSITIONS).toContain('top-right');
  });

  it('DEFAULT_PAGE_NUMBER_FORMAT 应包含 {n} 与 {total} 占位符', () => {
    expect(DEFAULT_PAGE_NUMBER_FORMAT).toBe('Page {n} of {total}');
  });

  it('usePdfPageNumbers 应为函数', () => {
    expect(typeof usePdfPageNumbers).toBe('function');
  });
});

describe('usePdfSplit 预设表', () => {
  it('应包含 custom 预设(占位 pagesPerFile=0)', () => {
    expect(PDF_SPLIT_PRESETS.custom).toEqual({ pagesPerFile: 0 });
  });

  it('原有 3 个预设不变', () => {
    expect(PDF_SPLIT_PRESETS['every-page']).toEqual({ pagesPerFile: 1 });
    expect(PDF_SPLIT_PRESETS['2-pages']).toEqual({ pagesPerFile: 2 });
    expect(PDF_SPLIT_PRESETS['5-pages']).toEqual({ pagesPerFile: 5 });
  });

  it('usePdfSplit 应为函数', () => {
    expect(typeof usePdfSplit).toBe('function');
  });
});
