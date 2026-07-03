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
  it('受控模式渲染 value 并响应 onChange(透传原生事件)', () => {
    const onChange = vi.fn();
    const { container } = render(<Slider value={50} onChange={onChange} min={0} max={100} />);
    const input = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('50');
    fireEvent.change(input, { target: { value: '75' } });
    // onChange 被调用(原生 ChangeEvent 透传)
    expect(onChange).toHaveBeenCalled();
  });

  it('onValueChange 便捷回调传数值', () => {
    const onValueChange = vi.fn();
    const { container } = render(<Slider value={50} onValueChange={onValueChange} min={0} max={100} />);
    const input = container.querySelector('input[type="range"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '42' } });
    expect(onValueChange).toHaveBeenCalledWith(42);
  });

  it('onChange 与 onValueChange 可同时触发', () => {
    const onChange = vi.fn();
    const onValueChange = vi.fn();
    const { container } = render(
      <Slider value={50} onChange={onChange} onValueChange={onValueChange} min={0} max={100} />
    );
    const input = container.querySelector('input[type="range"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '60' } });
    expect(onChange).toHaveBeenCalled();
    expect(onValueChange).toHaveBeenCalledWith(60);
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

  it('键盘 Home 跳到首个可用项(W4 review #8)', () => {
    render(
      <Tabs
        items={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
          { value: 'c', label: 'C' },
        ]}
        defaultValue="c"
      >
        {() => null}
      </Tabs>
    );
    const tablist = screen.getByRole('tablist');
    fireEvent.keyDown(tablist, { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'A' })).toHaveAttribute('aria-selected', 'true');
  });

  it('键盘 End 跳到末个可用项(W4 review #8)', () => {
    render(
      <Tabs
        items={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
          { value: 'c', label: 'C' },
        ]}
        defaultValue="a"
      >
        {() => null}
      </Tabs>
    );
    const tablist = screen.getByRole('tablist');
    fireEvent.keyDown(tablist, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'C' })).toHaveAttribute('aria-selected', 'true');
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

  it('open 时锁 body.overflow,cleanup 后还原(W4 review #7)', () => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = '';
    const { unmount } = render(<Dialog open onClose={vi.fn()}>body</Dialog>);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
    document.body.style.overflow = prevOverflow;
  });

  it('多实例嵌套:A 关闭时不还原 B 的 overflow 锁(W4 review #7)', () => {
    document.body.style.overflow = '';
    const { unmount: unmountA } = render(<Dialog open onClose={vi.fn()}>A</Dialog>);
    const { unmount: unmountB } = render(<Dialog open onClose={vi.fn()}>B</Dialog>);
    expect(document.body.style.overflow).toBe('hidden');
    // 关闭 A:B 仍开着,overflow 锁不应被解除
    unmountA();
    expect(document.body.style.overflow).toBe('hidden');
    // 关闭 B:全部关闭,overflow 还原
    unmountB();
    expect(document.body.style.overflow).toBe('');
  });

  it('Tab 在末个可聚焦元素上时 wrap 回首个(focus trap, W4 review #7)', () => {
    render(
      <Dialog open onClose={vi.fn()} title="T">
        <button>正文按钮一</button>
        <button>正文按钮二</button>
      </Dialog>
    );
    const dialog = screen.getByRole('dialog');
    // querySelectorAll 顺序:关闭按钮(X) → 正文按钮一 → 正文按钮二
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled])'
    );
    const first = focusable[0]!; // 关闭按钮
    const last = focusable[focusable.length - 1]!; // 正文按钮二(末个)
    // 模拟焦点在末个,按 Tab 应 wrap 回首个
    last.focus();
    expect(document.activeElement).toBe(last);
    act(() => {
      fireEvent.keyDown(document, { key: 'Tab' });
    });
    expect(document.activeElement).toBe(first);
  });

  it('Shift+Tab 在首个可聚焦元素上时 wrap 到末个(focus trap, W4 review #7)', () => {
    render(
      <Dialog open onClose={vi.fn()} title="T">
        <button>正文按钮一</button>
        <button>正文按钮二</button>
      </Dialog>
    );
    const dialog = screen.getByRole('dialog');
    const focusable = dialog.querySelectorAll<HTMLElement>('button:not([disabled])');
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    first.focus();
    expect(document.activeElement).toBe(first);
    act(() => {
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    });
    expect(document.activeElement).toBe(last);
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

  it('合并触发器原有的 onMouseEnter 而非覆盖(W4 review #4)', () => {
    const userHandler = vi.fn();
    render(
      <Tooltip content="提示" delay={0}>
        <button onMouseEnter={userHandler}>触发器</button>
      </Tooltip>
    );
    const trigger = screen.getByText('触发器');
    fireEvent.mouseEnter(trigger);
    // 用户原有 handler 应被调用,而非被 tooltip 覆盖
    expect(userHandler).toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(10);
    });
    // tooltip 自身的 show 逻辑也应执行
    expect(screen.getByRole('tooltip')).toHaveTextContent('提示');
  });

  it('合并触发器原有的 onFocus 而非覆盖(W4 review #4)', () => {
    const userHandler = vi.fn();
    render(
      <Tooltip content="聚焦提示" trigger="focus" delay={0}>
        <input aria-label="输入框" onFocus={userHandler} />
      </Tooltip>
    );
    const input = screen.getByLabelText('输入框');
    fireEvent.focus(input);
    expect(userHandler).toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('聚焦提示');
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
