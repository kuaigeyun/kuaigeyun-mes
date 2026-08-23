import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PageHelpWiki from './PageHelpWiki';
import { buildWikiFromSections, type HelpSectionDef } from './buildWikiFromSections';

const PREFIX = 'help.applicationCenter';

const ApplicationHelpView: React.FC = () => {
  const { t } = useTranslation();

  const wiki = useMemo(() => {
    const sections: HelpSectionDef[] = [
      {
        key: '1',
        labelKey: `${PREFIX}.overview.label`,
        titleKey: `${PREFIX}.overview.title`,
        bodyKeys: [`${PREFIX}.overview.p1`, `${PREFIX}.overview.p2`],
        alert: { titleKey: `${PREFIX}.overview.alert`, type: 'info' },
      },
      {
        key: '2',
        labelKey: `${PREFIX}.concepts.label`,
        titleKey: `${PREFIX}.concepts.title`,
        bodyKeys: [`${PREFIX}.concepts.p1`],
        bullets: [
          `${PREFIX}.concepts.b1`,
          `${PREFIX}.concepts.b2`,
          `${PREFIX}.concepts.b3`,
          `${PREFIX}.concepts.b4`,
          `${PREFIX}.concepts.b5`,
        ],
      },
      {
        key: '3',
        labelKey: `${PREFIX}.layout.label`,
        titleKey: `${PREFIX}.layout.title`,
        bodyKeys: [`${PREFIX}.layout.p1`],
        bullets: [
          `${PREFIX}.layout.b1`,
          `${PREFIX}.layout.b2`,
          `${PREFIX}.layout.b3`,
          `${PREFIX}.layout.b4`,
        ],
      },
      {
        key: '3.1',
        labelKey: `${PREFIX}.install.label`,
        titleKey: `${PREFIX}.install.title`,
        bodyKeys: [`${PREFIX}.install.p1`],
        orderedSteps: [
          `${PREFIX}.install.s1`,
          `${PREFIX}.install.s2`,
          `${PREFIX}.install.s3`,
          `${PREFIX}.install.s4`,
        ],
        parentKey: 'guide',
        alert: { titleKey: `${PREFIX}.install.alert`, type: 'warning' },
      },
      {
        key: '3.2',
        labelKey: `${PREFIX}.enable.label`,
        titleKey: `${PREFIX}.enable.title`,
        bodyKeys: [`${PREFIX}.enable.p1`],
        bullets: [`${PREFIX}.enable.b1`, `${PREFIX}.enable.b2`, `${PREFIX}.enable.b3`],
        parentKey: 'guide',
      },
      {
        key: '3.3',
        labelKey: `${PREFIX}.scan.label`,
        titleKey: `${PREFIX}.scan.title`,
        bodyKeys: [`${PREFIX}.scan.p1`],
        orderedSteps: [
          `${PREFIX}.scan.s1`,
          `${PREFIX}.scan.s2`,
          `${PREFIX}.scan.s3`,
          `${PREFIX}.scan.s4`,
        ],
        parentKey: 'guide',
        alert: { titleKey: `${PREFIX}.scan.alert`, type: 'info' },
      },
      {
        key: '3.4',
        labelKey: `${PREFIX}.menuSync.label`,
        titleKey: `${PREFIX}.menuSync.title`,
        bodyKeys: [`${PREFIX}.menuSync.p1`],
        bullets: [`${PREFIX}.menuSync.b1`, `${PREFIX}.menuSync.b2`, `${PREFIX}.menuSync.b3`],
        parentKey: 'guide',
      },
      {
        key: '3.5',
        labelKey: `${PREFIX}.advanced.label`,
        titleKey: `${PREFIX}.advanced.title`,
        bodyKeys: [`${PREFIX}.advanced.p1`],
        bullets: [
          `${PREFIX}.advanced.b1`,
          `${PREFIX}.advanced.b2`,
          `${PREFIX}.advanced.b3`,
          `${PREFIX}.advanced.b4`,
        ],
        parentKey: 'guide',
        alert: { titleKey: `${PREFIX}.advanced.alert`, type: 'error' },
      },
    ];

    const built = buildWikiFromSections(
      t,
      sections,
      [
        { qKey: `${PREFIX}.faq.q1`, aKey: `${PREFIX}.faq.a1` },
        { qKey: `${PREFIX}.faq.q2`, aKey: `${PREFIX}.faq.a2` },
        { qKey: `${PREFIX}.faq.q3`, aKey: `${PREFIX}.faq.a3` },
        { qKey: `${PREFIX}.faq.q4`, aKey: `${PREFIX}.faq.a4` },
        { qKey: `${PREFIX}.faq.q5`, aKey: `${PREFIX}.faq.a5` },
        { qKey: `${PREFIX}.faq.q6`, aKey: `${PREFIX}.faq.a6` },
      ],
      {
        folderNodes: [
          {
            key: 'guide',
            titleKey: `${PREFIX}.guide.label`,
            childKeys: ['3.1', '3.2', '3.3', '3.4', '3.5'],
          },
        ],
      },
    );

    return {
      ...built,
      defaultExpandedKeys: ['guide', ...built.defaultExpandedKeys],
    };
  }, [t]);

  return (
    <PageHelpWiki
      items={wiki.items}
      treeData={wiki.treeData}
      defaultSelectedKey="1"
      defaultExpandedKeys={wiki.defaultExpandedKeys}
      directoryTitle={t('help.common.catalog')}
      feedbackQuestion={t('help.common.feedbackQuestion')}
    />
  );
};

export default ApplicationHelpView;
