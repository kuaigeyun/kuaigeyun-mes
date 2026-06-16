import React, { useMemo } from 'react';
import { Input } from 'antd';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './login-page-editor.less';

export type LoginRichTextEditorMode = 'visual' | 'code';

export interface LoginRichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  mode: LoginRichTextEditorMode;
}

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ align: [] }],
    ['link'],
    ['clean'],
  ],
};

const QUILL_FORMATS = [
  'header',
  'bold',
  'italic',
  'underline',
  'strike',
  'list',
  'align',
  'link',
];

const LoginRichTextEditor: React.FC<LoginRichTextEditorProps> = ({
  value = '',
  onChange,
  placeholder,
  minHeight = 160,
  mode,
}) => {
  const editorStyle = useMemo(
    () => ({
      ['--login-editor-min-height' as string]: `${minHeight}px`,
    }),
    [minHeight]
  );

  return (
    <div className="login-rich-text-editor" style={editorStyle}>
      {mode === 'visual' ? (
        <div className="login-rich-text-editor-visual">
          <ReactQuill
            theme="snow"
            value={value || ''}
            onChange={(next) => onChange?.(next === '<p><br></p>' ? '' : next)}
            modules={QUILL_MODULES}
            formats={QUILL_FORMATS}
            placeholder={placeholder}
          />
        </div>
      ) : (
        <Input.TextArea
          className="login-rich-text-editor-code"
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          rows={Math.max(6, Math.round(minHeight / 24))}
          spellCheck={false}
        />
      )}
    </div>
  );
};

export default LoginRichTextEditor;
