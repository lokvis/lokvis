/**
 * 宿主应用：在已有布局中嵌入 Lokvis Workspace
 *
 * 这里模拟一个常见的「侧边栏 + 主区域」React 应用，
 * 把 @lokvis/ui-react 的 <Workspace /> 放进主区域。
 */
import * as React from 'react';
import { Workspace } from '@lokvis/ui-react';
import { imageToolsPlugin } from '@lokvis/plugin-image';

// 预加载图像工具插件（resize / compress / convert / ...）
const plugins = [imageToolsPlugin()];

const sidebarItems = ['Home', 'Library', 'Workspace', 'Settings'];

export default function App(): React.ReactElement {
  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* 已有应用的侧边栏 */}
      <aside style={{ width: 220, background: '#18181b', color: '#e4e4e7' }}>
        <h2 style={{ fontSize: 16, padding: 16, margin: 0 }}>My App</h2>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {sidebarItems.map((item) => (
            <li
              key={item}
              style={{
                padding: '10px 16px',
                background: item === 'Workspace' ? '#27272a' : 'transparent',
              }}
            >
              {item}
            </li>
          ))}
        </ul>
      </aside>

      {/* 主区域：嵌入 Lokvis Workspace */}
      <main style={{ flex: 1, minWidth: 0 }}>
        <Workspace
          title="Lokvis Workspace"
          plugins={plugins}
          showStatusBar
        />
      </main>
    </div>
  );
}
