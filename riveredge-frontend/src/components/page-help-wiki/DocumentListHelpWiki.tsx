import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PageHelpWiki from './PageHelpWiki';
import {
  buildGuideTreeOptions,
  buildGuideTreeSections,
  buildStandardDocumentFaqs,
  type DocumentListHelpKey,
} from './documentListHelpRegistry';
import { buildWikiFromSections } from './buildWikiFromSections';

export type DocumentListHelpWikiProps = {
  docKey: DocumentListHelpKey;
};

const DocumentListHelpWiki: React.FC<DocumentListHelpWikiProps> = ({ docKey }) => {
  const { t } = useTranslation();
  const wiki = useMemo(() => {
    const sections = buildGuideTreeSections(docKey);
    const faqs = buildStandardDocumentFaqs(docKey);
    const guideOpts = buildGuideTreeOptions(docKey);
    const built = buildWikiFromSections(t, sections, faqs, {
      folderNodes: guideOpts.folderNodes,
    });
    return {
      ...built,
      defaultExpandedKeys: [...guideOpts.defaultExpandedKeys, ...built.defaultExpandedKeys],
    };
  }, [docKey, t]);

  return (
    <PageHelpWiki
      items={wiki.items}
      treeData={wiki.treeData}
      defaultExpandedKeys={wiki.defaultExpandedKeys}
      defaultSelectedKey="1"
      directoryTitle={t('help.common.catalog')}
      feedbackQuestion={t('help.common.feedbackQuestion')}
    />
  );
};

export default DocumentListHelpWiki;
