'use client';

import { useMemo, useRef } from 'react';

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
  const editorRef = useRef<HTMLDivElement>(null);
  const editorId = useMemo(() => `editor-${Math.random().toString(36).slice(2, 9)}`, []);

  const handleExecCommand = (comando: string): void => {
    editorRef.current?.focus();
    document.execCommand(comando, false);
    onChange(editorRef.current?.innerHTML || '');
  };

  return (
    <div className="form-control gap-2">
      <label className="label py-0" htmlFor={editorId}>
        <span className="label-text font-medium">
          {label}
          {required ? <span className="text-error ml-1">*</span> : null}
        </span>
      </label>
      <div className="join">
        <button type="button" className="btn btn-sm join-item" onClick={() => handleExecCommand('bold')}>
          B
        </button>
        <button type="button" className="btn btn-sm join-item italic" onClick={() => handleExecCommand('italic')}>
          I
        </button>
        <button type="button" className="btn btn-sm join-item" onClick={() => handleExecCommand('insertUnorderedList')}>
          Lista
        </button>
        <button type="button" className="btn btn-sm join-item" onClick={() => handleExecCommand('insertOrderedList')}>
          1.
        </button>
      </div>
      <div
        id={editorId}
        ref={editorRef}
        className="min-h-[140px] rounded-lg border border-base-300 p-3 text-sm bg-base-100 focus:outline-none focus:border-primary"
        contentEditable
        suppressContentEditableWarning
        onBlur={(event) => onChange(event.currentTarget.innerHTML)}
        dangerouslySetInnerHTML={{ __html: value || '' }}
        data-placeholder={placeholder || ''}
      />
    </div>
  );
}
