/**
 * i18n 翻译字典(@lokvis/embed-video 内部副本)。
 *
 * 包含 7 个视频工具的翻译 key + ErrorBoundary 共享 key。
 * 6 语言:en / zh / ja / es / de / fr
 */
import type { Language } from './config';

type TranslationEntry = Record<Language, string>;

export const ui: Record<string, TranslationEntry> = {
  // ─── Video Compress ──────────────────────────────────────
  'videoCompress.title': { en: 'Video Compress', zh: '视频压缩', ja: '動画圧縮', es: 'Comprimir vídeo', de: 'Video komprimieren', fr: 'Compresser la vidéo' },
  'videoCompress.subtitle': { en: 'Drop video → auto compress', zh: '拖入视频 → 自动压缩', ja: '動画をドロップ → 自動圧縮', es: 'Suelta vídeo → comprimir automáticamente', de: 'Video ablegen → automatisch komprimieren', fr: 'Déposez la vidéo → compression auto' },
  'videoCompress.presetBalanced': { en: 'Balanced', zh: '均衡', ja: 'バランス', es: 'Equilibrado', de: 'Ausgewogen', fr: 'Équilibré' },
  'videoCompress.presetHigh': { en: 'High Quality', zh: '高质量', ja: '高品質', es: 'Alta calidad', de: 'Hohe Qualität', fr: 'Haute qualité' },
  'videoCompress.presetSmall': { en: 'Small', zh: '小体积', ja: '小サイズ', es: 'Pequeño', de: 'Klein', fr: 'Petit' },
  'videoCompress.dropHint': { en: 'Click or drop video', zh: '点击或拖入视频', ja: 'クリックまたは動画をドロップ', es: 'Haz clic o suelta un vídeo', de: 'Klicken oder Video ablegen', fr: 'Cliquez ou déposez une vidéo' },
  'videoCompress.processing': { en: 'Compressing…', zh: '压缩中…', ja: '圧縮中…', es: 'Comprimiendo…', de: 'Komprimieren…', fr: 'Compression…' },
  'videoCompress.download': { en: 'Download', zh: '下载', ja: 'ダウンロード', es: 'Descargar', de: 'Herunterladen', fr: 'Télécharger' },
  'videoCompress.retry': { en: 'Try another', zh: '再试一个', ja: 'もう一つ', es: 'Probar otro', de: 'Ein anderes probieren', fr: 'Essayer une autre' },

  // ─── Video Transcode ─────────────────────────────────────
  'videoTranscode.title': { en: 'Video Transcode', zh: '视频转码', ja: '動画トランスコード', es: 'Transcodificar vídeo', de: 'Video transkodieren', fr: 'Transcoder la vidéo' },
  'videoTranscode.subtitle': { en: 'Drop video → convert format', zh: '拖入视频 → 转换格式', ja: '動画をドロップ → 形式変換', es: 'Suelta vídeo → convertir formato', de: 'Video ablegen → Format konvertieren', fr: 'Déposez la vidéo → convertir le format' },
  'videoTranscode.presetMp4': { en: 'MP4', zh: 'MP4', ja: 'MP4', es: 'MP4', de: 'MP4', fr: 'MP4' },
  'videoTranscode.presetWebm': { en: 'WebM', zh: 'WebM', ja: 'WebM', es: 'WebM', de: 'WebM', fr: 'WebM' },
  'videoTranscode.presetGif': { en: 'GIF', zh: 'GIF', ja: 'GIF', es: 'GIF', de: 'GIF', fr: 'GIF' },
  'videoTranscode.dropHint': { en: 'Click or drop video', zh: '点击或拖入视频', ja: 'クリックまたは動画をドロップ', es: 'Haz clic o suelta un vídeo', de: 'Klicken oder Video ablegen', fr: 'Cliquez ou déposez une vidéo' },
  'videoTranscode.processing': { en: 'Transcoding…', zh: '转码中…', ja: 'トランスコード中…', es: 'Transcodificando…', de: 'Transkodieren…', fr: 'Transcodage…' },
  'videoTranscode.download': { en: 'Download', zh: '下载', ja: 'ダウンロード', es: 'Descargar', de: 'Herunterladen', fr: 'Télécharger' },
  'videoTranscode.retry': { en: 'Try another', zh: '再试一个', ja: 'もう一つ', es: 'Probar otro', de: 'Ein anderes probieren', fr: 'Essayer une autre' },

  // ─── Video Trim ──────────────────────────────────────────
  'videoTrim.title': { en: 'Video Trim', zh: '视频裁剪', ja: '動画トリミング', es: 'Recortar vídeo', de: 'Video zuschneiden', fr: 'Découper la vidéo' },
  'videoTrim.subtitle': { en: 'Drop video → trim segment', zh: '拖入视频 → 裁剪片段', ja: '動画をドロップ → 区間をトリミング', es: 'Suelta vídeo → recortar segmento', de: 'Video ablegen → Segment zuschneiden', fr: 'Déposez la vidéo → découper un segment' },
  'videoTrim.dropHint': { en: 'Click or drop video', zh: '点击或拖入视频', ja: 'クリックまたは動画をドロップ', es: 'Haz clic o suelta un vídeo', de: 'Klicken oder Video ablegen', fr: 'Cliquez ou déposez une vidéo' },
  'videoTrim.startTime': { en: 'Start time (s)', zh: '起始时间(秒)', ja: '開始時間(秒)', es: 'Tiempo de inicio (s)', de: 'Startzeit (s)', fr: 'Temps de début (s)' },
  'videoTrim.endTime': { en: 'End time (s)', zh: '结束时间(秒)', ja: '終了時間(秒)', es: 'Tiempo de fin (s)', de: 'Endzeit (s)', fr: 'Temps de fin (s)' },
  'videoTrim.processing': { en: 'Trimming…', zh: '裁剪中…', ja: 'トリミング中…', es: 'Recortando…', de: 'Zuschneiden…', fr: 'Découpage…' },
  'videoTrim.download': { en: 'Download', zh: '下载', ja: 'ダウンロード', es: 'Descargar', de: 'Herunterladen', fr: 'Télécharger' },
  'videoTrim.retry': { en: 'Try another', zh: '再试一个', ja: 'もう一つ', es: 'Probar otro', de: 'Ein anderes probieren', fr: 'Essayer une autre' },

  // ─── Video Merge ─────────────────────────────────────────
  'videoMerge.title': { en: 'Video Merge', zh: '视频拼接', ja: '動画結合', es: 'Fusionar vídeos', de: 'Videos zusammenführen', fr: 'Fusionner les vidéos' },
  'videoMerge.subtitle': { en: 'Drop videos → merge into one', zh: '拖入多个视频 → 合并为一个', ja: '動画をドロップ → 一つに結合', es: 'Suelta vídeos → fusionar en uno', de: 'Videos ablegen → zu einem zusammenführen', fr: 'Déposez des vidéos → fusionner en une' },
  'videoMerge.dropHint': { en: 'Click or drop videos', zh: '点击或拖入视频(可多选)', ja: 'クリックまたは動画をドロップ(複数可)', es: 'Haz clic o suelta vídeos', de: 'Klicken oder Videos ablegen', fr: 'Cliquez ou déposez des vidéos' },
  'videoMerge.processing': { en: 'Merging…', zh: '拼接中…', ja: '結合中…', es: 'Fusionando…', de: 'Zusammenführen…', fr: 'Fusion…' },
  'videoMerge.download': { en: 'Download', zh: '下载', ja: 'ダウンロード', es: 'Descargar', de: 'Herunterladen', fr: 'Télécharger' },
  'videoMerge.retry': { en: 'Try again', zh: '重新开始', ja: 'やり直す', es: 'Empezar de nuevo', de: 'Von vorn beginnen', fr: 'Recommencer' },

  // ─── Video To GIF ────────────────────────────────────────
  'videoToGif.title': { en: 'Video to GIF', zh: '视频转 GIF', ja: '動画から GIF', es: 'Vídeo a GIF', de: 'Video zu GIF', fr: 'Vidéo en GIF' },
  'videoToGif.subtitle': { en: 'Drop video → convert to GIF', zh: '拖入视频 → 转为 GIF', ja: '動画をドロップ → GIF に変換', es: 'Suelta vídeo → convertir a GIF', de: 'Video ablegen → zu GIF konvertieren', fr: 'Déposez la vidéo → convertir en GIF' },
  'videoToGif.presetStandard': { en: 'Standard', zh: '标准', ja: '標準', es: 'Estándar', de: 'Standard', fr: 'Standard' },
  'videoToGif.presetHigh': { en: 'High Quality', zh: '高质量', ja: '高品質', es: 'Alta calidad', de: 'Hohe Qualität', fr: 'Haute qualité' },
  'videoToGif.dropHint': { en: 'Click or drop video', zh: '点击或拖入视频', ja: 'クリックまたは動画をドロップ', es: 'Haz clic o suelta un vídeo', de: 'Klicken oder Video ablegen', fr: 'Cliquez ou déposez une vidéo' },
  'videoToGif.processing': { en: 'Converting to GIF…', zh: '转换 GIF 中…', ja: 'GIF に変換中…', es: 'Convirtiendo a GIF…', de: 'Zu GIF konvertieren…', fr: 'Conversion en GIF…' },
  'videoToGif.download': { en: 'Download', zh: '下载', ja: 'ダウンロード', es: 'Descargar', de: 'Herunterladen', fr: 'Télécharger' },
  'videoToGif.retry': { en: 'Try another', zh: '再试一个', ja: 'もう一つ', es: 'Probar otro', de: 'Ein anderes probieren', fr: 'Essayer une autre' },

  // ─── Video Screenshot ────────────────────────────────────
  'videoScreenshot.title': { en: 'Video Screenshot', zh: '视频截图', ja: '動画スクリーンショット', es: 'Captura de vídeo', de: 'Video-Screenshot', fr: 'Capture vidéo' },
  'videoScreenshot.subtitle': { en: 'Drop video → capture frame', zh: '拖入视频 → 截取帧', ja: '動画をドロップ → フレームをキャプチャ', es: 'Suelta vídeo → capturar fotograma', de: 'Video ablegen → Frame erfassen', fr: 'Déposez la vidéo → capturer une image' },
  'videoScreenshot.presetFirst': { en: 'First frame', zh: '首帧', ja: '最初のフレーム', es: 'Primer fotograma', de: 'Erstes Bild', fr: 'Première image' },
  'videoScreenshot.presetMiddle': { en: 'Middle', zh: '中间帧', ja: '中間フレーム', es: 'Fotograma central', de: 'Mittleres Bild', fr: 'Image du milieu' },
  'videoScreenshot.presetCustom': { en: 'Custom time', zh: '自定义时间', ja: 'カスタム時間', es: 'Tiempo personalizado', de: 'Benutzerdefinierte Zeit', fr: 'Temps personnalisé' },
  'videoScreenshot.dropHint': { en: 'Click or drop video', zh: '点击或拖入视频', ja: 'クリックまたは動画をドロップ', es: 'Haz clic o suelta un vídeo', de: 'Klicken oder Video ablegen', fr: 'Cliquez ou déposez une vidéo' },
  'videoScreenshot.timeLabel': { en: 'Time (s)', zh: '时间(秒)', ja: '時間(秒)', es: 'Tiempo (s)', de: 'Zeit (s)', fr: 'Temps (s)' },
  'videoScreenshot.processing': { en: 'Capturing…', zh: '截图中…', ja: 'キャプチャ中…', es: 'Capturando…', de: 'Erfassen…', fr: 'Capture…' },
  'videoScreenshot.download': { en: 'Download', zh: '下载', ja: 'ダウンロード', es: 'Descargar', de: 'Herunterladen', fr: 'Télécharger' },
  'videoScreenshot.retry': { en: 'Try another', zh: '再试一个', ja: 'もう一つ', es: 'Probar otro', de: 'Ein anderes probieren', fr: 'Essayer une autre' },

  // ─── Video Extract Audio ─────────────────────────────────
  'videoExtractAudio.title': { en: 'Extract Audio', zh: '提取音频', ja: '音声抽出', es: 'Extraer audio', de: 'Audio extrahieren', fr: 'Extraire l\'audio' },
  'videoExtractAudio.subtitle': { en: 'Drop video → extract audio track', zh: '拖入视频 → 提取音轨', ja: '動画をドロップ → 音声を抽出', es: 'Suelta vídeo → extraer pista de audio', de: 'Video ablegen → Audiospur extrahieren', fr: 'Déposez la vidéo → extraire la piste audio' },
  'videoExtractAudio.presetMp3': { en: 'MP3', zh: 'MP3', ja: 'MP3', es: 'MP3', de: 'MP3', fr: 'MP3' },
  'videoExtractAudio.presetWav': { en: 'WAV', zh: 'WAV', ja: 'WAV', es: 'WAV', de: 'WAV', fr: 'WAV' },
  'videoExtractAudio.presetAac': { en: 'AAC', zh: 'AAC', ja: 'AAC', es: 'AAC', de: 'AAC', fr: 'AAC' },
  'videoExtractAudio.dropHint': { en: 'Click or drop video', zh: '点击或拖入视频', ja: 'クリックまたは動画をドロップ', es: 'Haz clic o suelta un vídeo', de: 'Klicken oder Video ablegen', fr: 'Cliquez ou déposez une vidéo' },
  'videoExtractAudio.processing': { en: 'Extracting audio…', zh: '提取音频中…', ja: '音声抽出中…', es: 'Extrayendo audio…', de: 'Audio extrahieren…', fr: 'Extraction audio…' },
  'videoExtractAudio.download': { en: 'Download', zh: '下载', ja: 'ダウンロード', es: 'Descargar', de: 'Herunterladen', fr: 'Télécharger' },
  'videoExtractAudio.retry': { en: 'Try another', zh: '再试一个', ja: 'もう一つ', es: 'Probar otro', de: 'Ein anderes probieren', fr: 'Essayer une autre' },

  // ─── Common / ErrorBoundary ──────────────────────────────
  'common.retry': { en: 'Retry', zh: '重试', ja: '再試行', es: 'Reintentar', de: 'Erneut versuchen', fr: 'Réessayer' },
  'common.dropVideo': { en: 'Click or drop video', zh: '点击或拖入视频', ja: 'クリックまたは動画をドロップ', es: 'Haz clic o suelta un vídeo', de: 'Klicken oder Video ablegen', fr: 'Cliquez ou déposez une vidéo' },
  'error.title': { en: 'Page Error', zh: '页面出错了', ja: 'ページエラーが発生しました', es: 'Error de página', de: 'Seitenfehler', fr: 'Erreur de page' },
  'error.logged': { en: 'Error has been logged.', zh: '错误已记录。', ja: 'エラーが記録されました。', es: 'El error ha sido registrado.', de: 'Der Fehler wurde protokolliert.', fr: "L'erreur a été enregistrée." },
  'error.retryHint': { en: ' Refresh the page or click the button below to retry.', zh: '刷新页面或点击下方按钮重试。', ja: ' ページを更新するか、下のボタンをクリックして再試行してください。', es: ' Actualiza la página o haz clic en el botón siguiente para reintentar.', de: ' Aktualisiere die Seite oder klicke auf die Schaltfläche unten, um es erneut zu versuchen.', fr: ' Actualise la page ou clique sur le bouton ci-dessous pour réessayer.' },
  'error.retryExceeded': { en: ' Please refresh the page and try again.', zh: '请刷新页面后重试。', ja: ' ページを更新して再度お試しください。', es: ' Por favor, actualiza la página e inténtalo de nuevo.', de: ' Bitte aktualisiere die Seite und versuche es erneut.', fr: ' Veuillez actualiser la page et réessayer.' },
};
