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
  /** 从 JSON 字符导入工作流(单个或数组);返回导入的条目数 */
  importFromJson(
    json: string,
    options?: { resolveCapability?: ValidateWorkflowOptions['resolveCapability']; maxSteps?: number }
  ): number;
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
      if (!it || typeof it !== 'object') return false;
      const s = it as Record<string, unknown>;
      if (
        typeof s.id !== 'string' ||
        typeof s.name !== 'string' ||
        typeof s.createdAt !== 'number' ||
        typeof s.updatedAt !== 'number'
      ) {
        return false;
      }
      // workflow 字段必须通过 schema 校验
      const result = workflowSchema.safeParse(s.workflow);
      return result.success;
    });
  } catch {
    return [];
  }
}

/** 写入 localStorage(失败静默) */
function writeToStorage(slots: WorkflowSlot[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
    window.dispatchEvent(new CustomEvent(SYNC_EVENT));
  } catch {
    /* 隐私模式 localStorage 可能不可用,静默 */
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
          writeToStorage(next);
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
      writeToStorage(next);
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
    ): number => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        throw new Error('JSON 格式错误,无法解析');
      }
      const list: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
      const current = readFromStorage();
      const imported: WorkflowSlot[] = [];
      const now = Date.now();

      for (const item of list) {
        // 先做 zod 形状校验
        const shapeResult = workflowSchema.safeParse(item);
        if (!shapeResult.success) {
          // 跳过无效条目而非抛错,继续处理后续
          continue;
        }
        // 再做完整结构校验(含 capability 兼容性若提供回调)
        const fullResult = validateWorkflow(item, options);
        if (!fullResult.success) {
          // 结构问题也跳过(导入是宽容操作,不阻断有效条目)
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
        throw new Error('JSON 中没有有效的工作流定义');
      }

      const next = [...current, ...imported];
      writeToStorage(next);
      setSlots(next);
      return imported.length;
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
