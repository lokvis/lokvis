import { Workspace as WorkspaceUI } from '@lokvis/ui-react';
import imageToolsPlugin from '@lokvis/plugin-image';

/**
 * Lokvis Web App - Image Workspace
 *
 * 集成 @lokvis/ui-react 工作台 + @lokvis/plugin-image 图像处理插件。
 * 所有计算在浏览器本地执行，零上传、零服务端依赖。
 */
export function Workspace() {
  return (
    <div className="h-screen w-screen">
      <WorkspaceUI
        title="Lokvis Image Workspace"
        plugins={[imageToolsPlugin()]}
        enableLog
      />
    </div>
  );
}
