// @vitest-environment jsdom
/**
 * ParamForm widget 注册表 + 内置 widget 单元测试
 *
 * 覆盖:
 * - resolveParamWidget:无 widget → undefined;内置 slider/textarea/json;
 *   自定义注册表优先于内置;反注册不误删后注册者
 * - ParamForm 集成:widget:'slider' 渲染 range 并传播 number;
 *   widget:'json' 合法 JSON 传播解析值、非法 JSON 不传播;
 *   自定义 widget 渲染;无 widget 回落 type 默认控件
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { Capability, CapabilityParam } from '@lokvis/schema';
import { ParamForm } from '../components/ParamForm.js';
import {
  registerParamWidget,
  clearParamWidgets,
  resolveParamWidget,
  SliderWidget,
  TextareaWidget,
  JsonWidget,
  type ParamWidgetProps,
} from '../components/param-widgets.js';

function makeCapability(params: CapabilityParam[]): Capability {
  return {
    name: 'test.cap',
    description: 'test capability',
    inputTypes: ['image'],
    outputTypes: ['image'],
    params,
    performance: 'fast',
  };
}

function renderForm(params: CapabilityParam[], values: Record<string, unknown>, onChange = vi.fn()) {
  render(
    React.createElement(ParamForm, {
      capability: makeCapability(params),
      values,
      onChange,
    })
  );
  return onChange;
}

beforeEach(() => clearParamWidgets());
afterEach(() => {
  cleanup();
  clearParamWidgets();
  vi.restoreAllMocks();
});

describe('resolveParamWidget', () => {
  it('无 widget 字段返回 undefined', () => {
    expect(resolveParamWidget({ name: 'p', type: 'number' })).toBeUndefined();
  });

  it('内置 widget:slider / textarea / json', () => {
    expect(resolveParamWidget({ name: 'p', type: 'number', widget: 'slider' })).toBe(SliderWidget);
    expect(resolveParamWidget({ name: 'p', type: 'string', widget: 'textarea' })).toBe(TextareaWidget);
    expect(resolveParamWidget({ name: 'p', type: 'object', widget: 'json' })).toBe(JsonWidget);
  });

  it('未注册的 widget 标识返回 undefined(回落 type 默认控件)', () => {
    expect(resolveParamWidget({ name: 'p', type: 'string', widget: 'unknown' })).toBeUndefined();
  });

  it('自定义注册表优先于内置(可覆盖 slider)', () => {
    const custom = (_props: ParamWidgetProps) => React.createElement('div');
    registerParamWidget('slider', custom);
    expect(resolveParamWidget({ name: 'p', type: 'number', widget: 'slider' })).toBe(custom);
  });

  it('反注册函数仅移除自己注册的组件', () => {
    const first = (_props: ParamWidgetProps) => React.createElement('div');
    const second = (_props: ParamWidgetProps) => React.createElement('div');
    const un = registerParamWidget('my.widget', first);
    registerParamWidget('my.widget', second);
    un();
    expect(resolveParamWidget({ name: 'p', type: 'string', widget: 'my.widget' })).toBe(second);
  });
});

describe('ParamForm widget 集成', () => {
  it("widget:'slider' 渲染 range 控件,拖动传播 number", () => {
    const onChange = renderForm(
      [{ name: 'quality', type: 'number', min: 0, max: 100, widget: 'slider' }],
      { quality: 80 }
    );
    const range = screen.getByLabelText('quality') as HTMLInputElement;
    expect(range.type).toBe('range');
    expect(range.value).toBe('80');
    fireEvent.change(range, { target: { value: '65' } });
    expect(onChange).toHaveBeenCalledWith({ quality: 65 });
  });

  it("widget:'textarea' 渲染多行文本并传播字符串", () => {
    const onChange = renderForm(
      [{ name: 'text', type: 'string', widget: 'textarea' }],
      { text: 'hello' }
    );
    const area = screen.getByLabelText('text') as HTMLTextAreaElement;
    expect(area.tagName).toBe('TEXTAREA');
    fireEvent.change(area, { target: { value: 'world' } });
    expect(onChange).toHaveBeenCalledWith({ text: 'world' });
  });

  it("widget:'json' 合法 JSON 传播解析后的对象", () => {
    const onChange = renderForm(
      [{ name: 'config', type: 'object', widget: 'json' }],
      { config: { a: 1 } }
    );
    const area = screen.getByLabelText('config') as HTMLTextAreaElement;
    expect(area.value).toContain('"a": 1');
    fireEvent.change(area, { target: { value: '{"b": 2}' } });
    expect(onChange).toHaveBeenLastCalledWith({ config: { b: 2 } });
  });

  it("widget:'json' 非法 JSON 不传播坏值,仅保留文本", () => {
    const onChange = renderForm(
      [{ name: 'config', type: 'object', widget: 'json' }],
      {}
    );
    const area = screen.getByLabelText('config') as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: '{broken' } });
    expect(onChange).not.toHaveBeenCalled();
    expect(area.value).toBe('{broken');
    expect(area.getAttribute('aria-invalid')).toBe('true');
  });

  it('自定义 widget 经注册表渲染并收到 param/value/onChange', () => {
    const custom = vi.fn(({ value, onChange: oc }: ParamWidgetProps) =>
      React.createElement(
        'button',
        { type: 'button', onClick: () => oc('clicked') },
        String(value ?? '')
      )
    );
    registerParamWidget('my.button', custom);
    const onChange = renderForm(
      [{ name: 'action', type: 'string', widget: 'my.button' }],
      { action: 'go' }
    );
    fireEvent.click(screen.getByText('go'));
    expect(onChange).toHaveBeenCalledWith({ action: 'clicked' });
    expect(custom.mock.calls[0]![0]).toMatchObject({
      param: expect.objectContaining({ name: 'action' }),
      value: 'go',
    });
  });

  it('无 widget 时回落 type 默认控件(number → number input)', () => {
    const onChange = renderForm([{ name: 'width', type: 'number', min: 1, max: 4096 }], { width: 100 });
    const input = screen.getByDisplayValue('100') as HTMLInputElement;
    expect(input.type).toBe('number');
    fireEvent.change(input, { target: { value: '200' } });
    expect(onChange).toHaveBeenCalledWith({ width: 200 });
  });
});
