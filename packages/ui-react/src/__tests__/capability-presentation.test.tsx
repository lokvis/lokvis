// @vitest-environment jsdom
/**
 * Capability presentation 元数据单测(gap 分析 #17)。
 *
 * 覆盖:
 *   - utils: capabilityLabel / capabilityGroup 回退链 + filterCapabilities label 匹配
 *   - Inspector: label / icon / group 渲染,缺省回退 name / domain
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { Capability } from '@lokvis/schema';
import { Inspector } from '../components/Inspector.js';
import { useWorkspaceStore } from '../store/index.js';
import { filterCapabilities, capabilityLabel, capabilityGroup } from '../utils.js';

function makeCap(name: string, overrides: Partial<Capability> = {}): Capability {
  return {
    name,
    description: `${name} description`,
    inputTypes: ['image'],
    outputTypes: ['image'],
    params: [],
    performance: 'fast',
    ...overrides,
  };
}

// ─── utils 纯函数 ───────────────────────────────────────────

describe('capabilityLabel / capabilityGroup', () => {
  it('label 存在时优先,缺省回退 name', () => {
    expect(capabilityLabel(makeCap('image.cutout', { label: '智能抠图' }))).toBe('智能抠图');
    expect(capabilityLabel(makeCap('image.resize'))).toBe('image.resize');
  });

  it('group 存在时优先,缺省回退 name 的 domain 前缀', () => {
    expect(capabilityGroup(makeCap('image.cutout', { group: '创作' }))).toBe('创作');
    expect(capabilityGroup(makeCap('image.resize'))).toBe('image');
    expect(capabilityGroup(makeCap('misc'))).toBe('misc');
  });

  it('filterCapabilities 匹配 label', () => {
    const caps = [
      makeCap('image.cutout', { label: '智能抠图' }),
      makeCap('image.resize'),
    ];
    expect(filterCapabilities(caps, '抠图').map((c) => c.name)).toEqual(['image.cutout']);
    // name / description 匹配不受影响
    expect(filterCapabilities(caps, 'resize').map((c) => c.name)).toEqual(['image.resize']);
  });
});

// ─── Inspector 渲染 ─────────────────────────────────────────

describe('Inspector presentation 元数据渲染', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      runtime: null,
      capabilities: [],
      capabilityMap: {},
      stubCapabilities: new Set(),
      nodes: [],
      selectedNodeId: null,
      selectedAssetId: null,
      assets: [],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('渲染 label / icon / 自定义 group,缺省能力回退 name / domain', () => {
    useWorkspaceStore.setState({
      capabilities: [
        makeCap('image.cutout', { label: '智能抠图', icon: '✂️', group: '创作' }),
        makeCap('image.resize'),
      ],
    });

    render(React.createElement(Inspector));

    // presentation 能力:label + icon + 自定义分组
    expect(screen.getByText('智能抠图')).toBeTruthy();
    expect(screen.getByText('✂️')).toBeTruthy();
    expect(screen.getByText('创作')).toBeTruthy();
    // 缺省能力:回退 name + domain 分组
    expect(screen.getByText('image.resize')).toBeTruthy();
    expect(screen.getByText('image')).toBeTruthy();
  });

  it('搜索支持 label 关键词', () => {
    useWorkspaceStore.setState({
      capabilities: [
        makeCap('image.cutout', { label: '智能抠图' }),
        makeCap('image.resize'),
      ],
    });

    render(React.createElement(Inspector));
    const input = screen.getByPlaceholderText('Search capabilities...');
    fireEvent.change(input, { target: { value: '抠图' } });

    expect(screen.getByText('智能抠图')).toBeTruthy();
    expect(screen.queryByText('image.resize')).toBeNull();
  });
});
