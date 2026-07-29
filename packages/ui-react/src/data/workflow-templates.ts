/**
 * 工作流模板数据(W11.4)
 *
 * 5 个内置模板,覆盖常见图片处理场景:
 *   1. Web 优化 - resize + compress(webp),适用于网页素材
 *   2. 社媒批量 - resize(1080) + watermark,适用于 Instagram/Twitter
 *   3. 电商主图 - resize(800) + compress(jpeg) + watermark
 *   4. 打印预处理 - resize(高分辨率) + convert(png),无损打印
 *   5. 截图压缩 - resize(1280) + compress(png, 低质量),减小体积
 *
 * 每个模板仅含 capability + 默认 params,由 loadWorkflowTemplate() 应用到 store。
 * 用户应用模板后仍可在 Inspector 调整参数。
 *
 * 名称 / 描述以 i18n 键(nameKey / descriptionKey)承载,由 UI 层 t() 解析,
 * 数据层不内嵌本地化文案(架构评审 #10)。
 *
 * @module workflow-templates
 */

/** 单个模板节点定义 */
export interface WorkflowTemplateNode {
  /** 能力名,如 `image.resize` */
  capability: string;
  /** 默认参数(用户可修改) */
  params: Record<string, unknown>;
}

/** 工作流模板 */
export interface WorkflowTemplate {
  /** 模板 ID(唯一) */
  id: string;
  /** i18n 键:模板名称(由 UI 层 t() 解析,数据层不内嵌本地化文案) */
  nameKey: string;
  /** i18n 键:模板描述 */
  descriptionKey: string;
  /** 图标 emoji(用于 UI 展示) */
  icon: string;
  /** 模板分类 */
  category: 'web' | 'social' | 'ecommerce' | 'print' | 'utility';
  /** 节点序列 */
  nodes: WorkflowTemplateNode[];
}

/** 5 个内置工作流模板 */
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'tpl-web-optimize',
    nameKey: 'workflowTemplates.tpl.webOptimize.name',
    descriptionKey: 'workflowTemplates.tpl.webOptimize.desc',
    icon: '🌐',
    category: 'web',
    nodes: [
      {
        capability: 'image.resize',
        params: { width: 1920, height: 1080, fit: 'inside' },
      },
      {
        capability: 'image.compress',
        params: { format: 'webp', quality: 80 },
      },
    ],
  },
  {
    id: 'tpl-social-batch',
    nameKey: 'workflowTemplates.tpl.socialBatch.name',
    descriptionKey: 'workflowTemplates.tpl.socialBatch.desc',
    icon: '📱',
    category: 'social',
    nodes: [
      {
        capability: 'image.resize',
        params: { width: 1080, height: 1080, fit: 'cover' },
      },
      {
        capability: 'image.watermark',
        params: { text: '@username', position: 'bottom-right', opacity: 0.7 },
      },
    ],
  },
  {
    id: 'tpl-ecommerce-main',
    nameKey: 'workflowTemplates.tpl.ecommerceMain.name',
    descriptionKey: 'workflowTemplates.tpl.ecommerceMain.desc',
    icon: '🛒',
    category: 'ecommerce',
    nodes: [
      {
        capability: 'image.resize',
        params: { width: 800, height: 800, fit: 'contain' },
      },
      {
        capability: 'image.compress',
        params: { format: 'jpeg', quality: 90 },
      },
      {
        capability: 'image.watermark',
        params: { text: '@shop', position: 'center', opacity: 0.3 },
      },
    ],
  },
  {
    id: 'tpl-print-prep',
    nameKey: 'workflowTemplates.tpl.printPrep.name',
    descriptionKey: 'workflowTemplates.tpl.printPrep.desc',
    icon: '🖨️',
    category: 'print',
    nodes: [
      {
        capability: 'image.resize',
        params: { width: 3508, height: 2480, fit: 'inside', dpi: 300 },
      },
      {
        capability: 'image.convert',
        params: { format: 'png' },
      },
    ],
  },
  {
    id: 'tpl-screenshot-compress',
    nameKey: 'workflowTemplates.tpl.screenshotCompress.name',
    descriptionKey: 'workflowTemplates.tpl.screenshotCompress.desc',
    icon: '📸',
    category: 'utility',
    nodes: [
      {
        capability: 'image.resize',
        params: { width: 1280, height: 720, fit: 'inside' },
      },
      {
        capability: 'image.compress',
        params: { format: 'png', quality: 60 },
      },
    ],
  },
];

/** 按 ID 查找模板 */
export function findTemplate(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id);
}
