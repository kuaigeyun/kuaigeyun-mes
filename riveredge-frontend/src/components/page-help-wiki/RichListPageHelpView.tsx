import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PageHelpWiki from './PageHelpWiki';
import {
  buildRichListPageFaqs,
  buildRichListPageSections,
  isRichListPageHelpKey,
  type RichListPageHelpKey,
} from './richListPageHelpRegistry';
import { buildWikiFromSections } from './buildWikiFromSections';

export type RichListPageHelpViewProps = {
  pageKey: RichListPageHelpKey;
};

const RichListPageHelpView: React.FC<RichListPageHelpViewProps> = ({ pageKey }) => {
  const { t } = useTranslation();

  const wiki = useMemo(() => {
    if (!isRichListPageHelpKey(pageKey)) {
      return null;
    }
    return buildWikiFromSections(
      t,
      buildRichListPageSections(pageKey),
      buildRichListPageFaqs(pageKey),
    );
  }, [pageKey, t]);

  if (!wiki) {
    return null;
  }

  return (
    <PageHelpWiki
      items={wiki.items}
      treeData={wiki.treeData}
      defaultSelectedKey="1"
      directoryTitle={t('help.common.catalog')}
      feedbackQuestion={t('help.common.feedbackQuestion')}
    />
  );
};

export default RichListPageHelpView;
