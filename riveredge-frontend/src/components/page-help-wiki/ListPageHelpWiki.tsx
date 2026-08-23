import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PageHelpWiki from './PageHelpWiki';
import { buildWikiFromSections, type HelpFaqDef, type HelpSectionDef } from './buildWikiFromSections';

export type ListPageHelpWikiProps = {
  pageKey: string;
};

function buildListPageSections(pageKey: string): HelpSectionDef[] {
  const p = `help.listPage.${pageKey}`;
  return [
    {
      key: '1',
      labelKey: `${p}.overview.label`,
      titleKey: `${p}.overview.title`,
      bodyKeys: [`${p}.overview.p1`, `${p}.overview.p2`],
    },
    {
      key: '2',
      labelKey: `${p}.operations.label`,
      titleKey: `${p}.operations.title`,
      bodyKeys: [`${p}.operations.p1`, `${p}.operations.p2`],
    },
  ];
}

function buildListPageFaqs(pageKey: string): HelpFaqDef[] {
  const p = `help.listPage.${pageKey}`;
  return [{ qKey: `${p}.faq.q1`, aKey: `${p}.faq.a1` }];
}

const ListPageHelpWiki: React.FC<ListPageHelpWikiProps> = ({ pageKey }) => {
  const { t } = useTranslation();
  const wiki = useMemo(
    () => buildWikiFromSections(t, buildListPageSections(pageKey), buildListPageFaqs(pageKey)),
    [pageKey, t],
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

export default ListPageHelpWiki;
