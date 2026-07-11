/**
 * StatusDot - 节点状态指示圆点
 *
 * 根据 status 显示不同颜色,running 时带 pulse 动画。
 * PipelineBar 与 WorkflowEditor 共享此组件。
 */
export interface StatusDotProps {
  /** 节点状态(pending/running/success/failed/idle) */
  status: string;
}

export function StatusDot({ status }: StatusDotProps) {
  const color =
    status === 'running'
      ? 'bg-[var(--lokvis-warning)]'
      : status === 'success'
      ? 'bg-[var(--lokvis-success)]'
      : status === 'failed'
      ? 'bg-[var(--lokvis-danger)]'
      : status === 'pending'
      ? 'bg-[var(--lokvis-fg-subtle)]'
      : 'bg-[var(--lokvis-fg-subtle)]';

  const animate = status === 'running' ? 'animate-pulse' : '';

  return <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${color} ${animate}`} />;
}
