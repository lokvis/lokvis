---
"@lokvis/ui-react": minor
---

W9 Workspace SPA 主界面(9.1-9.8)——命令面板 + 全屏拖拽 + 对比滑块 + 下载面板 + 暗色切换 + 响应式

- **ui-react·Workspace**:完整重构为五段编排(Toolbar → [Asset | Canvas | Inspector] → PipelineBar → HistoryPanel(h) → DownloadPanel → StatusBar);新增 5 个 `enable*` props(`enableGlobalDropzone` / `enableCommandPalette` / `enableThemeToggle` / `enableCompare` / `enableDownloadPanel`,默认 true,消费方可按需关闭);移动端 `isMobile` 切换为抽屉模式(Asset / Inspector 抽屉 + Canvas 全屏)
- **ui-react·CommandPalette**(9.2):基于 ui-core `Dialog`(portal + ESC + focus trap + body overflow lock)+ `useCommandPalette()` hook 注册 ⌘K/Ctrl+K 全局快捷键;列出 capabilities + 工作流操作(undo/redo/clear);键盘 ↑↓ 导航,Enter 选中,ESC 关闭
- **ui-react·GlobalDropzone**(9.3):全屏 dropzone + `isFileAccepted()` 三种 MIME 校验模式(`image/*` prefix / `image/jpeg` 精确 mime / `.png` 扩展名匹配);dragCounter 计数避免子元素 dragenter/dragleave 抖动;拒绝文件显示红色提示 5 秒后自动清空;默认接受 `image/*,video/*,audio/*,application/pdf`
- **ui-react·CompareSlider**(9.4):before/after 对比滑块,鼠标拖 + 触摸 + 键盘(← → 5% 步长)三模式;before 用 `selectedAssetId`,after 用 `selectedOutputId ?? lastOutputIds[0]`;Canvas 集成 `compareMode` 状态(outputs 变化时自动切换)+ 右上角 Single/Compare 切换按钮(`canCompare` 条件)
- **ui-react·DownloadPanel**(9.5):从 `lastOutputIds` 取工作流输出,逐项 `runtime.exportAsset(id)` → `downloadBlob`;批量下载间隔 200ms 避免浏览器拦截;空状态显示 EmptyState
- **ui-react·HistoryPanel**(9.1):新增 `variant?: 'vertical' | 'horizontal'` prop;horizontal 模式高度 h-12 + 横向滚动条目;vertical 保留原侧栏布局
- **ui-react·StatusBar**(9.6):新增 `useOnlineStatus()` hook(监听 online/offline 事件);新增显示当前选中工具名(`selectedNode.capability`)+ 执行进度(`doneNodes/totalNodes (progressPct%)`)+ 在线状态指示灯(绿 / 红)
- **ui-react·ThemeToggle**(9.7):左键 toggle(light ↔ dark),右键弹出菜单(light / dark / system 三态);配合 `useTheme` hook
- **ui-react·hooks**:
  - `useTheme`:`ThemeMode = 'light' | 'dark' | 'system'`;localStorage 持久化 + 跨 tab storage 事件同步 + matchMedia 系统偏好监听;`applyTheme()` 操作 `document.documentElement.classList` 添加/移除 `dark`/`light` 类(与 ui-core `tokens.css` 双触发一致)
  - `useMediaQuery(query)`:订阅 matchMedia,SSR 安全(初始 false)
  - `useBreakpoints()`:返回 `{ isMobile, isTablet, isDesktop }`,断点 768/1024
  - `useCommandPalette()`:注册 ⌘K/Ctrl+K 全局快捷键 + open/close 状态
- **ui-react·store**:`WorkflowState` 新增 `lastOutputIds: string[]` / `selectedOutputId: string | null`;`WorkflowActions` 新增 `selectOutput(id)` / `clearOutputs()`;`run()` 在 status === 'completed' 时自动写入 `lastOutputIds`(输出资产 id 列表)和 `selectedOutputId`(取首个)
- **ui-react·index**:导出全部新组件和 hooks(CommandPalette / GlobalDropzone / CompareSlider / DownloadPanel / ThemeToggle / useTheme / useMediaQuery / useBreakpoints / useCommandPalette)
- **验证**:typecheck 36/36、test 677/677(新增 7)、build 20/20、覆盖率 lines 91.27% / branches 88.27%
