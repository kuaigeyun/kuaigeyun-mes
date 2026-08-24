import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PageHelpWiki from './PageHelpWiki';
import { buildWikiFromSections } from './buildWikiFromSections';
import { buildReportHelpFaqs, buildReportHelpSections } from './reportHelpRegistry';

const RichReportHelpView: React.FC = () => {
  const { t } = useTranslation();

  const wiki = useMemo(
    () =>
      buildWikiFromSections(t, buildReportHelpSections(), buildReportHelpFaqs(), {
        faqSectionKey: '4',
        faqSectionLabelKey: 'help.report.common.faq.label',
        faqSectionTitleKey: 'help.report.common.faq.title',
      }),
    [t],
  );

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

export default RichReportHelpView;
