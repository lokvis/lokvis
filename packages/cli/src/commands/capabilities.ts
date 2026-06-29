/**
 * `lokvis capabilities` 命令
 *
 * 列出所有内置能力声明。
 */

import { BUILTIN_CAPABILITIES } from '@lokvis/capability';
import type { Capability } from '@lokvis/schema';

export function listCapabilities(): Capability[] {
  return BUILTIN_CAPABILITIES;
}
