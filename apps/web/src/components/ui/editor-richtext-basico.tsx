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
    <div className="flex flex-col gap-2" id={editorId}>
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="bg-muted px-3 py-2 border-b border-border">
          <label className="text-sm font-semibold">
            {label}
            {required ? <span className="text-destructive ml-1">*</span> : null}
          </label>
        </div>
        <div className="border-b border-border bg-base-50 px-2 py-2 flex flex-wrap gap-2">
          <button
            type="button"
            className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-7 px-2 text-xs bg-muted text-foreground hover:bg-muted/80 ${editor.isActive('bold') ? '!bg-primary !text-primary-foreground hover:!bg-primary/90' : '!bg-transparent hover:!bg-muted'}`}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            B
          </button>
          <button
            type="button"
            className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-7 px-2 text-xs bg-muted text-foreground hover:bg-muted/80 italic ${editor.isActive('italic') ? '!bg-primary !text-primary-foreground hover:!bg-primary/90' : '!bg-transparent hover:!bg-muted'}`}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            I
          </button>
          <button
            type="button"
            className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-7 px-2 text-xs bg-muted text-foreground hover:bg-muted/80 ${editor.isActive('bulletList') ? '!bg-primary !text-primary-foreground hover:!bg-primary/90' : '!bg-transparent hover:!bg-muted'}`}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            Lista
          </button>
          <button
            type="button"
            className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-7 px-2 text-xs bg-muted text-foreground hover:bg-muted/80 ${editor.isActive('orderedList') ? '!bg-primary !text-primary-foreground hover:!bg-primary/90' : '!bg-transparent hover:!bg-muted'}`}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            1.
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-7 px-2 text-xs hover:bg-muted"
            onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          >
            Limpar
          </button>
        </div>
        <EditorContent editor={editor} />
        {placeholder && !value ? (
          <p className="px-3 pb-3 text-xs text-muted-foreground">{placeholder}</p>
        ) : null}
      </div>
    </div>
  );
}
