import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PageHelpWiki from './PageHelpWiki';
import { buildWikiFromSections } from './buildWikiFromSections';
import {
  buildRichModuleCenterFaqs,
  buildRichModuleCenterSections,
  isRichModuleCenterHelpKey,
  type RichModuleCenterHelpKey,
} from './richModuleCenterHelpRegistry';

export type RichModuleCenterHelpViewProps = {
  moduleKey: RichModuleCenterHelpKey;
};

const RichModuleCenterHelpView: React.FC<RichModuleCenterHelpViewProps> = ({ moduleKey }) => {
  const { t } = useTranslation();

  const wiki = useMemo(() => {
    if (!isRichModuleCenterHelpKey(moduleKey)) {
      return null;
    }
    return buildWikiFromSections(
      t,
      buildRichModuleCenterSections(moduleKey),
      buildRichModuleCenterFaqs(moduleKey),
      {
        faqSectionKey: '5',
        faqSectionLabelKey: 'help.common.faqLabel',
        faqSectionTitleKey: 'help.common.faqTitle',
      },
    );
  }, [moduleKey, t]);

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

export default RichModuleCenterHelpView;
