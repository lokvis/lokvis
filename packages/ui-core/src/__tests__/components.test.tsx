// @vitest-environment jsdom
/**
 * ui-core 组件单测(W4.6)
 *
 * 覆盖 W4.4 新增的 6 个组件:Slider / Toggle / Select / Tabs / Dialog / Tooltip。
 * 使用 @testing-library/react 做行为级断言(渲染 / 点击 / 受控值)。
 *
 * 注意:vitest 配置 `globals: false`,@testing-library/react 的自动 cleanup
 * 依赖全局 afterEach 注册,故需手动 import afterEach + cleanup。
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  Slider,
  Toggle,
  Select,
  Tabs,
  Dialog,
  Tooltip,
  Button,
} from '../index.js';

// globals: false 下手动清理,避免上一个测试的 DOM 残留(Dialog portal 挂到 body)
afterEach(() => {
  cleanup();
});

describe('Slider', () => {
  it('受控模式渲染 value 并响应 onChange', () => {
    const onChange = vi.fn();
    const { container } = render(<Slider value={50} onChange={onChange} min={0} max={100} />);
    const input = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('50');
    fireEvent.change(input, { target: { value: '75' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('showValue 显示当前值与范围标签', () => {
    render(<Slider value={30} showValue min={0} max={100} />);
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('format 自定义值格式化', () => {
    render(<Slider value={50} showValue format={(v) => `${v}%`} min={0} max={100} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });
});

describe('Toggle', () => {
  it('受控模式点击触发 onChange(true)', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} aria-label="开关" />);
    const btn = screen.getByRole('switch');
    expect(btn).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(btn);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('非受控模式点击切换内部状态', () => {
    render(<Toggle defaultChecked={false} aria-label="t" />);
    const btn = screen.getByRole('switch');
    expect(btn).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-checked', 'false');
  });

  it('disabled 时不响应点击', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} disabled onChange={onChange} aria-label="d" />);
    const btn = screen.getByRole('switch');
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('label 渲染并可点击切换', () => {
    const onChange = vi.fn();
    render(<Toggle defaultChecked={false} onChange={onChange} label="启用" />);
    fireEvent.click(screen.getByText('启用'));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Select', () => {
  it('options 渲染所有选项', () => {
    render(
      <Select
        options={[
          { value: 'a', label: '选项 A' },
          { value: 'b', label: '选项 B' },
        ]}
        value="a"
      />
    );
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('a');
    expect(screen.getByText('选项 A')).toBeInTheDocument();
    expect(screen.getByText('选项 B')).toBeInTheDocument();
  });

  it('onChange 回传选中值', () => {
    const onChange = vi.fn();
    render(
      <Select
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        onChange={onChange}
      />
    );
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'b' } });
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('placeholder 渲染为 disabled option', () => {
    render(
      <Select
        options={[{ value: 'a', label: 'A' }]}
        placeholder="请选择"
        defaultValue=""
      />
    );
    const placeholderOption = screen.getByText('请选择') as HTMLOptionElement;
    expect(placeholderOption.disabled).toBe(true);
  });
});

describe('Tabs', () => {
  it('默认激活首个可用项', () => {
    render(
      <Tabs
        items={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
      >
        {(active) => <div data-testid="panel">{active}</div>}
      </Tabs>
    );
    expect(screen.getByRole('tab', { name: 'A' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('panel')).toHaveTextContent('a');
  });

  it('点击切换激活项并触发 onChange', () => {
    const onChange = vi.fn();
    render(
      <Tabs
        items={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        onChange={onChange}
      >
        {() => null}
      </Tabs>
    );
    fireEvent.click(screen.getByRole('tab', { name: 'B' }));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.getByRole('tab', { name: 'B' })).toHaveAttribute('aria-selected', 'true');
  });

  it('disabled 项不可选中', () => {
    const onChange = vi.fn();
    render(
      <Tabs
        items={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B', disabled: true },
        ]}
        onChange={onChange}
      >
        {() => null}
      </Tabs>
    );
    const disabledTab = screen.getByRole('tab', { name: 'B' });
    expect(disabledTab).toBeDisabled();
    fireEvent.click(disabledTab);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('键盘 ArrowRight 切换到下一可用项', () => {
    render(
      <Tabs
        items={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
      >
        {() => null}
      </Tabs>
    );
    const tablist = screen.getByRole('tablist');
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'B' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('Dialog', () => {
  it('open=false 时不渲染', () => {
    const { container } = render(<Dialog open={false} onClose={vi.fn()} />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('open=true 渲染到 document.body 并显示标题与内容', () => {
    render(
      <Dialog open onClose={vi.fn()} title="确认操作">
        <p>确定要删除吗?</p>
      </Dialog>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('确认操作')).toBeInTheDocument();
    expect(screen.getByText('确定要删除吗?')).toBeInTheDocument();
  });

  it('点关闭按钮触发 onClose', () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="T">
        body
      </Dialog>
    );
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('ESC 键触发 onClose', () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="T">
        body
      </Dialog>
    );
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('closeOnOverlay=false 时点遮罩不关闭', () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} closeOnOverlay={false}>
        body
      </Dialog>
    );
    // portal 挂到 document.body,遮罩是 dialog 的父元素
    const dialog = screen.getByRole('dialog');
    const overlay = dialog.parentElement as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closeOnOverlay=true(默认)时点遮罩关闭', () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose}>
        body
      </Dialog>
    );
    const dialog = screen.getByRole('dialog');
    const overlay = dialog.parentElement as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('默认不显示,hover 后显示内容', () => {
    render(
      <Tooltip content="提示文字" delay={0}>
        <button>触发器</button>
      </Tooltip>
    );
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.mouseEnter(screen.getByText('触发器'));
    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('提示文字');
  });

  it('鼠标离开后隐藏', () => {
    render(
      <Tooltip content="提示" delay={0}>
        <button>HO</button>
      </Tooltip>
    );
    const trigger = screen.getByText('HO');
    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('trigger=focus 时聚焦显示', () => {
    render(
      <Tooltip content="聚焦提示" trigger="focus" delay={0}>
        <input aria-label="输入框" />
      </Tooltip>
    );
    const input = screen.getByLabelText('输入框');
    fireEvent.focus(input);
    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('聚焦提示');
    fireEvent.blur(input);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('Button(回归)', () => {
  it('loading 状态禁用并显示 spinner', () => {
    render(<Button loading>提交</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn.querySelector('svg')).toHaveClass('animate-spin');
  });

  it('variant=danger 渲染对应类名', () => {
    render(<Button variant="danger">删除</Button>);
    expect(screen.getByRole('button').className).toContain('bg-red-600');
  });
});
