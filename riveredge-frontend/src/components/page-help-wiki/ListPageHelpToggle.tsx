import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemedSegmented } from '../themed-segmented';

type ListPageHelpToggleProps = {
  helpContent: React.ReactNode;
  children: React.ReactNode;
};

/** 非 UniTable 列表页：工作台内容与富文本帮助切换 */
export default function ListPageHelpToggle({ helpContent, children }: ListPageHelpToggleProps) {
  const { t } = useTranslation();
  const [pageView, setPageView] = useState<'main' | 'help'>('main');

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <ThemedSegmented
          value={pageView}
          options={[
            { label: t('help.moduleCenter.view.workbench'), value: 'main' },
            { label: t('help.moduleCenter.view.help'), value: 'help' },
          ]}
          onChange={(val) => setPageView((val as 'main' | 'help') ?? 'main')}
        />
      </div>
      {pageView === 'help' ? (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {helpContent}
        </div>
      ) : (
        children
      )}
    </>
  );
}
