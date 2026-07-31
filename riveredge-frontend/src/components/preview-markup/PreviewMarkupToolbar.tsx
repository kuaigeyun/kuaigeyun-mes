/**
 * 预览批注工具栏按钮（供 FilePreviewModal extra 使用）
 */

import React from 'react';
import {
  ArrowRightOutlined,
  BorderOutlined,
  ClearOutlined,
  FontSizeOutlined,
  SaveOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PreviewOverlayToolButton } from '../uni-preview';
import { usePreviewMarkup, type PreviewMarkupContextValue } from './PreviewMarkupContext';
import type { PreviewMarkupTool } from '../../utils/previewMarkupTypes';

function MarkupToolbarInner({ markup }: { markup: PreviewMarkupContextValue }) {
  const { t } = useTranslation();

  const setTool = (tool: PreviewMarkupTool) => {
    markup.setTool(tool);
  };

  return (
    <>
      <PreviewOverlayToolButton
        title={t('app.master-data.drawings.markupToolPan')}
        active={markup.tool === 'pan'}
        onClick={() => setTool('pan')}
      >
        {t('app.master-data.drawings.markupToolPan')}
      </PreviewOverlayToolButton>
      <PreviewOverlayToolButton
        title={t('app.master-data.drawings.markupToolRect')}
        active={markup.tool === 'rect'}
        onClick={() => setTool('rect')}
      >
        <BorderOutlined />
        {t('app.master-data.drawings.markupToolRect')}
      </PreviewOverlayToolButton>
      <PreviewOverlayToolButton
        title={t('app.master-data.drawings.markupToolArrow')}
        active={markup.tool === 'arrow'}
        onClick={() => setTool('arrow')}
      >
        <ArrowRightOutlined />
        {t('app.master-data.drawings.markupToolArrow')}
      </PreviewOverlayToolButton>
      <PreviewOverlayToolButton
        title={t('app.master-data.drawings.markupToolText')}
        active={markup.tool === 'text'}
        onClick={() => setTool('text')}
      >
        <FontSizeOutlined />
        {t('app.master-data.drawings.markupToolText')}
      </PreviewOverlayToolButton>
      <PreviewOverlayToolButton
        title={t('app.master-data.drawings.markupUndo')}
        onClick={() => {
          if (markup.shapes.length) markup.undo();
        }}
      >
        <UndoOutlined />
      </PreviewOverlayToolButton>
      <PreviewOverlayToolButton
        title={t('app.master-data.drawings.markupClear')}
        onClick={() => {
          if (markup.shapes.length && window.confirm(t('app.master-data.drawings.markupClearConfirm'))) {
            markup.clearAll();
          }
        }}
      >
        <ClearOutlined />
      </PreviewOverlayToolButton>
      <PreviewOverlayToolButton
        title={t('app.master-data.drawings.markupSave')}
        onClick={() => void markup.saveNow()}
      >
        <SaveOutlined />
        {markup.saving ? t('app.master-data.drawings.markupSaving') : t('app.master-data.drawings.markupSave')}
      </PreviewOverlayToolButton>
    </>
  );
}

export const PreviewMarkupToolbar: React.FC = () => {
  const markup = usePreviewMarkup();
  if (!markup?.enabled) return null;
  return <MarkupToolbarInner markup={markup} />;
};
