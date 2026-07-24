/**
 * i18n 翻译字典(@lokvis/embed-image 内部副本)。
 *
 * 仅包含 @lokvis/embed-image 用到的 key:
 *   - quick* 系列(60 个,覆盖 6 个工具 × 10 个 key)
 *   - error.* / common.retry(ErrorBoundary 用)
 *
 * 其他模块(nav / sdk / runtime / compress 等)由 playground 自己的字典维护。
 *
 * 与 apps/playground/src/i18n/ui.ts 中对应 key 保持一致;
 * 包内独立维护避免与 playground 相互耦合。
 *
 * Task 2 将重构为 Provider 模式,允许三方注入自定义翻译。
 */
import type { Language } from './config';

type TranslationEntry = Record<Language, string>;

export const ui: Record<string, TranslationEntry> = {
  // ─── Quick Compress ──────────────────────────────────────
  'quickCompress.title': { en: 'Quick Compress', zh: '一键压缩', ja: 'クイック圧縮', es: 'Compresión rápida', de: 'Schnelle Komprimierung', fr: 'Compression rapide' },
  'quickCompress.subtitle': { en: 'Drop image → auto compress to WebP', zh: '拖入图片 → 立即压缩为 WebP', ja: '画像をドロップ → WebP に自動圧縮', es: 'Suelta imagen → comprimir automáticamente a WebP', de: 'Bild ablegen → automatisch zu WebP komprimieren', fr: 'Déposez l\'image → compression auto en WebP' },
  'quickCompress.presetBalanced': { en: 'Balanced', zh: '均衡', ja: 'バランス', es: 'Equilibrado', de: 'Ausgewogen', fr: 'Équilibré' },
  'quickCompress.presetHighQuality': { en: 'High Quality', zh: '高质量', ja: '高品質', es: 'Alta calidad', de: 'Hohe Qualität', fr: 'Haute qualité' },
  'quickCompress.presetSmall': { en: 'Small', zh: '小体积', ja: '小サイズ', es: 'Pequeño', de: 'Klein', fr: 'Petit' },
  'quickCompress.dropHint': { en: 'Click or drop image', zh: '点击或拖入图片', ja: 'クリックまたは画像をドロップ', es: 'Haz clic o suelta una imagen', de: 'Klicken oder Bild ablegen', fr: 'Cliquez ou déposez une image' },
  'quickCompress.processing': { en: 'Compressing…', zh: '压缩中…', ja: '圧縮中…', es: 'Comprimiendo…', de: 'Komprimieren…', fr: 'Compression…' },
  'quickCompress.download': { en: 'Download', zh: '下载', ja: 'ダウンロード', es: 'Descargar', de: 'Herunterladen', fr: 'Télécharger' },
  'quickCompress.retry': { en: 'Try another', zh: '再试一张', ja: 'もう一枚', es: 'Probar otra', de: 'Eine andere probieren', fr: 'Essayer une autre' },

  // ─── Quick Resize ────────────────────────────────────────
  'quickResize.title': { en: 'Quick Resize', zh: '一键缩放', ja: 'クイックリサイズ', es: 'Redimensionamiento rápido', de: 'Schnelle Größenänderung', fr: 'Redimensionnement rapide' },
  'quickResize.subtitle': { en: 'Drop image → resize to preset', zh: '拖入图片 → 按预设缩放', ja: '画像をドロップ → プリセットにリサイズ', es: 'Suelta imagen → redimensionar a preset', de: 'Bild ablegen → auf Voreinstellung verkleinern', fr: 'Déposez l\'image → redimensionner selon le preset' },
  'quickResize.presetIgSquare': { en: 'IG 1:1', zh: 'IG 1:1', ja: 'IG 1:1', es: 'IG 1:1', de: 'IG 1:1', fr: 'IG 1:1' },
  'quickResize.presetYtLandscape': { en: 'YouTube 16:9', zh: 'YouTube 16:9', ja: 'YouTube 16:9', es: 'YouTube 16:9', de: 'YouTube 16:9', fr: 'YouTube 16:9' },
  'quickResize.presetTkPortrait': { en: 'TikTok 9:16', zh: 'TikTok 9:16', ja: 'TikTok 9:16', es: 'TikTok 9:16', de: 'TikTok 9:16', fr: 'TikTok 9:16' },
  'quickResize.presetHalf': { en: '50%', zh: '50%', ja: '50%', es: '50%', de: '50%', fr: '50%' },
  'quickResize.dropHint': { en: 'Click or drop image', zh: '点击或拖入图片', ja: 'クリックまたは画像をドロップ', es: 'Haz clic o suelta una imagen', de: 'Klicken oder Bild ablegen', fr: 'Cliquez ou déposez une image' },
  'quickResize.processing': { en: 'Resizing…', zh: '缩放中…', ja: 'リサイズ中…', es: 'Redimensionando…', de: 'Größe ändern…', fr: 'Redimensionnement…' },
  'quickResize.download': { en: 'Download', zh: '下载', ja: 'ダウンロード', es: 'Descargar', de: 'Herunterladen', fr: 'Télécharger' },
  'quickResize.retry': { en: 'Try another', zh: '再试一张', ja: 'もう一枚', es: 'Probar otra', de: 'Eine andere probieren', fr: 'Essayer une autre' },

  // ─── Quick Convert ───────────────────────────────────────
  'quickConvert.title': { en: 'Quick Convert', zh: '一键转格式', ja: 'クイック変換', es: 'Conversión rápida', de: 'Schnelle Konvertierung', fr: 'Conversion rapide' },
  'quickConvert.subtitle': { en: 'Drop image → convert format', zh: '拖入图片 → 转换格式', ja: '画像をドロップ → 形式変換', es: 'Suelta imagen → convertir formato', de: 'Bild ablegen → Format konvertieren', fr: 'Déposez l\'image → convertir le format' },
  'quickConvert.presetPng': { en: 'PNG', zh: 'PNG', ja: 'PNG', es: 'PNG', de: 'PNG', fr: 'PNG' },
  'quickConvert.presetWebp': { en: 'WebP', zh: 'WebP', ja: 'WebP', es: 'WebP', de: 'WebP', fr: 'WebP' },
  'quickConvert.presetAvif': { en: 'AVIF', zh: 'AVIF', ja: 'AVIF', es: 'AVIF', de: 'AVIF', fr: 'AVIF' },
  'quickConvert.presetJpeg': { en: 'JPEG', zh: 'JPEG', ja: 'JPEG', es: 'JPEG', de: 'JPEG', fr: 'JPEG' },
  'quickConvert.dropHint': { en: 'Click or drop image', zh: '点击或拖入图片', ja: 'クリックまたは画像をドロップ', es: 'Haz clic o suelta una imagen', de: 'Klicken oder Bild ablegen', fr: 'Cliquez ou déposez une image' },
  'quickConvert.processing': { en: 'Converting…', zh: '转换中…', ja: '変換中…', es: 'Convirtiendo…', de: 'Konvertieren…', fr: 'Conversion…' },
  'quickConvert.slowEncoder': { en: 'AVIF uses a software encoder in this browser, so conversion may take a few seconds.', zh: '当前浏览器不原生支持 AVIF 编码，将改用软件编码器，转换可能需要几秒钟。', ja: 'このブラウザは AVIF エンコードにネイティブ対応していないためソフトウェアエンコーダーを使用します。変換に数秒かかる場合があります。', es: 'Este navegador no admite codificación AVIF nativa, por lo que se usa un codificador de software y la conversión puede tardar unos segundos.', de: 'Dieser Browser unterstützt keine native AVIF-Kodierung, daher wird ein Software-Encoder verwendet; die Konvertierung kann einige Sekunden dauern.', fr: 'Ce navigateur ne prend pas en charge l\'encodage AVIF natif, un encodeur logiciel est donc utilisé ; la conversion peut prendre quelques secondes.' },
  'quickConvert.download': { en: 'Download', zh: '下载', ja: 'ダウンロード', es: 'Descargar', de: 'Herunterladen', fr: 'Télécharger' },
  'quickConvert.retry': { en: 'Try another', zh: '再试一张', ja: 'もう一枚', es: 'Probar otra', de: 'Eine andere probieren', fr: 'Essayer une autre' },

  // ─── Quick Favicon ───────────────────────────────────────
  'quickFavicon.title': { en: 'Quick Favicon', zh: '一键 Favicon', ja: 'クイック Favicon', es: 'Favicon rápido', de: 'Schnelles Favicon', fr: 'Favicon rapide' },
  'quickFavicon.subtitle': { en: 'Drop image → multi-size ICO', zh: '拖入图片 → 多尺寸 ICO', ja: '画像をドロップ → マルチサイズ ICO', es: 'Suelta imagen → ICO multi-tamaño', de: 'Bild ablegen → mehrgrößiges ICO', fr: 'Déposez l\'image → ICO multi-tailles' },
  'quickFavicon.presetStandard': { en: 'Standard', zh: '标准', ja: '標準', es: 'Estándar', de: 'Standard', fr: 'Standard' },
  'quickFavicon.presetModern': { en: 'Modern', zh: '现代', ja: 'モダン', es: 'Moderno', de: 'Modern', fr: 'Moderne' },
  'quickFavicon.presetFull': { en: 'Full', zh: '全兼容', ja: 'フル', es: 'Completo', de: 'Vollständig', fr: 'Complet' },
  'quickFavicon.dropHint': { en: 'Click or drop image', zh: '点击或拖入图片', ja: 'クリックまたは画像をドロップ', es: 'Haz clic o suelta una imagen', de: 'Klicken oder Bild ablegen', fr: 'Cliquez ou déposez une image' },
  'quickFavicon.processing': { en: 'Generating…', zh: '生成中…', ja: '生成中…', es: 'Generando…', de: 'Generieren…', fr: 'Génération…' },
  'quickFavicon.download': { en: 'Download', zh: '下载', ja: 'ダウンロード', es: 'Descargar', de: 'Herunterladen', fr: 'Télécharger' },
  'quickFavicon.retry': { en: 'Try another', zh: '再试一张', ja: 'もう一枚', es: 'Probar otra', de: 'Eine andere probieren', fr: 'Essayer une autre' },

  // ─── Quick Watermark ─────────────────────────────────────
  'quickWatermark.title': { en: 'Quick Watermark', zh: '一键加水印', ja: 'クイックウォーターマーク', es: 'Marca de agua rápida', de: 'Schnelles Wasserzeichen', fr: 'Filigrane rapide' },
  'quickWatermark.subtitle': { en: 'Drop image → add text watermark', zh: '拖入图片 → 加文字水印', ja: '画像をドロップ → テキスト透かし', es: 'Suelta imagen → añadir marca de agua', de: 'Bild ablegen → Text-Wasserzeichen hinzufügen', fr: 'Déposez l\'image → ajouter un filigrane texte' },
  'quickWatermark.presetSmallBr': { en: 'Bottom-right small', zh: '右下角小字', ja: '右下小文字', es: 'Abajo-derecha pequeño', de: 'Unten-rechts klein', fr: 'Bas-droite petit' },
  'quickWatermark.presetLargeCenter': { en: 'Center large', zh: '居中大字', ja: '中央大文字', es: 'Centro grande', de: 'Mitte groß', fr: 'Centre grand' },
  'quickWatermark.presetTile': { en: 'Tiled', zh: '平铺', ja: 'タイル状', es: 'Mosaico', de: 'Kacheln', fr: 'Mosaïque' },
  'quickWatermark.dropHint': { en: 'Click or drop image', zh: '点击或拖入图片', ja: 'クリックまたは画像をドロップ', es: 'Haz clic o suelta una imagen', de: 'Klicken oder Bild ablegen', fr: 'Cliquez ou déposez une image' },
  'quickWatermark.textPlaceholder': { en: 'Watermark text', zh: '水印文字', ja: '透かしテキスト', es: 'Texto de marca de agua', de: 'Wasserzeichentext', fr: 'Texte du filigrane' },
  'quickWatermark.processing': { en: 'Watermarking…', zh: '加水印中…', ja: '透かし追加中…', es: 'Añadiendo marca…', de: 'Wasserzeichen hinzufügen…', fr: 'Ajout du filigrane…' },
  'quickWatermark.download': { en: 'Download', zh: '下载', ja: 'ダウンロード', es: 'Descargar', de: 'Herunterladen', fr: 'Télécharger' },
  'quickWatermark.retry': { en: 'Try another', zh: '再试一张', ja: 'もう一枚', es: 'Probar otra', de: 'Eine andere probieren', fr: 'Essayer une autre' },

  // ─── Quick Crop ──────────────────────────────────────────
  'quickCrop.title': { en: 'Quick Crop', zh: '一键裁剪', ja: 'クイッククロップ', es: 'Recorte rápido', de: 'Schneller Zuschnitt', fr: 'Recadrage rapide' },
  'quickCrop.subtitle': { en: 'Drop image → crop by aspect ratio', zh: '拖入图片 → 按比例裁剪', ja: '画像をドロップ → アスペクト比で切り抜き', es: 'Suelta imagen → recortar por proporción', de: 'Bild ablegen → nach Seitenverhältnis zuschneiden', fr: 'Déposez l\'image → recadrer par ratio' },
  'quickCrop.presetSquare': { en: '1:1 Square', zh: '1:1 正方形', ja: '1:1 正方形', es: '1:1 Cuadrado', de: '1:1 Quadrat', fr: '1:1 Carré' },
  'quickCrop.preset43': { en: '4:3', zh: '4:3', ja: '4:3', es: '4:3', de: '4:3', fr: '4:3' },
  'quickCrop.preset169': { en: '16:9', zh: '16:9', ja: '16:9', es: '16:9', de: '16:9', fr: '16:9' },
  'quickCrop.presetFree': { en: 'Free', zh: '自由', ja: 'フリー', es: 'Libre', de: 'Frei', fr: 'Libre' },
  'quickCrop.cropArea': { en: 'Crop area', zh: '裁剪区域', ja: 'クロップ領域', es: 'Área de recorte', de: 'Zuschnittbereich', fr: 'Zone de recadrage' },
  'quickCrop.dropHint': { en: 'Click or drop image', zh: '点击或拖入图片', ja: 'クリックまたは画像をドロップ', es: 'Haz clic o suelta una imagen', de: 'Klicken oder Bild ablegen', fr: 'Cliquez ou déposez une image' },
  'quickCrop.processing': { en: 'Cropping…', zh: '裁剪中…', ja: '切り抜き中…', es: 'Recortando…', de: 'Zuschneiden…', fr: 'Recadrage…' },
  'quickCrop.download': { en: 'Download', zh: '下载', ja: 'ダウンロード', es: 'Descargar', de: 'Herunterladen', fr: 'Télécharger' },
  'quickCrop.retry': { en: 'Try another', zh: '再试一张', ja: 'もう一枚', es: 'Probar otra', de: 'Eine andere probieren', fr: 'Essayer une autre' },

  // ─── Quick Pipeline ──────────────────────────────────────
  'quickPipeline.title': { en: 'Image Pipeline', zh: '图片流水线', ja: '画像パイプライン', es: 'Pipeline de imagen', de: 'Bild-Pipeline', fr: 'Pipeline d\'image' },
  'quickPipeline.subtitle': { en: 'Drop image → run multi-step pipeline', zh: '拖入图片 → 跑多步流水线', ja: '画像をドロップ → マルチステップパイプライン', es: 'Suelta imagen → ejecutar pipeline multi-paso', de: 'Bild ablegen → Multi-Step-Pipeline ausführen', fr: 'Déposez l\'image → exécuter le pipeline multi-étapes' },
  'quickPipeline.presetEcommerce': { en: 'E-commerce', zh: '电商主图', ja: 'ECメイン画像', es: 'E-commerce', de: 'E-Commerce', fr: 'E-commerce' },
  'quickPipeline.presetSocial': { en: 'Social', zh: '社交分享', ja: 'ソーシャル', es: 'Social', de: 'Social', fr: 'Social' },
  'quickPipeline.presetThumbnail': { en: 'Thumbnail', zh: '网页缩略图', ja: 'サムネイル', es: 'Miniatura', de: 'Thumbnail', fr: 'Vignette' },
  'quickPipeline.presetBlog': { en: 'Blog', zh: '博客配图', ja: 'ブログ画像', es: 'Blog', de: 'Blog', fr: 'Blog' },
  'quickPipeline.steps': { en: 'Steps', zh: '步骤', ja: 'ステップ', es: 'Pasos', de: 'Schritte', fr: 'Étapes' },
  'quickPipeline.dropHint': { en: 'Click or drop image', zh: '点击或拖入图片', ja: 'クリックまたは画像をドロップ', es: 'Haz clic o suelta una imagen', de: 'Klicken oder Bild ablegen', fr: 'Cliquez ou déposez une image' },
  'quickPipeline.processing': { en: 'Running pipeline…', zh: '执行流水线中…', ja: 'パイプライン実行中…', es: 'Ejecutando pipeline…', de: 'Pipeline wird ausgeführt…', fr: 'Pipeline en cours…' },
  'quickPipeline.download': { en: 'Download', zh: '下载', ja: 'ダウンロード', es: 'Descargar', de: 'Herunterladen', fr: 'Télécharger' },
  'quickPipeline.retry': { en: 'Try another', zh: '再试一张', ja: 'もう一枚', es: 'Probar otra', de: 'Eine andere probieren', fr: 'Essayer une autre' },

  // ─── ErrorBoundary ───────────────────────────────────────
  'common.retry': { en: 'Retry', zh: '重试', ja: '再試行', es: 'Reintentar', de: 'Erneut versuchen', fr: 'Réessayer' },

  // ─── 共享键(F5:跨工具通用,避免 6 工具重复) ──────────────
  'common.original': { en: 'Original', zh: '原图', ja: '元の画像', es: 'Original', de: 'Original', fr: 'Image d\'origine' },
  'common.result': { en: 'Result', zh: '结果', ja: '結果', es: 'Resultado', de: 'Ergebnis', fr: 'Résultat' },
  'common.changeImage': { en: 'Change image', zh: '换一张', ja: '画像を変更', es: 'Cambiar imagen', de: 'Bild ändern', fr: 'Changer d\'image' },
  'common.dropFormats': { en: 'PNG, JPEG, WebP, AVIF', zh: 'PNG、JPEG、WebP、AVIF', ja: 'PNG、JPEG、WebP、AVIF', es: 'PNG, JPEG, WebP, AVIF', de: 'PNG, JPEG, WebP, AVIF', fr: 'PNG, JPEG, WebP, AVIF' },
  'error.title': { en: 'Page Error', zh: '页面出错了', ja: 'ページエラーが発生しました', es: 'Error de página', de: 'Seitenfehler', fr: 'Erreur de page' },
  'error.logged': { en: 'Error has been logged.', zh: '错误已记录。', ja: 'エラーが記録されました。', es: 'El error ha sido registrado.', de: 'Der Fehler wurde protokolliert.', fr: "L'erreur a été enregistrée." },
  'error.retryHint': { en: ' Refresh the page or click the button below to retry.', zh: '刷新页面或点击下方按钮重试。', ja: ' ページを更新するか、下のボタンをクリックして再試行してください。', es: ' Actualiza la página o haz clic en el botón siguiente para reintentar.', de: ' Aktualisiere die Seite oder klicke auf die Schaltfläche unten, um es erneut zu versuchen.', fr: ' Actualise la page ou clique sur le bouton ci-dessous pour réessayer.' },
  'error.retryExceeded': { en: ' Please refresh the page and try again.', zh: '请刷新页面后重试。', ja: ' ページを更新して再度お試しください。', es: ' Por favor, actualiza la página e inténtalo de nuevo.', de: ' Bitte aktualisiere die Seite und versuche es erneut.', fr: ' Veuillez actualiser la page et réessayer.' },
};
