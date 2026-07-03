/**
 * Demo: UI Components Showcase(W4.7)
 *
 * 展示 @lokvis/ui-core 的全部组件,供开发时预览设计与暗色模式。
 * 含 Button / Card / Badge / Slider / Toggle / Select / Tabs / Dialog / Tooltip。
 */
import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Badge,
  Icon,
  Spinner,
  EmptyState,
  Slider,
  Toggle,
  Select,
  Tabs,
  Dialog,
  Tooltip,
} from '@lokvis/ui-core';

export default function ComponentsDemo() {
  const [sliderVal, setSliderVal] = useState(50);
  const [toggleOn, setToggleOn] = useState(true);
  const [selectVal, setSelectVal] = useState('png');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dark, setDark] = useState(false);

  // 暗色模式:在 documentElement 上切换 .dark 类(Tailwind v4 dark 策略)。
  // DOM 副作用放在 useEffect 里,避免 React Strict Mode 下 state updater 被调用两次
  // 导致 classList.toggle 两次后状态不变。updater 必须是纯函数,不产生副作用。
  // 不在容器 div 上重复加 .dark —— documentElement 已是全局根,组件内 dark: 工具类即可生效。
  const toggleDark = () => setDark((prev) => !prev);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-3xl space-y-8 bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        {/* 顶部:暗色模式切换 */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">UI Components</h1>
          <Toggle checked={dark} onChange={toggleDark} label="Dark mode" />
        </div>

        {/* Button */}
        <Section title="Button">
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
          </div>
        </Section>

        {/* Badge */}
        <Section title="Badge">
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="danger">Danger</Badge>
            <Badge variant="info">Info</Badge>
          </div>
        </Section>

        {/* Card */}
        <Section title="Card">
          <Card hoverable>
            <h3 className="mb-1 font-semibold">Card Title</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              A hoverable card with some content inside.
            </p>
          </Card>
        </Section>

        {/* Slider */}
        <Section title="Slider">
          <div className="max-w-sm space-y-3">
            <Slider value={sliderVal} onValueChange={setSliderVal} showValue />
            <Slider value={sliderVal} onValueChange={setSliderVal} showValue format={(v) => `${v}%`} />
          </div>
        </Section>

        {/* Toggle */}
        <Section title="Toggle">
          <div className="space-y-3">
            <Toggle checked={toggleOn} onChange={setToggleOn} label="Feature flag" />
            <Toggle defaultChecked label="Default on" />
            <Toggle size="sm" label="Small size" />
            <Toggle disabled label="Disabled" />
          </div>
        </Section>

        {/* Select */}
        <Section title="Select">
          <Select
            value={selectVal}
            onChange={setSelectVal}
            options={[
              { value: 'png', label: 'PNG' },
              { value: 'jpeg', label: 'JPEG' },
              { value: 'webp', label: 'WebP' },
              { value: 'avif', label: 'AVIF' },
            ]}
          />
        </Section>

        {/* Tabs */}
        <Section title="Tabs">
          <Tabs
            items={[
              { value: 'overview', label: 'Overview' },
              { value: 'params', label: 'Parameters' },
              { value: 'history', label: 'History' },
            ]}
          >
            {(active) => (
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                {active === 'overview' && 'Overview tab content.'}
                {active === 'params' && 'Parameters tab content.'}
                {active === 'history' && 'History tab content.'}
              </div>
            )}
          </Tabs>
        </Section>

        {/* Dialog */}
        <Section title="Dialog">
          <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
          <Dialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            title="Confirm action"
            footer={
              <>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button variant="primary" onClick={() => setDialogOpen(false)}>Confirm</Button>
              </>
            }
          >
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Are you sure you want to proceed? This action cannot be undone.
            </p>
          </Dialog>
        </Section>

        {/* Tooltip */}
        <Section title="Tooltip">
          <div className="flex gap-6">
            <Tooltip content="Top tooltip" side="top">
              <Button variant="secondary">Hover me (top)</Button>
            </Tooltip>
            <Tooltip content="Right tooltip" side="right">
              <Button variant="secondary">Hover me (right)</Button>
            </Tooltip>
            <Tooltip content="Bottom tooltip" side="bottom">
              <Button variant="secondary">Hover me (bottom)</Button>
            </Tooltip>
          </div>
        </Section>

        {/* Icon / Spinner / EmptyState */}
        <Section title="Icon / Spinner / EmptyState">
          <div className="flex items-start gap-8">
            <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <Icon size={20}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </Icon>
              <span className="text-sm">Info icon</span>
            </div>
            <Spinner size={24} />
            <EmptyState
              title="No items"
              description="Upload a file to get started."
              action={<Button size="sm" variant="secondary">Upload</Button>}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}
