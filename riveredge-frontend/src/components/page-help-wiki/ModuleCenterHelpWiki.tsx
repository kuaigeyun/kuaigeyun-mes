import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PageHelpWiki from './PageHelpWiki';
import { buildWikiFromSections, type HelpFaqDef, type HelpSectionDef } from './buildWikiFromSections';

export type ModuleCenterHelpWikiProps = {
  moduleKey: string;
};

function buildModuleCenterSections(moduleKey: string): HelpSectionDef[] {
  const p = `help.moduleCenter.${moduleKey}`;
  return [
    {
      key: '1',
      labelKey: `${p}.overview.label`,
      titleKey: `${p}.overview.title`,
      bodyKeys: [`${p}.overview.p1`, `${p}.overview.p2`],
    },
    {
      key: '2',
      labelKey: `${p}.panels.label`,
      titleKey: `${p}.panels.title`,
      bodyKeys: [`${p}.panels.p1`, `${p}.panels.p2`],
    },
    {
      key: '3',
      labelKey: `${p}.shortcuts.label`,
      titleKey: `${p}.shortcuts.title`,
      bodyKeys: [`${p}.shortcuts.p1`],
    },
  ];
}

function buildModuleCenterFaqs(moduleKey: string): HelpFaqDef[] {
  const p = `help.moduleCenter.${moduleKey}`;
  return [{ qKey: `${p}.faq.q1`, aKey: `${p}.faq.a1` }];
}

const ModuleCenterHelpWiki: React.FC<ModuleCenterHelpWikiProps> = ({ moduleKey }) => {
  const { t } = useTranslation();
  const wiki = useMemo(
    () => buildWikiFromSections(t, buildModuleCenterSections(moduleKey), buildModuleCenterFaqs(moduleKey)),
    [moduleKey, t],
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

export default ModuleCenterHelpWiki;
