'use client';

import { useEffect, useRef } from 'react';
import Quill from 'quill';

type QuillEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
};

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

export function QuillEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  className,
}: QuillEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<Quill | null>(null);
  const latestValueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onBlurRef = useRef(onBlur);
  const toolbarPointerDownRef = useRef(false);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onBlurRef.current = onBlur;
  }, [onBlur]);

  useEffect(() => {
    if (!hostRef.current || !editorRef.current || quillRef.current) return;

    for (const node of hostRef.current.querySelectorAll('.ql-toolbar')) {
      node.remove();
    }
    editorRef.current.className = '';
    editorRef.current.innerHTML = '';

    const quill = new Quill(editorRef.current, {
      theme: 'snow',
      placeholder,
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['blockquote', 'code-block'],
          ['clean'],
        ],
      },
    });

    quillRef.current = quill;

    if (value) {
      if (looksLikeHtml(value)) {
        quill.root.innerHTML = value;
      } else {
        quill.setText(value);
      }
    }

    const handleTextChange = () => {
      const nextValue = quill.root.innerHTML === '<p><br></p>' ? '' : quill.root.innerHTML;
      latestValueRef.current = nextValue;
      onChangeRef.current(nextValue);
    };

    const handleBlur = () => {
      window.setTimeout(() => {
        if (toolbarPointerDownRef.current) {
          toolbarPointerDownRef.current = false;
          return;
        }
        onBlurRef.current?.();
      }, 0);
    };

    quill.on('text-change', handleTextChange);
    quill.root.addEventListener('blur', handleBlur);

    const toolbar = hostRef.current.querySelector('.ql-toolbar');
    const handleToolbarPointerDown = () => {
      toolbarPointerDownRef.current = true;
    };
    toolbar?.addEventListener('mousedown', handleToolbarPointerDown);

    return () => {
      quill.off('text-change', handleTextChange);
      quill.root.removeEventListener('blur', handleBlur);
      toolbar?.removeEventListener('mousedown', handleToolbarPointerDown);
      quillRef.current = null;
      if (hostRef.current) {
        for (const node of hostRef.current.querySelectorAll('.ql-toolbar')) {
          node.remove();
        }
      }
      if (editorRef.current) {
        editorRef.current.className = '';
        editorRef.current.innerHTML = '';
      }
    };
  }, [placeholder]);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) return;

    const currentValue = quill.root.innerHTML === '<p><br></p>' ? '' : quill.root.innerHTML;
    if (currentValue === value) return;

    const selection = quill.getSelection();
    if (!value) {
      quill.setText('');
    } else if (looksLikeHtml(value)) {
      quill.root.innerHTML = value;
    } else {
      quill.setText(value);
    }

    if (selection) {
      quill.setSelection(selection);
    }
  }, [value]);

  return (
    <div ref={hostRef} className={className} aria-label="Character description">
      <div ref={editorRef} />
    </div>
  );
}
