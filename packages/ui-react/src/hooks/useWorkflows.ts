/**
 * useWorkflows - 工作流槽位持久化 hook(W10.6 + W10.7)
 *
 * 提供 5 个工作流槽位的本地保存能力(免费 5 / Pro 无限),以及 JSON 导入/导出。
 * 数据存储在 localStorage 的 `lokvis.workflows` key,JSON 数组形式。
 *
 * 与 useCustomPresets 的区别:
 *   - 自定义预设是尺寸配置(width/height/fit)
 *   - 工作流槽位是完整 Workflow 定义(含 nodes/edges/inputs/outputs)
 *
 * 序列化策略:
 *   - 保存时用 workflowSchema.safeParse() 防御损坏数据(数据完整性)
 *   - 加载时用 workflowSchema.safeParse() 过滤无效条目(向前兼容)
 *   - JSON 导出:Workflow JSON + $schema 字段
 *   - JSON 导入:validateWorkflow() 完整校验(含 capability 兼容性若提供回调)
 *
 * 多 tab / 多实例同步:
 *   - 原生 storage 事件:跨 tab 同步
 *   - 自定义 SYNC_EVENT:同 tab 多实例同步
 *
 * @module useWorkflows
 */

import { useCallback, useEffect, useState } from 'react';
import type { Workflow } from '@lokvis/schema';
import { workflowSchema, validateWorkflow, type ValidateWorkflowOptions } from '@lokvis/schema';

const STORAGE_KEY = 'lokvis.workflows';
/** 同 tab 多实例同步用的自定义事件名 */
const SYNC_EVENT = 'lokvis:workflows-change';

/** 免费用户工作流槽位上限 */
export const FREE_WORKFLOW_LIMIT = 5;
/** Pro 用户无上限 */
export const PRO_WORKFLOW_LIMIT = Infinity;

/** 工作流槽位存储格式 */
export interface WorkflowSlot {
  /** 唯一 ID */
  id: string;
  /** 用户自定义名称(默认取 workflow.name) */
  name: string;
  /** 完整 Workflow 定义 */
  workflow: Workflow;
  /** 创建时间戳 */
  createdAt: number;
  /** 最后更新时间戳 */
  updatedAt: number;
}

/** 保存工作流时的输入 */
export interface SaveWorkflowInput {
  /** 工作流名称(可选,默认取 workflow.name) */
  name?: string;
  /** 完整 Workflow 定义 */
  workflow: Workflow;
  /** 若指定则更新该 id 的槽位,否则新增 */
  id?: string;
}

export interface UseWorkflowsResult {
  /** 当前所有工作流槽位(按 updatedAt 降序) */
  slots: WorkflowSlot[];
  /** 保存或更新工作流;超限时抛 Error */
  save(input: SaveWorkflowInput): WorkflowSlot;
  /** 按 id 删除槽位 */
  remove(id: string): void;
  /** 按 id 加载工作流到 store(返回 Workflow) */
  load(id: string): Workflow | null;
  /** 当前上限(免费 5 / Pro 无限) */
  limit: number;
  /** 是否还能再保存 */
  canSaveMore: boolean;
  /** 还能再保存多少个 */
  remaining: number;
  /** 导出工作流为 JSON 字符串(可直接下载) */
  exportToJson(id: string): string | null;
  /** 导出所有工作流为 JSON 数组字符串 */
  exportAllToJson(): string;
  /** 从 JSON 字符导入工作流(单个或数组);返回导入结果(含跳过原因) */
  importFromJson(
    json: string,
    options?: { resolveCapability?: ValidateWorkflowOptions['resolveCapability']; maxSteps?: number }
  ): { imported: number; skipped: Array<{ reason: string }> };
}

/** 类型守卫:判断 unknown 是否为 Record<string, unknown> */
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

/** 从 localStorage 读取工作流槽位。
 * 容错:JSON 解析失败 / 非数组 / 字段缺失时返回空数组。 */
function readFromStorage(): WorkflowSlot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 字段白名单过滤 + workflowSchema 校验(防御损坏数据)
    return parsed.filter((it): it is WorkflowSlot => {
      if (!isRecord(it)) return false;
      if (
        typeof it.id !== 'string' ||
        typeof it.name !== 'string' ||
        typeof it.createdAt !== 'number' ||
        typeof it.updatedAt !== 'number'
      ) {
        return false;
      }
      // workflow 字段必须通过 schema 校验
      const result = workflowSchema.safeParse(it.workflow);
      return result.success;
    });
  } catch {
    return [];
  }
}

/**
 * 写入 localStorage。
 * @returns true 成功;false 失败(隐私模式 / 配额超限 / 序列化异常)
 * 失败时不静默:调用方需感知以便提示用户"保存失败,数据未持久化"
 */
function writeToStorage(slots: WorkflowSlot[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
    window.dispatchEvent(new CustomEvent(SYNC_EVENT));
    return true;
  } catch (err) {
    // 隐私模式 / Safari 配额 / QuotaExceededError:不静默吞错,
    // 但也不抛错(保存是 fire-and-forget 操作);返回 false 让调用方决策。
    console.warn('[lokvis] Failed to persist workflows to localStorage:', err);
    return false;
  }
}

