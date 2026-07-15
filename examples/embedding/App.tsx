/**
 * 宿主应用：在已有布局中嵌入 Lokvis Workspace,并对接 cloud auth(W17.6)
 *
 * 演示三种典型集成模式:
 *  1. 本地 free 模式(不传 auth) —— 批量 10 / 并发 4 / 槽位 5 / 预设 3
 *  2. cloud Pro 模式(auth.session = JWT) —— 全部上限放宽
 *  3. 游客 session(auth.isPro = false) —— cloud 识别但游客身份,仍受限
 *
 * 在真实集成中,session/token 通常由宿主应用自身的登录流程获取
 * (OAuth / cookie / 自有认证系统),然后透传给 <Workspace auth={...} />。
 * SDK 只做 presence 推导,不做 token 校验(校验由 cloud 网关完成)。
 */
import * as React from 'react';
import { Workspace, type UseLokvisOptions } from '@lokvis/ui-react';
import { imageToolsPlugin } from '@lokvis/plugin-image';
import type { LokvisAuthSession } from '@lokvis/sdk';

// 预加载图像工具插件(resize / compress / convert / ...)
const plugins = [imageToolsPlugin()];

const sidebarItems = ['Home', 'Library', 'Workspace', 'Settings'];

/**
 * 三种 auth 模式示例。
 *
 * 在真实集成中,这里会从宿主应用的 auth context / cookie / OAuth 回调中读取:
 *   const session = useAuthSession(); // 来自宿主应用
 *   const auth: LokvisAuthSession = session ? { session } : undefined;
 */
type AuthMode = 'free' | 'pro' | 'guest';

const AUTH_MODES: Record<AuthMode, { label: string; auth: LokvisAuthSession | undefined; description: string }> = {
  free: {
    label: 'Free (local only)',
    auth: undefined,
    description: '无 auth:批量 10 / 并发 4 / 槽位 5 / 预设 3',
  },
  pro: {
    label: 'Pro (cloud session)',
    auth: { session: 'demo-cloud-jwt-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature' },
    description: 'cloud session JWT → isPro: true,全部上限放宽',
  },
  guest: {
    label: 'Guest (cloud, but free)',
    auth: { session: 'guest-jwt', isPro: false },
    description: 'cloud 识别游客身份,显式 isPro: false 仍受限',
  },
};

export default function App(): React.ReactElement {
  // 在真实集成中,auth 通常由宿主应用 auth context 决定,不在 UI 切换。
  // 这里提供切换按钮仅用于演示三种模式的行为差异。
  const [authMode, setAuthMode] = React.useState<AuthMode>('free');
  const { auth, description } = AUTH_MODES[authMode];

  // 把 auth 透传给 Workspace —— WorkspaceProps extends UseLokvisOptions,
  // 所以 auth prop 会经 useLokvis() 透传到 createLokvis({ auth })。
  // 切换 authMode 时需要 remount Workspace(通过 key),因为 useLokvis 只在挂载时初始化一次。
  const lokvisOptions: UseLokvisOptions = {
    plugins,
    auth,
  };

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

        {/* Auth 模式切换(仅演示用) */}
        <div style={{ padding: '16px', borderTop: '1px solid #27272a', marginTop: 16 }}>
          <div style={{ fontSize: 11, color: '#71717a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Auth Mode
          </div>
          {(Object.keys(AUTH_MODES) as AuthMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setAuthMode(mode)}
              style={{
                display: 'block',
                width: '100%',
                padding: '6px 8px',
                marginBottom: 4,
                background: authMode === mode ? '#3f3f46' : 'transparent',
                border: '1px solid #3f3f46',
                borderRadius: 4,
                color: authMode === mode ? '#fafafa' : '#a1a1aa',
                fontSize: 12,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {AUTH_MODES[mode].label}
            </button>
          ))}
          <div style={{ fontSize: 10, color: '#52525b', marginTop: 8, lineHeight: 1.4 }}>
            {description}
          </div>
        </div>
      </aside>

      {/* 主区域:嵌入 Lokvis Workspace */}
      <main style={{ flex: 1, minWidth: 0 }}>
        {/*
          key={authMode} 强制 remount:useLokvis() 只在挂载时初始化一次,
          切换 auth 需要销毁旧 Runtime 实例并创建新的。
          在真实集成中,auth 通常稳定不变,不需要这个 key。
        */}
        <Workspace
          key={authMode}
          title="Lokvis Workspace"
          {...lokvisOptions}
          showStatusBar
        />
      </main>
    </div>
  );
}
