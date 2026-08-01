/**
 * @lokvis/plugin-archive
 *
 * 官方归档处理插件。通过 engine-archive(fflate)实现 3 个归档能力:
 * zip / unzip / list
 *
 * 设计原则:
 * - Plugin 只看到 PluginContext(Runtime 受限 API)与 engine-archive
 * - engine-archive 为同构真实现(浏览器/Node 一致),故本插件非 stub
 */

export { archiveToolsPlugin as default, archiveToolsPlugin } from './plugin.js';
export { buildArchiveCapabilityImplementations } from './operations.js';
