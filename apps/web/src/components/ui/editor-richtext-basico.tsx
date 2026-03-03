'use client';

import { useEffect, useMemo } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

interface EditorRichTextBasicoProps {
  label: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  required?: boolean;
}

export function EditorRichTextBasico({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: EditorRichTextBasicoProps) {
  const editorId = useMemo(() => `editor-${Math.random().toString(36).slice(2, 9)}`, []);
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '',
    editorProps: {
      attributes: {
        class:
          'min-h-[160px] p-3 text-sm bg-base-100 focus:outline-none prose prose-sm max-w-none',
      },
    },
    onUpdate: ({ editor: tiptapEditor }) => {
      onChange(tiptapEditor.getHTML());
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    const htmlAtual = editor.getHTML();
    const htmlEsperado = value || '';
    if (htmlAtual !== htmlEsperado) {
      editor.commands.setContent(htmlEsperado, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return null;
  }

  return (
    <div className="form-control gap-2" id={editorId}>
      <div className="rounded-lg border border-base-300 overflow-hidden">
        <div className="bg-base-200 px-3 py-2 border-b border-base-300">
          <label className="text-sm font-semibold">
            {label}
            {required ? <span className="text-error ml-1">*</span> : null}
          </label>
        </div>
        <div className="border-b border-base-300 bg-base-50 px-2 py-2 flex flex-wrap gap-2">
          <button
            type="button"
            className={`btn btn-xs ${editor.isActive('bold') ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            B
          </button>
          <button
            type="button"
            className={`btn btn-xs italic ${editor.isActive('italic') ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            I
          </button>
          <button
            type="button"
            className={`btn btn-xs ${editor.isActive('bulletList') ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            Lista
          </button>
          <button
            type="button"
            className={`btn btn-xs ${editor.isActive('orderedList') ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            1.
          </button>
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          >
            Limpar
          </button>
        </div>
        <EditorContent editor={editor} />
        {placeholder && !value ? (
          <p className="px-3 pb-3 text-xs text-base-content/50">{placeholder}</p>
        ) : null}
      </div>
    </div>
  );
}
