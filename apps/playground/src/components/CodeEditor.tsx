/**
 * CodeEditor - 基于 CodeMirror 6 的 JS 代码编辑器
 *
 * 替换原生 textarea，提供语法高亮、自动缩进、括号匹配。
 * 采用 oneDark 主题，与 Playground 深色背景一致。
 */
import { useEffect, useRef } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, placeholder as cmPlaceholder } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { oneDark } from '@codemirror/theme-one-dark';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { bracketMatching, indentOnInput, syntaxHighlighting, defaultHighlightStyle, foldGutter, foldKeymap } from '@codemirror/language';

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /**
   * W21.9: mount 后是否自动把焦点收进 CodeMirror view。
   *
   * 用于 Playground 的 PlainCodeArea → CodeEditor 切换:
   * 用户首次 focus textarea 触发 activateEditor=true,<Suspense> 先渲染
   * fallback div(无 tabindex,会偷走焦点),CodeEditor 加载完成后
   * 需主动 view.focus() 才能把焦点收回到编辑器,否则键盘输入丢失。
   */
  autoFocus?: boolean;
}

export function CodeEditor({ value, onChange, placeholder, autoFocus }: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // 最新的 onChange 引用，避免 effect 频繁重建
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hostRef.current) return;

    const updateListener = EditorView.updateListener.of((u) => {
      if (u.docChanged) {
        onChangeRef.current(u.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        foldGutter(),
        history(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        highlightActiveLine(),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        javascript({ jsx: false, typescript: false }),
        oneDark,
        updateListener,
        EditorView.lineWrapping,
        placeholder ? cmPlaceholder(placeholder) : [],
        EditorState.tabSize.of(2),
        EditorState.allowMultipleSelections.of(true),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;

    // W21.9: 切换自 PlainCodeArea 时焦点已被 Suspense fallback div 偷走,
    // mount 完成后立即 view.focus() 把焦点收回到 CodeMirror。
    // 放在 RAF 内确保 DOM 插入完成后再 focus,避免与 React commit 冲突。
    if (autoFocus) {
      const raf = requestAnimationFrame(() => {
        view.focus();
      });
      return () => {
        cancelAnimationFrame(raf);
        view.destroy();
        viewRef.current = null;
      };
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // 仅在 mount 时建立；外部 value 变更通过下方单独 effect 同步
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 外部 value 变更时同步到 editor（避免覆盖用户输入）
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return <div ref={hostRef} className="cm-host h-full w-full overflow-hidden" />;
}
