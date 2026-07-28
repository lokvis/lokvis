/**
 * i18n 翻译字典(@lokvis/embed-pdf 内部)。
 *
 * 包含 5 个 PDF 工具的翻译 key + error/common 通用 key。
 * 6 语言:en / zh / ja / es / de / fr
 */
import type { Language } from './config';

type TranslationEntry = Record<Language, string>;

export const ui: Record<string, TranslationEntry> = {
  // ─── PDF Compress ────────────────────────────────────────
  'pdfCompress.title': { en: 'PDF Compress', zh: 'PDF 压缩', ja: 'PDF 圧縮', es: 'Comprimir PDF', de: 'PDF komprimieren', fr: 'Compresser un PDF' },
  'pdfCompress.subtitle': { en: 'Drop PDF → reduce file size', zh: '拖入 PDF → 减小文件体积', ja: 'PDF をドロップ → ファイルサイズを削減', es: 'Suelta un PDF → reduce el tamaño', de: 'PDF ablegen → Dateigröße reduzieren', fr: 'Déposez un PDF → réduisez la taille' },
  'pdfCompress.presetBalanced': { en: 'Balanced', zh: '均衡', ja: 'バランス', es: 'Equilibrado', de: 'Ausgewogen', fr: 'Équilibré' },
  'pdfCompress.presetHigh': { en: 'High', zh: '高压缩', ja: '高圧縮', es: 'Alta', de: 'Hoch', fr: 'Élevée' },
  'pdfCompress.presetMaximum': { en: 'Maximum', zh: '极限', ja: '最大', es: 'Máxima', de: 'Maximum', fr: 'Maximale' },
  'pdfCompress.dropHint': { en: 'Click or drop PDF', zh: '点击或拖入 PDF', ja: 'クリックまたは PDF をドロップ', es: 'Haz clic o suelta un PDF', de: 'Klicken oder PDF ablegen', fr: 'Cliquez ou déposez un PDF' },
  'pdfCompress.processing': { en: 'Compressing…', zh: '压缩中…', ja: '圧縮中…', es: 'Comprimiendo…', de: 'Komprimieren…', fr: 'Compression…' },
  'pdfCompress.download': { en: 'Download', zh: '下载', ja: 'ダウンロード', es: 'Descargar', de: 'Herunterladen', fr: 'Télécharger' },
  'pdfCompress.retry': { en: 'Try another', zh: '换一个', ja: '別のファイル', es: 'Probar otro', de: 'Eine andere probieren', fr: 'Essayer un autre' },

  // ─── PDF Merge ───────────────────────────────────────────
  'pdfMerge.title': { en: 'PDF Merge', zh: 'PDF 合并', ja: 'PDF 結合', es: 'Fusionar PDF', de: 'PDF zusammenführen', fr: 'Fusionner des PDF' },
  'pdfMerge.subtitle': { en: 'Drop multiple PDFs → merge into one', zh: '拖入多个 PDF → 合并为一个', ja: '複数の PDF をドロップ → 1 つに結合', es: 'Suelta varios PDF → fusionar en uno', de: 'Mehrere PDFs ablegen → zu einem zusammenführen', fr: 'Déposez plusieurs PDF → fusionner en un seul' },
  'pdfMerge.dropHint': { en: 'Click or drop PDFs', zh: '点击或拖入 PDF 文件', ja: 'クリックまたは PDF をドロップ', es: 'Haz clic o suelta archivos PDF', de: 'Klicken oder PDFs ablegen', fr: 'Cliquez ou déposez des PDF' },
  'pdfMerge.processing': { en: 'Merging…', zh: '合并中…', ja: '結合中…', es: 'Fusionando…', de: 'Zusammenführen…', fr: 'Fusion…' },
  'pdfMerge.download': { en: 'Download', zh: '下载', ja: 'ダウンロード', es: 'Descargar', de: 'Herunterladen', fr: 'Télécharger' },
  'pdfMerge.retry': { en: 'Try again', zh: '重新开始', ja: 'やり直す', es: 'Empezar de nuevo', de: 'Von vorn beginnen', fr: 'Recommencer' },

  // ─── PDF Split ───────────────────────────────────────────
  'pdfSplit.title': { en: 'PDF Split', zh: 'PDF 拆分', ja: 'PDF 分割', es: 'Dividir PDF', de: 'PDF aufteilen', fr: 'Diviser un PDF' },
  'pdfSplit.subtitle': { en: 'Drop PDF → split by pages', zh: '拖入 PDF → 按页拆分', ja: 'PDF をドロップ → ページごとに分割', es: 'Suelta un PDF → dividir por páginas', de: 'PDF ablegen → nach Seiten aufteilen', fr: 'Déposez un PDF → diviser par pages' },
  'pdfSplit.presetEveryPage': { en: 'Every page', zh: '每页一个', ja: '1 ページごと', es: 'Cada página', de: 'Jede Seite', fr: 'Chaque page' },
  'pdfSplit.preset2Pages': { en: '2 pages', zh: '每 2 页', ja: '2 ページごと', es: '2 páginas', de: '2 Seiten', fr: '2 pages' },
  'pdfSplit.preset5Pages': { en: '5 pages', zh: '每 5 页', ja: '5 ページごと', es: '5 páginas', de: '5 Seiten', fr: '5 pages' },
  'pdfSplit.presetCustom': { en: 'Custom', zh: '自定义', ja: 'カスタム', es: 'Personalizado', de: 'Benutzerdefiniert', fr: 'Personnalisé' },
  'pdfSplit.dropHint': { en: 'Click or drop PDF', zh: '点击或拖入 PDF', ja: 'クリックまたは PDF をドロップ', es: 'Haz clic o suelta un PDF', de: 'Klicken oder PDF ablegen', fr: 'Cliquez ou déposez un PDF' },
  'pdfSplit.processing': { en: 'Splitting…', zh: '拆分中…', ja: '分割中…', es: 'Dividiendo…', de: 'Aufteilen…', fr: 'Division…' },
  'pdfSplit.download': { en: 'Download all', zh: '全部下载', ja: 'すべてダウンロード', es: 'Descargar todo', de: 'Alle herunterladen', fr: 'Tout télécharger' },
  'pdfSplit.retry': { en: 'Try another', zh: '换一个', ja: '別のファイル', es: 'Probar otro', de: 'Eine andere probieren', fr: 'Essayer un autre' },

  // ─── PDF Rotate ──────────────────────────────────────────
  'pdfRotate.title': { en: 'PDF Rotate', zh: 'PDF 旋转', ja: 'PDF 回転', es: 'Rotar PDF', de: 'PDF drehen', fr: 'Pivoter un PDF' },
  'pdfRotate.subtitle': { en: 'Drop PDF → rotate pages', zh: '拖入 PDF → 旋转页面', ja: 'PDF をドロップ → ページを回転', es: 'Suelta un PDF → rotar páginas', de: 'PDF ablegen → Seiten drehen', fr: 'Déposez un PDF → pivoter les pages' },
  'pdfRotate.preset90': { en: '90°', zh: '90°', ja: '90°', es: '90°', de: '90°', fr: '90°' },
  'pdfRotate.preset180': { en: '180°', zh: '180°', ja: '180°', es: '180°', de: '180°', fr: '180°' },
  'pdfRotate.preset270': { en: '270°', zh: '270°', ja: '270°', es: '270°', de: '270°', fr: '270°' },
  'pdfRotate.dropHint': { en: 'Click or drop PDF', zh: '点击或拖入 PDF', ja: 'クリックまたは PDF をドロップ', es: 'Haz clic o suelta un PDF', de: 'Klicken oder PDF ablegen', fr: 'Cliquez ou déposez un PDF' },
  'pdfRotate.processing': { en: 'Rotating…', zh: '旋转中…', ja: '回転中…', es: 'Rotando…', de: 'Drehen…', fr: 'Rotation…' },
  'pdfRotate.download': { en: 'Download', zh: '下载', ja: 'ダウンロード', es: 'Descargar', de: 'Herunterladen', fr: 'Télécharger' },
  'pdfRotate.retry': { en: 'Try another', zh: '换一个', ja: '別のファイル', es: 'Probar otro', de: 'Eine andere probieren', fr: 'Essayer un autre' },

  // ─── PDF Watermark ───────────────────────────────────────
  'pdfWatermark.title': { en: 'PDF Watermark', zh: 'PDF 水印', ja: 'PDF ウォーターマーク', es: 'Marca de agua PDF', de: 'PDF-Wasserzeichen', fr: 'Filigrane PDF' },
  'pdfWatermark.subtitle': { en: 'Drop PDF → add watermark', zh: '拖入 PDF → 添加水印', ja: 'PDF をドロップ → ウォーターマーク追加', es: 'Suelta un PDF → añadir marca de agua', de: 'PDF ablegen → Wasserzeichen hinzufügen', fr: 'Déposez un PDF → ajouter un filigrane' },
  'pdfWatermark.presetConfidential': { en: 'Confidential', zh: '机密', ja: '機密', es: 'Confidencial', de: 'Vertraulich', fr: 'Confidentiel' },
  'pdfWatermark.presetDraft': { en: 'Draft', zh: '草稿', ja: '下書き', es: 'Borrador', de: 'Entwurf', fr: 'Brouillon' },
  'pdfWatermark.presetCustom': { en: 'Custom', zh: '自定义', ja: 'カスタム', es: 'Personalizado', de: 'Benutzerdefiniert', fr: 'Personnalisé' },
  'pdfWatermark.dropHint': { en: 'Click or drop PDF', zh: '点击或拖入 PDF', ja: 'クリックまたは PDF をドロップ', es: 'Haz clic o suelta un PDF', de: 'Klicken oder PDF ablegen', fr: 'Cliquez ou déposez un PDF' },
  'pdfWatermark.textPlaceholder': { en: 'Watermark text', zh: '水印文字', ja: 'ウォーターマークテキスト', es: 'Texto de marca de agua', de: 'Wasserzeichentext', fr: 'Texte du filigrane' },
  'pdfWatermark.processing': { en: 'Adding watermark…', zh: '添加水印中…', ja: 'ウォーターマーク追加中…', es: 'Añadiendo marca…', de: 'Wasserzeichen hinzufügen…', fr: 'Ajout du filigrane…' },
  'pdfWatermark.download': { en: 'Download', zh: '下载', ja: 'ダウンロード', es: 'Descargar', de: 'Herunterladen', fr: 'Télécharger' },
  'pdfWatermark.retry': { en: 'Try another', zh: '换一个', ja: '別のファイル', es: 'Probar otro', de: 'Eine andere probieren', fr: 'Essayer un autre' },

  // ─── Common / Error ──────────────────────────────────────
  'common.retry': { en: 'Retry', zh: '重试', ja: '再試行', es: 'Reintentar', de: 'Erneut versuchen', fr: 'Réessayer' },
  'common.dropPdf': { en: 'PDF', zh: 'PDF', ja: 'PDF', es: 'PDF', de: 'PDF', fr: 'PDF' },
  'error.title': { en: 'Something went wrong', zh: '出错了', ja: 'エラーが発生しました', es: 'Algo salió mal', de: 'Etwas ist schiefgelaufen', fr: 'Une erreur est survenue' },
  'error.logged': { en: 'Error has been logged.', zh: '错误已记录。', ja: 'エラーが記録されました。', es: 'El error ha sido registrado.', de: 'Der Fehler wurde protokolliert.', fr: "L'erreur a été enregistrée." },
  'error.retryHint': { en: ' Refresh the page or click the button below to retry.', zh: '刷新页面或点击下方按钮重试。', ja: ' ページを更新するか、下のボタンをクリックして再試行してください。', es: ' Actualiza la página o haz clic en el botón para reintentar.', de: ' Aktualisiere die Seite oder klicke unten, um es erneut zu versuchen.', fr: ' Actualise la page ou clique sur le bouton pour réessayer.' },
  'error.retryExceeded': { en: ' Please refresh the page and try again.', zh: '请刷新页面后重试。', ja: ' ページを更新して再度お試しください。', es: ' Por favor, actualiza la página e inténtalo de nuevo.', de: ' Bitte aktualisiere die Seite und versuche es erneut.', fr: ' Veuillez actualiser la page et réessayer.' },
};
