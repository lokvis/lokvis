/**
 * Workspace - Web app wrapper
 *
 * 接收 Astro 页面传入的 props，传递给 ui-react 的 Workspace。
 */

import { Workspace as WorkspaceUI } from '@lokvis/ui-react';
import imageToolsPlugin from '@lokvis/plugin-image';

interface WorkspacePageProps {
  title?: string;
}

export function Workspace({ title }: WorkspacePageProps) {
  return (
    <WorkspaceUI
      title={title}
      plugins={[imageToolsPlugin()]}
    />
  );
}
