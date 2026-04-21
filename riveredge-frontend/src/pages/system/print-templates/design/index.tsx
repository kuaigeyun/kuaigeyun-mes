/**
 * 打印模板设计页面（HTML 模板）
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { App, Button, Input, Space, Typography } from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { CanvasPageTemplate } from '../../../../components/layout-templates';
import { getPrintTemplateByUuid, updatePrintTemplate } from '../../../../services/printTemplate';
import { getTemplateVariableItems } from '../../../../config/printTemplateSchemas';

const { Title } = Typography;

const PrintTemplateDesignPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [templateType, setTemplateType] = useState<string>('');
  const [templateName, setTemplateName] = useState<string>('');
  const [htmlContent, setHtmlContent] = useState('');
  const [varSearchText, setVarSearchText] = useState('');

  useEffect(() => {
    if (uuid) void loadTemplate();
  }, [uuid]);

  const loadTemplate = async () => {
    if (!uuid) return;
    setLoading(true);
    try {
      const data = await getPrintTemplateByUuid(uuid);
      const docType = data.config?.document_type || data.type || '';
      setTemplateType(docType);
      setTemplateName(data.name);
      setHtmlContent(data.content || '');
      document.title = t('pages.system.printTemplatesDesign.documentTitle');
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.printTemplatesDesign.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!uuid) return;
    try {
      await updatePrintTemplate(uuid, {
        content: htmlContent,
        config: templateType ? { document_type: templateType } : undefined,
      });
      messageApi.success(t('pages.system.printTemplatesDesign.saveSuccess'));
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.printTemplatesDesign.saveFailed'));
    }
  };

  const filteredVariables = useMemo(() => {
    const items = getTemplateVariableItems(templateType);
    if (!varSearchText.trim()) return items;
    const q = varSearchText.toLowerCase();
    return items.filter((v) => v.label.toLowerCase().includes(q) || v.key.toLowerCase().includes(q));
  }, [templateType, varSearchText]);

  if (loading) {
    return <div style={{ padding: 20 }}>{t('pages.system.printTemplatesDesign.loading')}</div>;
  }

  return (
    <div style={{ height: 'calc(100vh - 48px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <CanvasPageTemplate
        functionalTitle={t('pages.system.printTemplatesDesign.functionalTitle')}
        toolbar={(
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
                {t('pages.system.printTemplatesDesign.back')}
              </Button>
              <Title level={5} style={{ margin: 0 }}>
                {templateName || t('pages.system.printTemplatesDesign.designTemplate')}
              </Title>
            </Space>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
              {t('pages.system.printTemplatesDesign.save')}
            </Button>
          </Space>
        )}
        canvas={(
          <div style={{ height: '100%', padding: 16, background: '#fff' }}>
            <Input.TextArea
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              autoSize={false}
              style={{ height: '100%', fontFamily: 'monospace' }}
              placeholder="请输入 HTML 模板内容"
            />
          </div>
        )}
        canvasMinHeight={500}
        rightPanel={{
          title: t('pages.system.printTemplatesDesign.availableVariables'),
          children: (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
              <Input.Search
                placeholder={t('pages.system.printTemplatesDesign.searchFieldPlaceholder')}
                allowClear
                onSearch={setVarSearchText}
                onChange={(e) => setVarSearchText(e.target.value)}
              />
              <div style={{ flex: 1, overflow: 'auto' }}>
                {filteredVariables.map((item) => (
                  <div key={item.key} style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ fontWeight: 600 }}>{item.label}</div>
                    <div style={{ fontFamily: 'monospace', color: '#8c8c8c' }}>{`{{${item.key}}}`}</div>
                  </div>
                ))}
              </div>
            </div>
          ),
        }}
      />
    </div>
  );
};

export default PrintTemplateDesignPage;
