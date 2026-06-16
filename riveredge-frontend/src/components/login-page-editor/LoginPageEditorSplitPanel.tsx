import React from 'react';
import './login-page-editor.less';

export interface LoginPageEditorSplitPanelProps {
  settings: React.ReactNode;
  preview: React.ReactNode;
}

/** 登录页文案编辑：左侧预览、右侧配置，各占 50% */
const LoginPageEditorSplitPanel: React.FC<LoginPageEditorSplitPanelProps> = ({
  settings,
  preview,
}) => (
  <div className="login-page-editor-split">
    <div className="login-page-editor-split-preview">{preview}</div>
    <div className="login-page-editor-split-divider" aria-hidden />
    <div className="login-page-editor-split-settings">{settings}</div>
  </div>
);

export default LoginPageEditorSplitPanel;
