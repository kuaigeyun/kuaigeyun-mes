import React from 'react';
import { Alert, Card, Space, Typography } from 'antd';
import type { TFunction } from 'i18next';
import type { WikiItem, WikiTreeData } from '../uni-wiki';

const { Title, Paragraph, Text } = Typography;

export type HelpSubsectionDef = {
  titleKey: string;
  bodyKeys?: string[];
  bullets?: string[];
  orderedSteps?: string[];
};

export type HelpSectionDef = {
  key: string;
  labelKey: string;
  titleKey: string;
  bodyKeys?: string[];
  bullets?: string[];
  orderedSteps?: string[];
  subsections?: HelpSubsectionDef[];
  parentKey?: string;
  alert?: { titleKey: string; type?: 'info' | 'warning' | 'error' };
};

export type HelpFaqDef = {
  qKey: string;
  aKey: string;
};

function renderListItems(keys: string[], t: TFunction, ordered: boolean) {
  if (!keys.length) return null;
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag style={{ paddingLeft: 24, marginBottom: 16, marginTop: 8 }}>
      {keys.map((key) => (
        <li key={key} style={{ marginBottom: 8 }}>
          <Text>{t(key)}</Text>
        </li>
      ))}
    </Tag>
  );
}

function renderSubsections(subsections: HelpSubsectionDef[] | undefined, t: TFunction) {
  if (!subsections?.length) return null;
  return (
    <>
      {subsections.map((subsection) => (
        <div key={subsection.titleKey} style={{ marginTop: 20 }}>
          <Title level={3}>{t(subsection.titleKey)}</Title>
          {subsection.bodyKeys?.map((bodyKey) => (
            <Paragraph key={bodyKey}>{t(bodyKey)}</Paragraph>
          ))}
          {renderListItems(subsection.bullets ?? [], t, false)}
          {renderListItems(subsection.orderedSteps ?? [], t, true)}
        </div>
      ))}
    </>
  );
}

function renderSectionContent(t: TFunction, section: HelpSectionDef) {
  return (
    <>
      {section.bodyKeys?.map((bodyKey) => (
        <Paragraph key={bodyKey}>{t(bodyKey)}</Paragraph>
      ))}
      {renderListItems(section.bullets ?? [], t, false)}
      {renderListItems(section.orderedSteps ?? [], t, true)}
      {renderSubsections(section.subsections, t)}
      {section.alert ? (
        <Alert
          title={t(section.alert.titleKey)}
          type={section.alert.type ?? 'info'}
          showIcon
          style={{ marginTop: 16 }}
        />
      ) : null}
    </>
  );
}

export function buildWikiFromSections(
  t: TFunction,
  sections: HelpSectionDef[],
  faqs: HelpFaqDef[] = [],
  options?: {
    faqSectionKey?: string;
    faqSectionLabelKey?: string;
    faqSectionTitleKey?: string;
    /** 仅目录分组、无正文的树节点 */
    folderNodes?: Array<{ key: string; titleKey: string; childKeys: string[] }>;
  },
): { items: WikiItem[]; treeData: WikiTreeData[]; defaultExpandedKeys: string[] } {
  const faqSectionKey = options?.faqSectionKey ?? 'faq';
  const items: WikiItem[] = sections.map((section) => ({
    key: section.key,
    label: t(section.labelKey),
    breadcrumbs: [t('help.common.catalog'), t(section.labelKey)],
    content: (
      <>
        <Title level={2}>{t(section.titleKey)}</Title>
        {renderSectionContent(t, section)}
      </>
    ),
  }));

  if (faqs.length > 0) {
    const faqLabelKey = options?.faqSectionLabelKey ?? 'help.common.faqLabel';
    const faqTitleKey = options?.faqSectionTitleKey ?? 'help.common.faqTitle';
    items.push({
      key: faqSectionKey,
      label: t(faqLabelKey),
      breadcrumbs: [t('help.common.catalog'), t(faqLabelKey)],
      content: (
        <>
          <Title level={2}>{t(faqTitleKey)}</Title>
          <Space orientation="vertical" size="medium" style={{ width: '100%' }}>
            {faqs.map((faq, index) => (
              <Card key={`${faq.qKey}-${index}`} size="small" title={t(faq.qKey)}>
                <Text>{t(faq.aKey)}</Text>
              </Card>
            ))}
          </Space>
        </>
      ),
    });
  }

  const topLevel: WikiTreeData[] = [];
  const childMap = new Map<string, WikiTreeData[]>();
  const folderChildKeys = new Set(
    (options?.folderNodes ?? []).flatMap((folder) => folder.childKeys),
  );

  for (const section of sections) {
    const node: WikiTreeData = { key: section.key, title: t(section.labelKey) };
    if (section.parentKey) {
      const siblings = childMap.get(section.parentKey) ?? [];
      siblings.push(node);
      childMap.set(section.parentKey, siblings);
    } else if (!folderChildKeys.has(section.key)) {
      topLevel.push(node);
    }
  }

  for (const folder of options?.folderNodes ?? []) {
    topLevel.push({
      key: folder.key,
      title: t(folder.titleKey),
      children: (childMap.get(folder.key) ?? []).map((node) => node),
    });
  }

  for (const node of topLevel) {
    if (node.children?.length) {
      continue;
    }
    const children = childMap.get(node.key);
    if (children?.length) {
      node.children = children;
    }
  }

  if (faqs.length > 0) {
    topLevel.push({
      key: faqSectionKey,
      title: t(options?.faqSectionLabelKey ?? 'help.common.faqLabel'),
    });
  }

  const defaultExpanded = topLevel
    .filter((node) => node.children?.length)
    .map((node) => node.key);

  return { items, treeData: topLevel, defaultExpandedKeys: defaultExpanded };
}
