/**
 * @lokvis/ui-react UI 翻译字典。
 *
 * key 命名：`<组件/域>.<字段>` 两段式小驼峰（与 embed-image 模式一致，
 * 命名空间独立，不与 embed-* 字典合并）。
 *
 * en 为默认语言：不传 locale 时 UI 与历史版本英文文案保持一致。
 * `{name}` 为插值占位符（由 i18n/utils.ts 的 interpolate 处理）。
 * 复数场景使用 `*One` / `*Other` 双 key（en 需要 '1 step' / '2 steps' 区分）。
 */
import type { Language } from './config.js';

export type TranslationEntry = Record<Language, string>;

export const ui: Record<string, TranslationEntry> = {
  // ============ store 状态消息（statusMessage，key + params） ============
  'status.idle': {
    en: 'Idle', zh: '空闲', ja: '待機中', es: 'Inactivo', de: 'Bereit', fr: 'Inactif',
  },
  'status.ready': {
    en: 'Ready', zh: '就绪', ja: '準備完了', es: 'Listo', de: 'Einsatzbereit', fr: 'Prêt',
  },
  'status.importing': {
    en: 'Importing {count} file(s)...', zh: '正在导入 {count} 个文件...', ja: '{count} 個のファイルをインポート中...', es: 'Importando {count} archivo(s)...', de: '{count} Datei(en) werden importiert...', fr: 'Importation de {count} fichier(s)...',
  },
  'status.imported': {
    en: 'Imported {count} file(s)', zh: '已导入 {count} 个文件', ja: '{count} 個のファイルをインポートしました', es: '{count} archivo(s) importado(s)', de: '{count} Datei(en) importiert', fr: '{count} fichier(s) importé(s)',
  },
  'status.cancelling': {
    en: 'Cancelling...', zh: '正在取消...', ja: 'キャンセル中...', es: 'Cancelando...', de: 'Wird abgebrochen...', fr: 'Annulation...',
  },
  'status.running': {
    en: 'Running...', zh: '运行中...', ja: '実行中...', es: 'Ejecutando...', de: 'Läuft...', fr: 'Exécution...',
  },
  'status.runningWorkflow': {
    en: 'Running workflow...', zh: '正在运行工作流...', ja: 'ワークフローを実行中...', es: 'Ejecutando flujo de trabajo...', de: 'Workflow läuft...', fr: 'Exécution du flux de travail...',
  },
  'status.workflowCompleted': {
    en: 'Workflow completed in {duration}ms', zh: '工作流完成，耗时 {duration}ms', ja: 'ワークフローが {duration}ms で完了しました', es: 'Flujo de trabajo completado en {duration}ms', de: 'Workflow in {duration}ms abgeschlossen', fr: 'Flux de travail terminé en {duration}ms',
  },
  'status.workflowFailed': {
    en: 'Workflow failed in {duration}ms', zh: '工作流失败，耗时 {duration}ms', ja: 'ワークフローが {duration}ms で失敗しました', es: 'Flujo de trabajo falló en {duration}ms', de: 'Workflow nach {duration}ms fehlgeschlagen', fr: 'Échec du flux de travail en {duration}ms',
  },
  'status.workflowCancelled': {
    en: 'Workflow cancelled in {duration}ms', zh: '工作流已取消，耗时 {duration}ms', ja: 'ワークフローが {duration}ms でキャンセルされました', es: 'Flujo de trabajo cancelado en {duration}ms', de: 'Workflow nach {duration}ms abgebrochen', fr: 'Flux de travail annulé en {duration}ms',
  },
  'status.failed': {
    en: 'Failed', zh: '失败', ja: '失敗', es: 'Falló', de: 'Fehlgeschlagen', fr: 'Échec',
  },
  'status.packaging': {
    en: 'Packaging outputs...', zh: '正在打包输出...', ja: '出力をパッケージ中...', es: 'Empaquetando salidas...', de: 'Ausgaben werden verpackt...', fr: 'Empaquetage des sorties...',
  },
  'status.downloadsComplete': {
    en: 'Downloads complete', zh: '下载完成', ja: 'ダウンロード完了', es: 'Descargas completadas', de: 'Downloads abgeschlossen', fr: 'Téléchargements terminés',
  },
  'status.rejectedFiles': {
    en: 'Rejected {count} file(s) — unsupported type', zh: '已拒绝 {count} 个文件 — 不支持的类型', ja: '{count} 個のファイルを拒否しました — 未対応の形式', es: '{count} archivo(s) rechazado(s) — tipo no compatible', de: '{count} Datei(en) abgelehnt — nicht unterstützter Typ', fr: '{count} fichier(s) rejeté(s) — type non pris en charge',
  },

  // ============ store 错误消息（error，key + params） ============
  'error.maxSteps': {
    en: 'Workflow supports at most {max} steps (M1 MVP limit) — remove unneeded steps first', zh: '工作流最多 {max} 个节点(M1 MVP 限制),请先删除不需要的节点', ja: 'ワークフローは最大 {max} ステップまでです（M1 MVP 制限）。不要なステップを削除してください', es: 'El flujo de trabajo admite como máximo {max} pasos (límite M1 MVP): elimine primero los pasos innecesarios', de: 'Workflow unterstützt maximal {max} Schritte (M1-MVP-Limit) — entfernen Sie zuerst nicht benötigte Schritte', fr: 'Le flux de travail accepte au plus {max} étapes (limite M1 MVP) — supprimez d\'abord les étapes inutiles',
  },
  'error.cancelFailed': {
    en: 'Cancel failed, workflow still running: {message}', zh: '取消失败,工作流仍在运行:{message}', ja: 'キャンセルに失敗しました。ワークフローは実行中です：{message}', es: 'Error al cancelar, el flujo de trabajo sigue en ejecución: {message}', de: 'Abbruch fehlgeschlagen, Workflow läuft noch: {message}', fr: 'Échec de l\'annulation, le flux de travail est toujours en cours : {message}',
  },
  'error.outputsLoadFailed': {
    en: '{count} output asset(s) failed to load — storage may be corrupted', zh: '{count} 个输出资产加载失败,可能存储损坏', ja: '{count} 個の出力アセットの読み込みに失敗しました。ストレージが破損している可能性があります', es: 'No se pudieron cargar {count} recurso(s) de salida: el almacenamiento puede estar dañado', de: '{count} Ausgabe-Asset(s) konnten nicht geladen werden — Speicher möglicherweise beschädigt', fr: 'Échec du chargement de {count} ressource(s) de sortie — le stockage est peut-être corrompu',
  },
  'error.workflowFailed': {
    en: 'Workflow failed', zh: '工作流执行失败', ja: 'ワークフローが失敗しました', es: 'El flujo de trabajo falló', de: 'Workflow fehlgeschlagen', fr: 'Échec du flux de travail',
  },
  'error.workflowSaveLimit': {
    en: 'Workflow slot limit reached ({limit})', zh: '工作流槽位已达上限({limit} 个)', ja: 'ワークフロースロットが上限に達しました（{limit} 個）', es: 'Se alcanzó el límite de espacios de flujo de trabajo ({limit})', de: 'Workflow-Slot-Limit erreicht ({limit})', fr: 'Limite d\'emplacements de flux de travail atteinte ({limit})',
  },
  'error.workflowSaveLimitUpgrade': {
    en: 'Workflow slot limit reached ({limit}), upgrade to Pro for unlimited saves', zh: '工作流槽位已达上限({limit} 个),升级 Pro 可无限制保存', ja: 'ワークフロースロットが上限に達しました（{limit} 個)。Pro にアップグレードすると無制限に保存できます', es: 'Se alcanzó el límite de espacios de flujo de trabajo ({limit}); actualice a Pro para guardar sin límites', de: 'Workflow-Slot-Limit erreicht ({limit}); auf Pro upgraden für unbegrenztes Speichern', fr: 'Limite d\'emplacements de flux de travail atteinte ({limit}) ; passez à Pro pour un enregistrement illimité',
  },
  'error.workflowImportParse': {
    en: 'Invalid JSON, unable to parse', zh: 'JSON 格式错误,无法解析', ja: 'JSON の形式が不正で解析できません', es: 'JSON no válido, no se puede analizar', de: 'Ungültiges JSON, kann nicht geparst werden', fr: 'JSON invalide, impossible à analyser',
  },
  'error.workflowImportLimit': {
    en: 'Import would exceed the limit ({limit}); {imported} imported, please delete some workflows first', zh: '导入会超过上限({limit} 个),已导入 {imported} 条,请先删除部分工作流', ja: 'インポートすると上限（{limit} 個)を超えます。{imported} 件インポート済み、先にワークフローを削除してください', es: 'La importación superaría el límite ({limit}); {imported} importados, elimine primero algunos flujos de trabajo', de: 'Import würde das Limit überschreiten ({limit}); {imported} importiert, bitte zuerst einige Workflows löschen', fr: 'L\'importation dépasserait la limite ({limit}) ; {imported} importés, supprimez d\'abord des flux de travail',
  },
  'error.workflowImportEmpty': {
    en: 'No valid workflow definition in JSON', zh: 'JSON 中没有有效的工作流定义', ja: 'JSON に有効なワークフロー定義がありません', es: 'No hay una definición de flujo de trabajo válida en el JSON', de: 'Keine gültige Workflow-Definition im JSON', fr: 'Aucune définition de flux de travail valide dans le JSON',
  },
  'error.presetInvalidSize': {
    en: 'Preset dimensions must be positive numbers', zh: '预设尺寸必须为正数', ja: 'プリセットの寸法は正の数である必要があります', es: 'Las dimensiones del preajuste deben ser números positivos', de: 'Preset-Abmessungen müssen positive Zahlen sein', fr: 'Les dimensions du préréglage doivent être des nombres positifs',
  },
  'error.presetEmptyName': {
    en: 'Preset name cannot be empty', zh: '预设名称不能为空', ja: 'プリセット名を空にすることはできません', es: 'El nombre del preajuste no puede estar vacío', de: 'Preset-Name darf nicht leer sein', fr: 'Le nom du préréglage ne peut pas être vide',
  },
  'error.presetSaveLimit': {
    en: 'Custom preset limit reached ({limit})', zh: '自定义预设已达上限({limit} 个)', ja: 'カスタムプリセットが上限に達しました（{limit} 個）', es: 'Se alcanzó el límite de preajustes personalizados ({limit})', de: 'Limit für benutzerdefinierte Presets erreicht ({limit})', fr: 'Limite de préréglages personnalisés atteinte ({limit})',
  },
  'error.presetSaveLimitUpgrade': {
    en: 'Custom preset limit reached ({limit}), upgrade to Pro for unlimited saves', zh: '自定义预设已达上限({limit} 个),升级 Pro 可无限制保存', ja: 'カスタムプリセットが上限に達しました（{limit} 個)。Pro にアップグレードすると無制限に保存できます', es: 'Se alcanzó el límite de preajustes personalizados ({limit}); actualice a Pro para guardar sin límites', de: 'Limit für benutzerdefinierte Presets erreicht ({limit}); auf Pro upgraden für unbegrenztes Speichern', fr: 'Limite de préréglages personnalisés atteinte ({limit}) ; passez à Pro pour un enregistrement illimité',
  },

  // ============ AssetPanel ============
  'assetPanel.title': {
    en: 'Assets', zh: '资产', ja: 'アセット', es: 'Recursos', de: 'Assets', fr: 'Ressources',
  },
  'assetPanel.addFiles': {
    en: 'Add files', zh: '添加文件', ja: 'ファイルを追加', es: 'Añadir archivos', de: 'Dateien hinzufügen', fr: 'Ajouter des fichiers',
  },
  'assetPanel.dropHere': {
    en: 'Drop here', zh: '拖放到此处', ja: 'ここにドロップ', es: 'Suelta aquí', de: 'Hier ablegen', fr: 'Déposez ici',
  },
  'assetPanel.filterByType': {
    en: 'Filter by type', zh: '按类型筛选', ja: '種類で絞り込み', es: 'Filtrar por tipo', de: 'Nach Typ filtern', fr: 'Filtrer par type',
  },
  'assetPanel.all': {
    en: 'All', zh: '全部', ja: 'すべて', es: 'Todos', de: 'Alle', fr: 'Tous',
  },
  'assetPanel.filterPlaceholder': {
    en: 'Filter by type...', zh: '按类型筛选...', ja: '種類で絞り込み...', es: 'Filtrar por tipo...', de: 'Nach Typ filtern...', fr: 'Filtrer par type...',
  },
  'assetPanel.filterAria': {
    en: 'Filter assets by format', zh: '按格式筛选资产', ja: '形式でアセットを絞り込み', es: 'Filtrar recursos por formato', de: 'Assets nach Format filtern', fr: 'Filtrer les ressources par format',
  },
  'assetPanel.empty': {
    en: 'No assets imported', zh: '尚未导入资产', ja: 'アセットがありません', es: 'No hay recursos importados', de: 'Keine Assets importiert', fr: 'Aucune ressource importée',
  },
  'assetPanel.noMatch': {
    en: 'No assets match filter', zh: '没有匹配筛选条件的资产', ja: '条件に一致するアセットがありません', es: 'Ningún recurso coincide con el filtro', de: 'Keine Assets entsprechen dem Filter', fr: 'Aucune ressource ne correspond au filtre',
  },
  'assetPanel.selectAsset': {
    en: 'Select asset {format}', zh: '选择资产 {format}', ja: 'アセット {format} を選択', es: 'Seleccionar recurso {format}', de: 'Asset {format} auswählen', fr: 'Sélectionner la ressource {format}',
  },
  'assetPanel.removeAsset': {
    en: 'Remove asset {format}', zh: '删除资产 {format}', ja: 'アセット {format} を削除', es: 'Eliminar recurso {format}', de: 'Asset {format} entfernen', fr: 'Supprimer la ressource {format}',
  },
  'assetPanel.typeImage': {
    en: 'Image', zh: '图片', ja: '画像', es: 'Imagen', de: 'Bild', fr: 'Image',
  },
  'assetPanel.typeVideo': {
    en: 'Video', zh: '视频', ja: '動画', es: 'Vídeo', de: 'Video', fr: 'Vidéo',
  },
  'assetPanel.typeAudio': {
    en: 'Audio', zh: '音频', ja: '音声', es: 'Audio', de: 'Audio', fr: 'Audio',
  },
  'assetPanel.typePdf': {
    en: 'PDF', zh: 'PDF', ja: 'PDF', es: 'PDF', de: 'PDF', fr: 'PDF',
  },
  'assetPanel.typeText': {
    en: 'Text', zh: '文本', ja: 'テキスト', es: 'Texto', de: 'Text', fr: 'Texte',
  },
  'assetPanel.typeData': {
    en: 'Data', zh: '数据', ja: 'データ', es: 'Datos', de: 'Daten', fr: 'Données',
  },
  'assetPanel.typeOther': {
    en: 'Other', zh: '其他', ja: 'その他', es: 'Otro', de: 'Sonstiges', fr: 'Autre',
  },

  // ============ Canvas ============
  'canvas.compareModeAria': {
    en: 'Compare mode toggle', zh: '对比模式切换', ja: '比較モード切替', es: 'Alternar modo de comparación', de: 'Vergleichsmodus umschalten', fr: 'Basculer le mode comparaison',
  },
  'canvas.single': {
    en: 'Single', zh: '单图', ja: '単一', es: 'Individual', de: 'Einzeln', fr: 'Simple',
  },
  'canvas.compare': {
    en: 'Compare', zh: '对比', ja: '比較', es: 'Comparar', de: 'Vergleichen', fr: 'Comparer',
  },
  'canvas.dropToImport': {
    en: 'Drop files to import', zh: '拖放文件以导入', ja: 'ファイルをドロップしてインポート', es: 'Suelta archivos para importar', de: 'Dateien zum Importieren ablegen', fr: 'Déposez des fichiers pour importer',
  },
  'canvas.loadingPreview': {
    en: 'Loading preview...', zh: '正在加载预览...', ja: 'プレビューを読み込み中...', es: 'Cargando vista previa...', de: 'Vorschau wird geladen...', fr: 'Chargement de l\'aperçu...',
  },
  'canvas.noAsset': {
    en: 'No asset selected', zh: '未选择资产', ja: 'アセットが選択されていません', es: 'Ningún recurso seleccionado', de: 'Kein Asset ausgewählt', fr: 'Aucune ressource sélectionnée',
  },
  'canvas.emptyHintImport': {
    en: 'Import files to get started, or drag them here', zh: '导入文件开始使用，或将文件拖到此处', ja: 'ファイルをインポートするか、ここにドラッグしてください', es: 'Importa archivos para empezar o arrástralos aquí', de: 'Importieren Sie Dateien oder ziehen Sie sie hierher', fr: 'Importez des fichiers pour commencer ou glissez-les ici',
  },
  'canvas.emptyHintSelect': {
    en: 'Select an asset from the left panel', zh: '从左侧面板选择一个资产', ja: '左パネルからアセットを選択してください', es: 'Selecciona un recurso del panel izquierdo', de: 'Wählen Sie ein Asset im linken Bereich', fr: 'Sélectionnez une ressource dans le panneau de gauche',
  },
  'canvas.importFiles': {
    en: 'Import Files', zh: '导入文件', ja: 'ファイルをインポート', es: 'Importar archivos', de: 'Dateien importieren', fr: 'Importer des fichiers',
  },

  // ============ CommandPalette ============
  'commandPalette.undo': {
    en: 'Undo', zh: '撤销', ja: '元に戻す', es: 'Deshacer', de: 'Rückgängig', fr: 'Annuler',
  },
  'commandPalette.undoDesc': {
    en: 'Undo the last history step', zh: '回退到上一步历史', ja: '直前の履歴に戻す', es: 'Deshacer el último paso del historial', de: 'Letzten Verlaufsschritt rückgängig machen', fr: 'Annuler la dernière étape de l\'historique',
  },
  'commandPalette.redo': {
    en: 'Redo', zh: '重做', ja: 'やり直す', es: 'Rehacer', de: 'Wiederholen', fr: 'Rétablir',
  },
  'commandPalette.redoDesc': {
    en: 'Redo one step', zh: '重做一步', ja: '一手順やり直す', es: 'Rehacer un paso', de: 'Einen Schritt wiederholen', fr: 'Rétablir une étape',
  },
  'commandPalette.clearWorkflow': {
    en: 'Clear Workflow', zh: '清空工作流', ja: 'ワークフローをクリア', es: 'Limpiar flujo de trabajo', de: 'Workflow leeren', fr: 'Effacer le flux de travail',
  },
  'commandPalette.clearWorkflowDesc': {
    en: 'Remove all workflow nodes', zh: '清空当前工作流节点', ja: '現在のワークフローノードをすべて削除', es: 'Eliminar todos los nodos del flujo de trabajo', de: 'Alle Workflow-Knoten entfernen', fr: 'Supprimer tous les nœuds du flux de travail',
  },
  'commandPalette.searchPlaceholder': {
    en: 'Search commands or capabilities...', zh: '搜索命令或能力...', ja: 'コマンドまたは機能を検索...', es: 'Buscar comandos o capacidades...', de: 'Befehle oder Fähigkeiten suchen...', fr: 'Rechercher des commandes ou des capacités...',
  },
  'commandPalette.searchAria': {
    en: 'Search commands', zh: '搜索命令', ja: 'コマンドを検索', es: 'Buscar comandos', de: 'Befehle suchen', fr: 'Rechercher des commandes',
  },
  'commandPalette.commandsAria': {
    en: 'Available commands', zh: '可用命令', ja: '利用可能なコマンド', es: 'Comandos disponibles', de: 'Verfügbare Befehle', fr: 'Commandes disponibles',
  },
  'commandPalette.noMatch': {
    en: 'No matching commands', zh: '无匹配命令', ja: '一致するコマンドがありません', es: 'No hay comandos coincidentes', de: 'Keine passenden Befehle', fr: 'Aucune commande correspondante',
  },
  'commandPalette.navigate': {
    en: 'navigate', zh: '导航', ja: '移動', es: 'navegar', de: 'navigieren', fr: 'naviguer',
  },
  'commandPalette.select': {
    en: 'select', zh: '选择', ja: '選択', es: 'seleccionar', de: 'auswählen', fr: 'sélectionner',
  },
  'commandPalette.commandCountOne': {
    en: '{count} command', zh: '{count} 条命令', ja: '{count} 件のコマンド', es: '{count} comando', de: '{count} Befehl', fr: '{count} commande',
  },
  'commandPalette.commandCountOther': {
    en: '{count} commands', zh: '{count} 条命令', ja: '{count} 件のコマンド', es: '{count} comandos', de: '{count} Befehle', fr: '{count} commandes',
  },

  // ============ CompareSlider ============
  'compareSlider.sliderAria': {
    en: 'Before/after comparison slider', zh: '前后对比滑块', ja: '前後比較スライダー', es: 'Control deslizante de comparación antes/después', de: 'Vorher/Nachher-Vergleichsregler', fr: 'Curseur de comparaison avant/après',
  },
  'compareSlider.before': {
    en: 'Before', zh: '处理前', ja: '処理前', es: 'Antes', de: 'Vorher', fr: 'Avant',
  },
  'compareSlider.after': {
    en: 'After', zh: '处理后', ja: '処理後', es: 'Después', de: 'Nachher', fr: 'Après',
  },
  'compareSlider.positionAria': {
    en: 'Comparison slider position', zh: '对比滑块位置', ja: '比較スライダーの位置', es: 'Posición del control deslizante de comparación', de: 'Position des Vergleichsreglers', fr: 'Position du curseur de comparaison',
  },

  // ============ DownloadPanel ============
  'downloadPanel.panelAria': {
    en: 'Outputs panel', zh: '输出面板', ja: '出力パネル', es: 'Panel de salidas', de: 'Ausgabebereich', fr: 'Panneau des sorties',
  },
  'downloadPanel.title': {
    en: 'Outputs', zh: '输出', ja: '出力', es: 'Salidas', de: 'Ausgaben', fr: 'Sorties',
  },
  'downloadPanel.downloaded': {
    en: 'Downloaded', zh: '已下载', ja: 'ダウンロード済み', es: 'Descargado', de: 'Heruntergeladen', fr: 'Téléchargé',
  },
  'downloadPanel.download': {
    en: 'Download', zh: '下载', ja: 'ダウンロード', es: 'Descargar', de: 'Herunterladen', fr: 'Télécharger',
  },
  'downloadPanel.downloading': {
    en: 'Downloading...', zh: '下载中...', ja: 'ダウンロード中...', es: 'Descargando...', de: 'Wird heruntergeladen...', fr: 'Téléchargement...',
  },
  'downloadPanel.downloadAll': {
    en: 'Download All', zh: '全部下载', ja: 'すべてダウンロード', es: 'Descargar todo', de: 'Alle herunterladen', fr: 'Tout télécharger',
  },
  'downloadPanel.clear': {
    en: 'Clear', zh: '清空', ja: 'クリア', es: 'Limpiar', de: 'Leeren', fr: 'Effacer',
  },

  // ============ ErrorBanner ============
  'errorBanner.title': {
    en: 'Execution error', zh: '执行出错', ja: '実行エラー', es: 'Error de ejecución', de: 'Ausführungsfehler', fr: 'Erreur d\'exécution',
  },
  'errorBanner.retry': {
    en: 'Retry', zh: '重试', ja: '再試行', es: 'Reintentar', de: 'Erneut versuchen', fr: 'Réessayer',
  },
  'errorBanner.dismissAria': {
    en: 'Dismiss error', zh: '关闭错误信息', ja: 'エラーを閉じる', es: 'Descartar error', de: 'Fehler schließen', fr: 'Fermer l\'erreur',
  },

  // ============ ErrorBoundary ============
  'errorBoundary.title': {
    en: 'Something went wrong', zh: '出错了', ja: '問題が発生しました', es: 'Algo salió mal', de: 'Etwas ist schiefgelaufen', fr: 'Une erreur est survenue',
  },
  'errorBoundary.description': {
    en: 'An unexpected error occurred while rendering this panel.', zh: '渲染此面板时发生意外错误。', ja: 'このパネルの描画中に予期しないエラーが発生しました。', es: 'Se produjo un error inesperado al renderizar este panel.', de: 'Beim Rendern dieses Bereichs ist ein unerwarteter Fehler aufgetreten.', fr: 'Une erreur inattendue s\'est produite lors du rendu de ce panneau.',
  },
  'errorBoundary.retry': {
    en: 'Try again', zh: '重试', ja: '再試行', es: 'Intentar de nuevo', de: 'Erneut versuchen', fr: 'Réessayer',
  },

  // ============ ExifPanel ============
  'exifPanel.loading': {
    en: 'loading…', zh: '加载中…', ja: '読み込み中…', es: 'cargando…', de: 'lädt…', fr: 'chargement…',
  },
  'exifPanel.fieldsOne': {
    en: '{count} field', zh: '{count} 个字段', ja: '{count} 個のフィールド', es: '{count} campo', de: '{count} Feld', fr: '{count} champ',
  },
  'exifPanel.fieldsOther': {
    en: '{count} fields', zh: '{count} 个字段', ja: '{count} 個のフィールド', es: '{count} campos', de: '{count} Felder', fr: '{count} champs',
  },
  'exifPanel.error': {
    en: 'error', zh: '错误', ja: 'エラー', es: 'error', de: 'Fehler', fr: 'erreur',
  },
  'exifPanel.none': {
    en: 'none', zh: '无', ja: 'なし', es: 'ninguno', de: 'keine', fr: 'aucun',
  },
  'exifPanel.reading': {
    en: 'Reading EXIF…', zh: '正在读取 EXIF…', ja: 'EXIF を読み取り中…', es: 'Leyendo EXIF…', de: 'EXIF wird gelesen…', fr: 'Lecture EXIF…',
  },
  'exifPanel.noData': {
    en: 'No EXIF data', zh: '无 EXIF 数据', ja: 'EXIF データがありません', es: 'Sin datos EXIF', de: 'Keine EXIF-Daten', fr: 'Aucune donnée EXIF',
  },
  'exifPanel.noDataHint': {
    en: 'This image has no embedded metadata', zh: '此图片没有内嵌元数据', ja: 'この画像には埋め込みメタデータがありません', es: 'Esta imagen no tiene metadatos incrustados', de: 'Dieses Bild enthält keine eingebetteten Metadaten', fr: 'Cette image ne contient pas de métadonnées intégrées',
  },
  'exifPanel.readFailed': {
    en: 'Failed to read EXIF', zh: '读取 EXIF 失败', ja: 'EXIF の読み取りに失敗しました', es: 'Error al leer EXIF', de: 'EXIF konnte nicht gelesen werden', fr: 'Échec de la lecture EXIF',
  },

  // ============ GlobalDropzone ============
  'dropzone.unsupported': {
    en: 'Unsupported file type', zh: '不支持的文件类型', ja: '未対応のファイル形式', es: 'Tipo de archivo no compatible', de: 'Nicht unterstützter Dateityp', fr: 'Type de fichier non pris en charge',
  },
  'dropzone.accepted': {
    en: 'Accepted: {accept}', zh: '接受：{accept}', ja: '受け付け可能：{accept}', es: 'Aceptado: {accept}', de: 'Akzeptiert: {accept}', fr: 'Accepté : {accept}',
  },
  'dropzone.allFiles': {
    en: 'all files', zh: '所有文件', ja: 'すべてのファイル', es: 'todos los archivos', de: 'alle Dateien', fr: 'tous les fichiers',
  },
  'dropzone.dropToImport': {
    en: 'Drop files to import', zh: '拖放文件以导入', ja: 'ファイルをドロップしてインポート', es: 'Suelta archivos para importar', de: 'Dateien zum Importieren ablegen', fr: 'Déposez des fichiers pour importer',
  },
  'dropzone.localHint': {
    en: 'Files are processed locally in your browser', zh: '文件在您的浏览器本地处理', ja: 'ファイルはブラウザ内でローカルに処理されます', es: 'Los archivos se procesan localmente en tu navegador', de: 'Dateien werden lokal in Ihrem Browser verarbeitet', fr: 'Les fichiers sont traités localement dans votre navigateur',
  },

  // ============ HistoryPanel ============
  'historyPanel.undo': {
    en: 'Undo', zh: '撤销', ja: '元に戻す', es: 'Deshacer', de: 'Rückgängig', fr: 'Annuler',
  },
  'historyPanel.redo': {
    en: 'Redo', zh: '重做', ja: 'やり直す', es: 'Rehacer', de: 'Wiederholen', fr: 'Rétablir',
  },
  'historyPanel.title': {
    en: 'History', zh: '历史', ja: '履歴', es: 'Historial', de: 'Verlauf', fr: 'Historique',
  },
  'historyPanel.panelAria': {
    en: 'History panel', zh: '历史面板', ja: '履歴パネル', es: 'Panel de historial', de: 'Verlaufsbereich', fr: 'Panneau d\'historique',
  },
  'historyPanel.empty': {
    en: 'No history yet', zh: '暂无历史', ja: '履歴はまだありません', es: 'Aún no hay historial', de: 'Noch kein Verlauf', fr: 'Pas encore d\'historique',
  },
  'historyPanel.initial': {
    en: 'Initial', zh: '初始', ja: '初期状態', es: 'Inicial', de: 'Ausgangszustand', fr: 'Initial',
  },

  // ============ Inspector ============
  'inspector.configure': {
    en: 'Configure', zh: '配置', ja: '設定', es: 'Configurar', de: 'Konfigurieren', fr: 'Configurer',
  },
  'inspector.capabilities': {
    en: 'Capabilities', zh: '能力', ja: '機能', es: 'Capacidades', de: 'Fähigkeiten', fr: 'Capacités',
  },
  'inspector.searchPlaceholder': {
    en: 'Search capabilities...', zh: '搜索能力...', ja: '機能を検索...', es: 'Buscar capacidades...', de: 'Fähigkeiten suchen...', fr: 'Rechercher des capacités...',
  },
  'inspector.empty': {
    en: 'No capabilities loaded', zh: '未加载任何能力', ja: '機能が読み込まれていません', es: 'No hay capacidades cargadas', de: 'Keine Fähigkeiten geladen', fr: 'Aucune capacité chargée',
  },
  'inspector.emptyHint': {
    en: 'Load a plugin to get started', zh: '加载插件以开始使用', ja: 'プラグインを読み込んで開始してください', es: 'Carga un plugin para empezar', de: 'Laden Sie ein Plugin, um zu beginnen', fr: 'Chargez un plugin pour commencer',
  },
  'inspector.noMatch': {
    en: 'No matching capabilities', zh: '无匹配能力', ja: '一致する機能がありません', es: 'No hay capacidades coincidentes', de: 'Keine passenden Fähigkeiten', fr: 'Aucune capacité correspondante',
  },
  'inspector.comingSoon': {
    en: 'Coming soon — no engine installed yet', zh: '即将推出 — 尚未安装引擎', ja: '近日公開 — エンジン未インストール', es: 'Próximamente: aún no hay motor instalado', de: 'Demnächst — noch kein Engine installiert', fr: 'Bientôt disponible — aucun moteur installé',
  },
  'inspector.soon': {
    en: 'Soon', zh: '即将', ja: '近日', es: 'Pronto', de: 'Bald', fr: 'Bientôt',
  },

  // ============ ParamForm ============
  'paramForm.noParams': {
    en: 'This capability has no configurable parameters.', zh: '此能力没有可配置的参数。', ja: 'この機能には設定可能なパラメータがありません。', es: 'Esta capacidad no tiene parámetros configurables.', de: 'Diese Fähigkeit hat keine konfigurierbaren Parameter.', fr: 'Cette capacité n\'a pas de paramètres configurables.',
  },
  'paramForm.filePlaceholder': {
    en: 'data URL or path', zh: 'data URL 或路径', ja: 'data URL またはパス', es: 'data URL o ruta', de: 'Data-URL oder Pfad', fr: 'data URL ou chemin',
  },

  // ============ PipelineBar ============
  'pipelineBar.title': {
    en: 'Pipeline', zh: '流水线', ja: 'パイプライン', es: 'Canalización', de: 'Pipeline', fr: 'Pipeline',
  },
  'pipelineBar.empty': {
    en: 'Empty — add capabilities from the right panel', zh: '空 — 从右侧面板添加能力', ja: '空 — 右パネルから機能を追加してください', es: 'Vacío: añade capacidades desde el panel derecho', de: 'Leer — fügen Sie Fähigkeiten aus dem rechten Bereich hinzu', fr: 'Vide — ajoutez des capacités depuis le panneau de droite',
  },
  'pipelineBar.source': {
    en: 'Source', zh: '源', ja: 'ソース', es: 'Origen', de: 'Quelle', fr: 'Source',
  },
  'pipelineBar.output': {
    en: 'Output', zh: '输出', ja: '出力', es: 'Salida', de: 'Ausgabe', fr: 'Sortie',
  },
  'pipelineBar.nodeAria': {
    en: 'Step {capability}, position {position}, press Delete to remove', zh: '节点 {capability},位置 {position},Delete 删除', ja: 'ステップ {capability}、位置 {position}、Delete で削除', es: 'Paso {capability}, posición {position}, pulsa Supr para eliminar', de: 'Schritt {capability}, Position {position}, Entf zum Entfernen', fr: 'Étape {capability}, position {position}, Suppr pour supprimer',
  },
  'pipelineBar.removeStep': {
    en: 'Remove step', zh: '删除步骤', ja: 'ステップを削除', es: 'Eliminar paso', de: 'Schritt entfernen', fr: 'Supprimer l\'étape',
  },
  'pipelineBar.stepCountOne': {
    en: '{count} step', zh: '{count} 步', ja: '{count} ステップ', es: '{count} paso', de: '{count} Schritt', fr: '{count} étape',
  },
  'pipelineBar.stepCountOther': {
    en: '{count} steps', zh: '{count} 步', ja: '{count} ステップ', es: '{count} pasos', de: '{count} Schritte', fr: '{count} étapes',
  },

  // ============ ProgressBar ============
  'progressBar.progressAria': {
    en: 'Workflow progress: {done} / {total}', zh: '工作流进度:{done} / {total}', ja: 'ワークフロー進捗：{done} / {total}', es: 'Progreso del flujo de trabajo: {done} / {total}', de: 'Workflow-Fortschritt: {done} / {total}', fr: 'Progression du flux de travail : {done} / {total}',
  },
  'progressBar.failedCount': {
    en: '({count} failed)', zh: '（{count} 个失败）', ja: '（{count} 件失敗）', es: '({count} fallidos)', de: '({count} fehlgeschlagen)', fr: '({count} en échec)',
  },
  'progressBar.cancelAria': {
    en: 'Cancel run', zh: '取消运行', ja: '実行をキャンセル', es: 'Cancelar ejecución', de: 'Ausführung abbrechen', fr: 'Annuler l\'exécution',
  },
  'progressBar.cancel': {
    en: 'Cancel', zh: '取消', ja: 'キャンセル', es: 'Cancelar', de: 'Abbrechen', fr: 'Annuler',
  },
  'progressBar.failed': {
    en: 'Failed', zh: '失败', ja: '失敗', es: 'Falló', de: 'Fehlgeschlagen', fr: 'Échec',
  },
  'progressBar.done': {
    en: 'Done', zh: '完成', ja: '完了', es: 'Hecho', de: 'Fertig', fr: 'Terminé',
  },

  // ============ StatusBar ============
  'statusBar.dismiss': {
    en: 'dismiss', zh: '关闭', ja: '閉じる', es: 'descartar', de: 'schließen', fr: 'fermer',
  },
  'statusBar.online': {
    en: 'Online', zh: '在线', ja: 'オンライン', es: 'En línea', de: 'Online', fr: 'En ligne',
  },
  'statusBar.offline': {
    en: 'Offline', zh: '离线', ja: 'オフライン', es: 'Sin conexión', de: 'Offline', fr: 'Hors ligne',
  },
  'statusBar.offlineTitle': {
    en: 'Offline — running locally, no upload needed', zh: '离线 — 本地运行，无需上传', ja: 'オフライン — ローカルで動作、アップロード不要', es: 'Sin conexión: funciona localmente, no requiere subida', de: 'Offline — läuft lokal, kein Upload nötig', fr: 'Hors ligne — fonctionne localement, aucun envoi requis',
  },
  'statusBar.offlineAria': {
    en: 'Offline — files still processed locally', zh: '离线 — 文件仍在本地处理', ja: 'オフライン — ファイルは引き続きローカルで処理されます', es: 'Sin conexión: los archivos se siguen procesando localmente', de: 'Offline — Dateien werden weiterhin lokal verarbeitet', fr: 'Hors ligne — les fichiers sont toujours traités localement',
  },
  'statusBar.storageCriticalTitle': {
    en: 'Storage almost full ({percent}%) — clean up to free space', zh: '存储空间即将用尽（{percent}%）— 请清理以释放空间', ja: 'ストレージがほぼ満杯です（{percent}%）— 整理して空き容量を確保してください', es: 'Almacenamiento casi lleno ({percent}%): libera espacio', de: 'Speicher fast voll ({percent}%) — Platz freigeben', fr: 'Stockage presque plein ({percent}%) — libérez de l\'espace',
  },
  'statusBar.storageWarningTitle': {
    en: 'Storage nearing limit ({percent}%)', zh: '存储空间接近上限（{percent}%）', ja: 'ストレージが上限に近づいています（{percent}%）', es: 'Almacenamiento cerca del límite ({percent}%)', de: 'Speicher nähert sich dem Limit ({percent}%)', fr: 'Stockage proche de la limite ({percent}%)',
  },
  'statusBar.storageTitle': {
    en: 'Storage: {used} of {quota}', zh: '存储：{used} / {quota}', ja: 'ストレージ：{used} / {quota}', es: 'Almacenamiento: {used} de {quota}', de: 'Speicher: {used} von {quota}', fr: 'Stockage : {used} sur {quota}',
  },
  'statusBar.storageCriticalAria': {
    en: 'Storage critical: {used} of {quota} used, {percent} percent. Clean up to free space.', zh: '存储告急：已用 {used} / {quota}，{percent}%。请清理以释放空间。', ja: 'ストレージ残量僅か：{quota} 中 {used} 使用、{percent}%。整理して空き容量を確保してください。', es: 'Almacenamiento crítico: {used} de {quota} usados, {percent} por ciento. Libera espacio.', de: 'Speicher kritisch: {used} von {quota} belegt, {percent} Prozent. Bitte Platz freigeben.', fr: 'Stockage critique : {used} sur {quota} utilisés, {percent} pour cent. Libérez de l\'espace.',
  },
  'statusBar.storageWarningAria': {
    en: 'Storage warning: {used} of {quota} used, {percent} percent.', zh: '存储警告：已用 {used} / {quota}，{percent}%。', ja: 'ストレージ警告：{quota} 中 {used} 使用、{percent}%。', es: 'Aviso de almacenamiento: {used} de {quota} usados, {percent} por ciento.', de: 'Speicherwarnung: {used} von {quota} belegt, {percent} Prozent.', fr: 'Avertissement de stockage : {used} sur {quota} utilisés, {percent} pour cent.',
  },
  'statusBar.storageAria': {
    en: 'Storage: {used} of {quota} used.', zh: '存储：已用 {used} / {quota}。', ja: 'ストレージ：{quota} 中 {used} 使用。', es: 'Almacenamiento: {used} de {quota} usados.', de: 'Speicher: {used} von {quota} belegt.', fr: 'Stockage : {used} sur {quota} utilisés.',
  },
  'statusBar.assetCountOne': {
    en: '{count} asset', zh: '{count} 个资产', ja: '{count} 個のアセット', es: '{count} recurso', de: '{count} Asset', fr: '{count} ressource',
  },
  'statusBar.assetCountOther': {
    en: '{count} assets', zh: '{count} 个资产', ja: '{count} 個のアセット', es: '{count} recursos', de: '{count} Assets', fr: '{count} ressources',
  },
  'statusBar.capCountOne': {
    en: '{count} cap', zh: '{count} 项能力', ja: '{count} 個の機能', es: '{count} capacidad', de: '{count} Fähigkeit', fr: '{count} capacité',
  },
  'statusBar.capCountOther': {
    en: '{count} caps', zh: '{count} 项能力', ja: '{count} 個の機能', es: '{count} capacidades', de: '{count} Fähigkeiten', fr: '{count} capacités',
  },
  'statusBar.stepCountOne': {
    en: '{count} step', zh: '{count} 步', ja: '{count} ステップ', es: '{count} paso', de: '{count} Schritt', fr: '{count} étape',
  },
  'statusBar.stepCountOther': {
    en: '{count} steps', zh: '{count} 步', ja: '{count} ステップ', es: '{count} pasos', de: '{count} Schritte', fr: '{count} étapes',
  },

  // ============ ThemeToggle ============
  'themeToggle.system': {
    en: 'System', zh: '跟随系统', ja: 'システム', es: 'Sistema', de: 'System', fr: 'Système',
  },
  'themeToggle.dark': {
    en: 'Dark', zh: '深色', ja: 'ダーク', es: 'Oscuro', de: 'Dunkel', fr: 'Sombre',
  },
  'themeToggle.light': {
    en: 'Light', zh: '浅色', ja: 'ライト', es: 'Claro', de: 'Hell', fr: 'Clair',
  },
  'themeToggle.ariaLabel': {
    en: 'Theme: {label}. Click to toggle, right-click for options.', zh: '主题：{label}。点击切换，右键查看选项。', ja: 'テーマ：{label}。クリックで切替、右クリックでオプション。', es: 'Tema: {label}. Haz clic para alternar, clic derecho para opciones.', de: 'Design: {label}. Klicken zum Umschalten, Rechtsklick für Optionen.', fr: 'Thème : {label}. Cliquez pour basculer, clic droit pour les options.',
  },
  'themeToggle.title': {
    en: 'Theme: {label} (right-click for options)', zh: '主题：{label}（右键查看选项）', ja: 'テーマ：{label}（右クリックでオプション）', es: 'Tema: {label} (clic derecho para opciones)', de: 'Design: {label} (Rechtsklick für Optionen)', fr: 'Thème : {label} (clic droit pour les options)',
  },

  // ============ Toolbar ============
  'toolbar.clear': {
    en: 'Clear', zh: '清空', ja: 'クリア', es: 'Limpiar', de: 'Leeren', fr: 'Effacer',
  },
  'toolbar.run': {
    en: 'Run', zh: '运行', ja: '実行', es: 'Ejecutar', de: 'Ausführen', fr: 'Exécuter',
  },

  // ============ ToolRunner ============
  'toolRunner.dropHint': {
    en: 'Drop file here or click to upload', zh: '拖放文件到此处或点击上传', ja: 'ここにファイルをドロップするかクリックしてアップロード', es: 'Suelta el archivo aquí o haz clic para subir', de: 'Datei hier ablegen oder klicken zum Hochladen', fr: 'Déposez le fichier ici ou cliquez pour téléverser',
  },
  'toolRunner.accepted': {
    en: 'Accepted: {accept}', zh: '接受：{accept}', ja: '受け付け可能：{accept}', es: 'Aceptado: {accept}', de: 'Akzeptiert: {accept}', fr: 'Accepté : {accept}',
  },
  'toolRunner.anyFile': {
    en: 'any file', zh: '任意文件', ja: '任意のファイル', es: 'cualquier archivo', de: 'beliebige Datei', fr: 'tout fichier',
  },
  'toolRunner.parameters': {
    en: 'Parameters', zh: '参数', ja: 'パラメータ', es: 'Parámetros', de: 'Parameter', fr: 'Paramètres',
  },
  'toolRunner.processing': {
    en: 'Processing...', zh: '处理中...', ja: '処理中...', es: 'Procesando...', de: 'Wird verarbeitet...', fr: 'Traitement...',
  },
  'toolRunner.process': {
    en: 'Process', zh: '处理', ja: '処理する', es: 'Procesar', de: 'Verarbeiten', fr: 'Traiter',
  },
  'toolRunner.changeFile': {
    en: 'Change file', zh: '更换文件', ja: 'ファイルを変更', es: 'Cambiar archivo', de: 'Datei ändern', fr: 'Changer de fichier',
  },
  'toolRunner.openInWorkspace': {
    en: 'Open in Workspace →', zh: '在工作台中打开 →', ja: 'ワークスペースで開く →', es: 'Abrir en el espacio de trabajo →', de: 'Im Workspace öffnen →', fr: 'Ouvrir dans l\'espace de travail →',
  },
  'toolRunner.cancel': {
    en: 'Cancel', zh: '取消', ja: 'キャンセル', es: 'Cancelar', de: 'Abbrechen', fr: 'Annuler',
  },
  'toolRunner.ready': {
    en: 'Ready to download', zh: '可以下载了', ja: 'ダウンロードの準備ができました', es: 'Listo para descargar', de: 'Bereit zum Herunterladen', fr: 'Prêt à télécharger',
  },
  'toolRunner.download': {
    en: 'Download', zh: '下载', ja: 'ダウンロード', es: 'Descargar', de: 'Herunterladen', fr: 'Télécharger',
  },
  'toolRunner.input': {
    en: 'Input', zh: '输入', ja: '入力', es: 'Entrada', de: 'Eingabe', fr: 'Entrée',
  },
  'toolRunner.output': {
    en: 'Output', zh: '输出', ja: '出力', es: 'Salida', de: 'Ausgabe', fr: 'Sortie',
  },
  'toolRunner.inputAlt': {
    en: 'Input preview', zh: '输入预览', ja: '入力プレビュー', es: 'Vista previa de entrada', de: 'Eingabevorschau', fr: 'Aperçu de l\'entrée',
  },
  'toolRunner.outputAlt': {
    en: 'Output preview', zh: '输出预览', ja: '出力プレビュー', es: 'Vista previa de salida', de: 'Ausgabevorschau', fr: 'Aperçu de la sortie',
  },

  // ============ WorkflowEditor ============
  'workflowEditor.editorAria': {
    en: 'Workflow editor', zh: '工作流编辑器', ja: 'ワークフローエディタ', es: 'Editor de flujo de trabajo', de: 'Workflow-Editor', fr: 'Éditeur de flux de travail',
  },
  'workflowEditor.title': {
    en: 'Workflow Editor', zh: '工作流编辑器', ja: 'ワークフローエディタ', es: 'Editor de flujo de trabajo', de: 'Workflow-Editor', fr: 'Éditeur de flux de travail',
  },
  'workflowEditor.clearAria': {
    en: 'Clear workflow', zh: '清空工作流', ja: 'ワークフローをクリア', es: 'Limpiar flujo de trabajo', de: 'Workflow leeren', fr: 'Effacer le flux de travail',
  },
  'workflowEditor.clear': {
    en: 'Clear', zh: '清空', ja: 'クリア', es: 'Limpiar', de: 'Leeren', fr: 'Effacer',
  },
  'workflowEditor.empty': {
    en: 'Empty workflow — click a capability in the right panel to add a step', zh: '空工作流 — 从右侧 Capabilities 面板点击添加节点', ja: '空のワークフロー — 右パネルの機能をクリックしてステップを追加', es: 'Flujo de trabajo vacío: haz clic en una capacidad del panel derecho para añadir un paso', de: 'Leerer Workflow — klicken Sie rechts auf eine Fähigkeit, um einen Schritt hinzuzufügen', fr: 'Flux de travail vide — cliquez sur une capacité dans le panneau de droite pour ajouter une étape',
  },
  'workflowEditor.source': {
    en: 'Source', zh: '源', ja: 'ソース', es: 'Origen', de: 'Quelle', fr: 'Source',
  },
  'workflowEditor.output': {
    en: 'Output', zh: '输出', ja: '出力', es: 'Salida', de: 'Ausgabe', fr: 'Sortie',
  },
  'workflowEditor.nodeAria': {
    en: 'Step {capability}, position {position}, drag or arrow keys to reorder, Delete to remove', zh: '节点 {capability},位置 {position},拖拽或方向键重排,Delete 删除', ja: 'ステップ {capability}、位置 {position}、ドラッグまたは矢印キーで並べ替え、Delete で削除', es: 'Paso {capability}, posición {position}, arrastra o usa flechas para reordenar, Supr para eliminar', de: 'Schritt {capability}, Position {position}, Ziehen oder Pfeiltasten zum Umordnen, Entf zum Entfernen', fr: 'Étape {capability}, position {position}, glisser ou flèches pour réordonner, Suppr pour supprimer',
  },
  'workflowEditor.deleteNode': {
    en: 'Delete step', zh: '删除节点', ja: 'ステップを削除', es: 'Eliminar paso', de: 'Schritt löschen', fr: 'Supprimer l\'étape',
  },
  'workflowEditor.hint': {
    en: 'Drag to reorder · arrow keys to move · Delete to remove · hover arrows to insert', zh: '拖拽重排 · 方向键移动 · Delete 删除 · hover 箭头处插入节点', ja: 'ドラッグで並べ替え · 矢印キーで移動 · Delete で削除 · 矢印にホバーで挿入', es: 'Arrastra para reordenar · flechas para mover · Supr para eliminar · pasa sobre las flechas para insertar', de: 'Ziehen zum Umordnen · Pfeiltasten zum Bewegen · Entf zum Entfernen · über Pfeile zum Einfügen', fr: 'Glisser pour réordonner · flèches pour déplacer · Suppr pour supprimer · survoler les flèches pour insérer',
  },
  'workflowEditor.confirmClearTitle': {
    en: 'Clear workflow', zh: '清空工作流', ja: 'ワークフローをクリア', es: 'Limpiar flujo de trabajo', de: 'Workflow leeren', fr: 'Effacer le flux de travail',
  },
  'workflowEditor.confirmClearMessage': {
    en: 'Clear the current workflow? All steps will be removed.', zh: '清空当前工作流?所有节点将被移除。', ja: '現在のワークフローをクリアしますか？すべてのステップが削除されます。', es: '¿Limpiar el flujo de trabajo actual? Se eliminarán todos los pasos.', de: 'Aktuellen Workflow leeren? Alle Schritte werden entfernt.', fr: 'Effacer le flux de travail actuel ? Toutes les étapes seront supprimées.',
  },
  'workflowEditor.confirmClearConfirm': {
    en: 'Clear', zh: '清空', ja: 'クリア', es: 'Limpiar', de: 'Leeren', fr: 'Effacer',
  },
  'workflowEditor.insertNodeAria': {
    en: 'Insert step at position {position}', zh: '在位置 {position} 插入节点', ja: '位置 {position} にステップを挿入', es: 'Insertar paso en la posición {position}', de: 'Schritt an Position {position} einfügen', fr: 'Insérer une étape à la position {position}',
  },
  'workflowEditor.insertNode': {
    en: 'Insert step', zh: '插入节点', ja: 'ステップを挿入', es: 'Insertar paso', de: 'Schritt einfügen', fr: 'Insérer une étape',
  },
  'workflowEditor.searchPlaceholder': {
    en: 'Search capability...', zh: '搜索 capability...', ja: '機能を検索...', es: 'Buscar capacidad...', de: 'Fähigkeit suchen...', fr: 'Rechercher une capacité...',
  },
  'workflowEditor.noMatch': {
    en: 'No matching capability', zh: '无匹配 capability', ja: '一致する機能がありません', es: 'Ninguna capacidad coincidente', de: 'Keine passende Fähigkeit', fr: 'Aucune capacité correspondante',
  },
  'workflowEditor.comingSoon': {
    en: 'Coming soon — no engine installed yet', zh: '即将推出 — 尚未安装引擎', ja: '近日公開 — エンジン未インストール', es: 'Próximamente: aún no hay motor instalado', de: 'Demnächst — noch kein Engine installiert', fr: 'Bientôt disponible — aucun moteur installé',
  },
  'workflowEditor.soon': {
    en: 'Soon', zh: '即将', ja: '近日', es: 'Pronto', de: 'Bald', fr: 'Bientôt',
  },

  // ============ WorkflowTemplates ============
  'workflowTemplates.templatesAria': {
    en: 'Workflow templates', zh: '工作流模板', ja: 'ワークフローテンプレート', es: 'Plantillas de flujo de trabajo', de: 'Workflow-Vorlagen', fr: 'Modèles de flux de travail',
  },
  'workflowTemplates.title': {
    en: 'Templates', zh: '模板', ja: 'テンプレート', es: 'Plantillas', de: 'Vorlagen', fr: 'Modèles',
  },
  'workflowTemplates.builtIn': {
    en: '{count} built-in', zh: '{count} 内置', ja: '{count} 件内蔵', es: '{count} integradas', de: '{count} integriert', fr: '{count} intégrés',
  },
  'workflowTemplates.stepCountOne': {
    en: '{count} step', zh: '{count} 步', ja: '{count} ステップ', es: '{count} paso', de: '{count} Schritt', fr: '{count} étape',
  },
  'workflowTemplates.stepCountOther': {
    en: '{count} steps', zh: '{count} 步', ja: '{count} ステップ', es: '{count} pasos', de: '{count} Schritte', fr: '{count} étapes',
  },
  'workflowTemplates.applyTitle': {
    en: 'Apply template', zh: '应用模板', ja: 'テンプレートを適用', es: 'Aplicar plantilla', de: 'Vorlage anwenden', fr: 'Appliquer le modèle',
  },
  'workflowTemplates.applyMessage': {
    en: 'Applying template "{name}" will replace the current {count} step(s). Continue?', zh: '应用模板「{name}」将替换当前 {count} 个节点,继续?', ja: 'テンプレート「{name}」を適用すると現在の {count} ステップが置き換えられます。続行しますか？', es: 'Aplicar la plantilla "{name}" reemplazará los {count} paso(s) actuales. ¿Continuar?', de: 'Das Anwenden der Vorlage „{name}" ersetzt die aktuellen {count} Schritt(e). Fortfahren?', fr: 'L\'application du modèle « {name} » remplacera les {count} étape(s) actuelle(s). Continuer ?',
  },
  'workflowTemplates.replace': {
    en: 'Replace', zh: '替换', ja: '置き換える', es: 'Reemplazar', de: 'Ersetzen', fr: 'Remplacer',
  },
  'workflowTemplates.tpl.webOptimize.name': {
    en: 'Web Optimize', zh: 'Web 优化', ja: 'Web 最適化', es: 'Optimización web', de: 'Web-Optimierung', fr: 'Optimisation web',
  },
  'workflowTemplates.tpl.webOptimize.desc': {
    en: 'Resize and compress to WebP, ideal for web assets', zh: '调整尺寸并压缩为 WebP,适用于网页素材', ja: 'サイズ変更して WebP に圧縮、Web 素材に最適', es: 'Redimensiona y comprime a WebP, ideal para recursos web', de: 'Größe ändern und zu WebP komprimieren, ideal für Web-Assets', fr: 'Redimensionne et compresse en WebP, idéal pour les ressources web',
  },
  'workflowTemplates.tpl.socialBatch.name': {
    en: 'Social Batch', zh: '社媒批量', ja: 'SNS 一括', es: 'Lote para redes', de: 'Social-Batch', fr: 'Lot réseaux sociaux',
  },
  'workflowTemplates.tpl.socialBatch.desc': {
    en: 'Normalize to 1080px and add a watermark, for Instagram/Twitter', zh: '统一为 1080px 并添加水印,适用于 Instagram/Twitter', ja: '1080px に統一してウォーターマークを追加、Instagram/Twitter 向け', es: 'Normaliza a 1080px y añade marca de agua, para Instagram/Twitter', de: 'Auf 1080px vereinheitlichen und Wasserzeichen hinzufügen, für Instagram/Twitter', fr: 'Uniformise à 1080px et ajoute un filigrane, pour Instagram/Twitter',
  },
  'workflowTemplates.tpl.ecommerceMain.name': {
    en: 'E-commerce Main', zh: '电商主图', ja: 'EC メイン画像', es: 'Imagen principal e-commerce', de: 'E-Commerce-Hauptbild', fr: 'Image principale e-commerce',
  },
  'workflowTemplates.tpl.ecommerceMain.desc': {
    en: '800px main image + JPEG compression + watermark', zh: '800px 主图 + JPEG 压缩 + 水印', ja: '800px メイン画像 + JPEG 圧縮 + ウォーターマーク', es: 'Imagen principal de 800px + compresión JPEG + marca de agua', de: '800px-Hauptbild + JPEG-Komprimierung + Wasserzeichen', fr: 'Image principale 800px + compression JPEG + filigrane',
  },
  'workflowTemplates.tpl.printPrep.name': {
    en: 'Print Prep', zh: '打印预处理', ja: '印刷用前処理', es: 'Preparación para impresión', de: 'Druckvorbereitung', fr: 'Préparation à l\'impression',
  },
  'workflowTemplates.tpl.printPrep.desc': {
    en: 'High-resolution resize + lossless PNG conversion, for printing', zh: '高分辨率 resize + PNG 无损转换,适用于打印', ja: '高解像度リサイズ + PNG ロスレス変換、印刷向け', es: 'Redimensión de alta resolución + conversión PNG sin pérdidas, para impresión', de: 'Hochauflösende Größenänderung + verlustfreie PNG-Konvertierung, für den Druck', fr: 'Redimensionnement haute résolution + conversion PNG sans perte, pour l\'impression',
  },
  'workflowTemplates.tpl.screenshotCompress.name': {
    en: 'Screenshot Compress', zh: '截图压缩', ja: 'スクショ圧縮', es: 'Compresión de captura', de: 'Screenshot-Komprimierung', fr: 'Compression de capture',
  },
  'workflowTemplates.tpl.screenshotCompress.desc': {
    en: 'Shrink to 1280px and compress to low-quality PNG to reduce size', zh: '缩小到 1280px 并压缩为低质量 PNG,减小体积', ja: '1280px に縮小して低品質 PNG に圧縮しサイズを削減', es: 'Reduce a 1280px y comprime a PNG de baja calidad para reducir el tamaño', de: 'Auf 1280px verkleinern und zu PNG geringer Qualität komprimieren, um die Größe zu reduzieren', fr: 'Réduit à 1280px et compresse en PNG basse qualité pour réduire la taille',
  },

  // ============ Workspace ============
  'workspace.initializing': {
    en: 'Initializing Runtime', zh: '正在初始化 Runtime', ja: 'ランタイムを初期化中', es: 'Inicializando el runtime', de: 'Runtime wird initialisiert', fr: 'Initialisation du runtime',
  },
  'workspace.loadingPlugins': {
    en: 'Loading plugins and capabilities...', zh: '正在加载插件与能力...', ja: 'プラグインと機能を読み込み中...', es: 'Cargando plugins y capacidades...', de: 'Plugins und Fähigkeiten werden geladen...', fr: 'Chargement des plugins et des capacités...',
  },
  'workspace.initFailed': {
    en: 'Failed to initialize', zh: '初始化失败', ja: '初期化に失敗しました', es: 'Error al inicializar', de: 'Initialisierung fehlgeschlagen', fr: 'Échec de l\'initialisation',
  },
  'workspace.openPaletteAria': {
    en: 'Open command palette', zh: '打开命令面板', ja: 'コマンドパレットを開く', es: 'Abrir paleta de comandos', de: 'Befehlspalette öffnen', fr: 'Ouvrir la palette de commandes',
  },
  'workspace.paletteTitle': {
    en: 'Command palette (⌘K)', zh: '命令面板（⌘K）', ja: 'コマンドパレット（⌘K）', es: 'Paleta de comandos (⌘K)', de: 'Befehlspalette (⌘K)', fr: 'Palette de commandes (⌘K)',
  },
  'workspace.toggleAssets': {
    en: 'Toggle asset panel', zh: '切换资产面板', ja: 'アセットパネルを切替', es: 'Alternar panel de recursos', de: 'Asset-Bereich umschalten', fr: 'Basculer le panneau des ressources',
  },
  'workspace.toggleInspector': {
    en: 'Toggle inspector panel', zh: '切换检查器面板', ja: 'インスペクタパネルを切替', es: 'Alternar panel del inspector', de: 'Inspektor-Bereich umschalten', fr: 'Basculer le panneau de l\'inspecteur',
  },
  'workspace.closePanel': {
    en: 'Close panel', zh: '关闭面板', ja: 'パネルを閉じる', es: 'Cerrar panel', de: 'Bereich schließen', fr: 'Fermer le panneau',
  },
  'workspace.shareTitle': {
    en: 'Load shared workflow', zh: '加载分享工作流', ja: '共有ワークフローを読み込む', es: 'Cargar flujo de trabajo compartido', de: 'Geteilten Workflow laden', fr: 'Charger le flux de travail partagé',
  },
  'workspace.shareMessage': {
    en: 'A shared workflow link was detected, but the current workflow has {count} step(s). Replace with the shared workflow?', zh: '检测到分享工作流链接,但当前已有 {count} 个节点。是否替换为分享的工作流?', ja: '共有ワークフローのリンクを検出しましたが、現在 {count} ステップがあります。共有ワークフローで置き換えますか？', es: 'Se detectó un enlace de flujo de trabajo compartido, pero el actual tiene {count} paso(s). ¿Reemplazar con el compartido?', de: 'Ein geteilter Workflow-Link wurde erkannt, der aktuelle Workflow hat jedoch {count} Schritt(e). Durch den geteilten ersetzen?', fr: 'Un lien de flux de travail partagé a été détecté, mais le flux actuel comporte {count} étape(s). Remplacer par le flux partagé ?',
  },
  'workspace.shareConfirm': {
    en: 'Replace', zh: '替换', ja: '置き換える', es: 'Reemplazar', de: 'Ersetzen', fr: 'Remplacer',
  },
};
