import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PageHelpWiki from './PageHelpWiki';
import type { DocumentListHelpKey } from './documentListHelpRegistry';
import {
  buildRichDocumentFaqs,
  buildRichDocumentHelpSections,
  buildRichDocumentHelpTreeOptions,
  isRichDocumentHelpKey,
} from './richDocumentHelpRegistry';
import { buildWikiFromSections } from './buildWikiFromSections';

export type RichDocumentHelpViewProps = {
  docKey: DocumentListHelpKey;
};

const RichDocumentHelpView: React.FC<RichDocumentHelpViewProps> = ({ docKey }) => {
  const { t } = useTranslation();

  const wiki = useMemo(() => {
    if (!isRichDocumentHelpKey(docKey)) {
      return null;
    }
    const sections = buildRichDocumentHelpSections(docKey);
    const faqs = buildRichDocumentFaqs(docKey);
    const treeOpts = buildRichDocumentHelpTreeOptions(docKey);
    const built = buildWikiFromSections(t, sections, faqs, {
      folderNodes: treeOpts.folderNodes,
    });
    return {
      ...built,
      defaultExpandedKeys: [...treeOpts.defaultExpandedKeys, ...built.defaultExpandedKeys],
    };
  }, [docKey, t]);

  if (!wiki) {
    return null;
  }

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

export default RichDocumentHelpView;
