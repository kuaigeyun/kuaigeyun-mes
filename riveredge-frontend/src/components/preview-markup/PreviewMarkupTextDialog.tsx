/**
 * 批注文字输入弹窗
 */

import React, { useEffect, useState } from 'react';
import { Input, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { usePreviewMarkup } from './PreviewMarkupContext';

export const PreviewMarkupTextDialog: React.FC = () => {
  const { t } = useTranslation();
  const markup = usePreviewMarkup();
  const [text, setText] = useState('');

  const open = Boolean(markup?.pendingTextPoint);

  useEffect(() => {
    if (open) {
      setText('');
    }
  }, [open]);

  if (!markup) return null;

  return (
    <Modal
      open={open}
      title={t('app.master-data.drawings.markupTextTitle')}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      destroyOnHidden
      onOk={() => markup.submitText(text)}
      onCancel={() => markup.cancelText()}
      zIndex={10050}
    >
      <Input.TextArea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('app.master-data.drawings.markupTextPlaceholder')}
        autoFocus
        onPressEnter={(e) => {
          if (!e.shiftKey) {
            e.preventDefault();
            markup.submitText(text);
          }
        }}
      />
    </Modal>
  );
};
