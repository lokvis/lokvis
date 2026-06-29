/**
 * @lokvis/plugin-dev
 *
 * 开发者工具插件。提供面向 Plugin 开发者的能力：
 * - 能力自省（developer.inspect.capabilities）
 * - 资产检视（developer.inspect.asset）
 * - Workflow 校验（developer.validate.workflow）
 * - 性能剖析（developer.profile）
 *
 * 该插件不依赖任何外部 Engine，所有能力在 Plugin 内直接实现。
 */

export { devToolsPlugin as default, devToolsPlugin } from './plugin.js';
