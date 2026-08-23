import React from 'react';
import UniWiki, { type UniWikiProps } from '../uni-wiki';

export type PageHelpWikiProps = UniWikiProps;

/**
 * 列表页帮助视图容器：统一滚动与 Wiki 排版。
 */
const PageHelpWiki: React.FC<PageHelpWikiProps> = (props) => (
  <div
    style={{
      flex: 1,
      minHeight: 0,
      overflow: 'auto',
      padding: '8px 4px 16px',
    }}
  >
    <UniWiki {...props} />
  </div>
);

export default PageHelpWiki;
