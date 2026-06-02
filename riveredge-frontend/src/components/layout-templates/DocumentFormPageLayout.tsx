import type { CSSProperties, ReactNode } from 'react';
import {
  DOCUMENT_FORM_PAGE_BODY_STYLE,
  DOCUMENT_FORM_PAGE_HEADER_STYLE,
  DOCUMENT_FORM_PAGE_ROOT_STYLE,
  uniTabsChildPageVerticalInsetStyle,
} from './constants';

export interface DocumentFormPageLayoutProps {
  /** 页头：标题 + 操作按钮 */
  header: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
  headerStyle?: CSSProperties;
  bodyStyle?: CSSProperties;
}

/**
 * 独立新建/编辑页布局：顶栏固定，表单内容区单独滚动。
 */
export function DocumentFormPageLayout({
  header,
  children,
  style,
  headerStyle,
  bodyStyle,
}: DocumentFormPageLayoutProps) {
  return (
    <div
      className="document-form-page-layout"
      style={{
        ...uniTabsChildPageVerticalInsetStyle(),
        ...DOCUMENT_FORM_PAGE_ROOT_STYLE,
        ...style,
      }}
    >
      <div
        className="document-form-page-header"
        style={{ ...DOCUMENT_FORM_PAGE_HEADER_STYLE, ...headerStyle }}
      >
        {header}
      </div>
      <div
        className="document-form-page-body"
        style={{ ...DOCUMENT_FORM_PAGE_BODY_STYLE, ...bodyStyle }}
      >
        {children}
      </div>
    </div>
  );
}
