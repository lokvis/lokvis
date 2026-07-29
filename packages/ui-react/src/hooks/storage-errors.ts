/**
 * 本地存储类 hook 的可本地化错误(架构评审 #10)
 *
 * useWorkflows / useCustomPresets 此前直接 `throw new Error('中文文案')`,
 * 把本地化文案硬编码进了数据/逻辑层。hook 无 i18n 语言上下文(不能调 t()),
 * 故改为抛出携带**稳定 code + i18n 键 + 插值参数**的结构化错误:
 *
 *   catch (e) {
 *     if (e instanceof LokvisStorageError) setError({ key: e.messageKey, params: e.params });
 *   }
 *
 * `message` 仅作开发期英文兜底(日志/非本地化消费方),不用于最终 UI 展示。
 */

/** 存储类错误的稳定标识(供消费方 switch / 埋点,不随文案变化) */
export type LokvisStorageErrorCode =
  | 'workflow.saveLimit'
  | 'workflow.importParse'
  | 'workflow.importLimit'
  | 'workflow.importEmpty'
  | 'preset.invalidSize'
  | 'preset.emptyName'
  | 'preset.saveLimit';

/** 结构化本地存储错误:携带 code + i18n 键 + 参数 */
export class LokvisStorageError extends Error {
  /** 稳定错误码 */
  readonly code: LokvisStorageErrorCode;
  /** i18n 键,供 UI 层 t(messageKey, params) 解析 */
  readonly messageKey: string;
  /** i18n 插值参数 */
  readonly params?: Record<string, unknown>;

  constructor(
    code: LokvisStorageErrorCode,
    messageKey: string,
    fallbackMessage: string,
    params?: Record<string, unknown>
  ) {
    super(fallbackMessage);
    this.name = 'LokvisStorageError';
    this.code = code;
    this.messageKey = messageKey;
    this.params = params;
  }
}