/** 生成唯一 ID */
function genId(): string {
  return `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param isPro 是否为 Pro 模式。父组件从 runtime.isPro 传入。
 * 影响 limit:免费 5 / Pro 无上限。
 */
export function useWorkflows(isPro = false): UseWorkflowsResult {
  const limit = isPro ? PRO_WORKFLOW_LIMIT : FREE_WORKFLOW_LIMIT;
  const [slots, setSlots] = useState<WorkflowSlot[]>(() => readFromStorage());

  // 监听跨 tab storage + 同 tab SYNC_EVENT
  useEffect(() => {
    const handler = () => setSlots(readFromStorage());
    window.addEventListener('storage', handler);
    window.addEventListener(SYNC_EVENT, handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener(SYNC_EVENT, handler);
    };
  }, []);

  const save = useCallback(
    (input: SaveWorkflowInput): WorkflowSlot => {
      const current = readFromStorage();
      const now = Date.now();
      // 更新已有
      if (input.id) {
        const existing = current.find((s) => s.id === input.id);
        if (existing) {
          const updated: WorkflowSlot = {
            ...existing,
            name: input.name ?? input.workflow.name,
            workflow: input.workflow,
            updatedAt: now,
          };
          const next = current.map((s) => (s.id === input.id ? updated : s));
          const ok = writeToStorage(next);
          if (!ok) {
            // 写入失败仍更新内存 state(用户当前会话可见),但提示未持久化
            console.warn('[lokvis] 工作流未持久化到 localStorage,仅当前会话有效');
          }
          setSlots(next);
          return updated;
        }
      }
      // 新增
      if (current.length >= limit) {
        throw new Error(
          `工作流槽位已达上限(${limit} 个)${isPro ? '' : ',升级 Pro 可无限制保存'}`
        );
      }
      const slot: WorkflowSlot = {
        id: genId(),
        name: input.name ?? input.workflow.name,
        workflow: input.workflow,
        createdAt: now,
        updatedAt: now,
      };
      const next = [...current, slot];
      const ok = writeToStorage(next);
      if (!ok) {
        console.warn('[lokvis] 工作流未持久化到 localStorage,仅当前会话有效');
      }
      setSlots(next);
      return slot;
    },
    [limit, isPro]
  );

  const remove = useCallback((id: string) => {
    const current = readFromStorage();
    const next = current.filter((s) => s.id !== id);
    writeToStorage(next);
    setSlots(next);
  }, []);

  const load = useCallback((id: string): Workflow | null => {
    const current = readFromStorage();
    const slot = current.find((s) => s.id === id);
    return slot ? slot.workflow : null;
  }, []);

  const exportToJson = useCallback((id: string): string | null => {
    const current = readFromStorage();
    const slot = current.find((s) => s.id === id);
    if (!slot) return null;
    return JSON.stringify(slot.workflow, null, 2);
  }, []);

  const exportAllToJson = useCallback((): string => {
    const current = readFromStorage();
    return JSON.stringify(current.map((s) => s.workflow), null, 2);
  }, []);

  const importFromJson = useCallback(
    (
      json: string,
      options?: {
        resolveCapability?: ValidateWorkflowOptions['resolveCapability'];
        maxSteps?: number;
      }
    ): { imported: number; skipped: Array<{ reason: string }> } => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        throw new Error('JSON 格式错误,无法解析');
      }
      const list: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
      const current = readFromStorage();
      const imported: WorkflowSlot[] = [];
      // 收集被跳过条目的原因,供调用方提示用户(不再静默吞错)
      const skipped: Array<{ reason: string }> = [];
      const now = Date.now();

      for (const item of list) {
        // 先做 zod 形状校验
        const shapeResult = workflowSchema.safeParse(item);
        if (!shapeResult.success) {
          // 跳过无效条目而非抛错,继续处理后续;记录原因供调用方提示
          const detail = shapeResult.error.issues
            .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
            .join('; ');
          skipped.push({ reason: `shape validation failed: ${detail}` });
          continue;
        }
        // 再做完整结构校验(含 capability 兼容性若提供回调)
        const fullResult = validateWorkflow(item, options);
        if (!fullResult.success) {
          // 结构问题也跳过(导入是宽容操作,不阻断有效条目),但记录原因
          const detail = fullResult.error.issues
            .map((i) => i.message)
            .join('; ');
          skipped.push({ reason: `structural validation failed: ${detail}` });
          continue;
        }
        // 检查上限
        if (current.length + imported.length >= limit) {
          throw new Error(
            `导入会超过上限(${limit} 个),已导入 ${imported.length} 条,请先删除部分工作流`
          );
        }
        imported.push({
          id: genId(),
          name: shapeResult.data.name,
          workflow: shapeResult.data,
          createdAt: now,
          updatedAt: now,
        });
      }

      if (imported.length === 0) {
        // 不再以"没有有效工作流"作为唯一信息;把跳过原因一并抛出,
        // 让用户知道为什么一个都没导入(而非笼统失败)
        const skipSummary = skipped.length > 0
          ? `; skipped: ${skipped.map((s) => s.reason).join(' | ')}`
          : '';
        throw new Error(`JSON 中没有有效的工作流定义${skipSummary}`);
      }

      const next = [...current, ...imported];
      writeToStorage(next);
      setSlots(next);
      return { imported: imported.length, skipped };
    },
    [limit]
  );

  const canSaveMore = slots.length < limit;
  const remaining = Math.max(0, limit - slots.length);

  return {
    slots,
    save,
    remove,
    load,
    limit,
    canSaveMore,
    remaining,
    exportToJson,
    exportAllToJson,
    importFromJson,
  };
}
