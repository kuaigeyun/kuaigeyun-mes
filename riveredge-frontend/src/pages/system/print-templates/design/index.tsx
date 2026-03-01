/**
 * 打印模板设计页面
 *
 * 使用 pdfme Designer：操作条 + 画板 + 右侧变量参考面板
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { App, Button, Form, Input, InputNumber, Modal, Select, Space, Typography, Upload, theme } from 'antd';
import { ArrowLeftOutlined, EyeOutlined, SaveOutlined, SettingOutlined, FilePdfOutlined, CheckCircleOutlined } from '@ant-design/icons';
import PdfmeDesigner, { PdfmeDesignerRef } from '../../../../components/pdfme-doc/designer';
import PdfmePreview from '../../../../components/pdfme-doc/preview';
import { CanvasPageTemplate } from '../../../../components/layout-templates';
import { getPrintTemplateByUuid, updatePrintTemplate } from '../../../../services/printTemplate';
import {
  getTemplateVariableItems,
  getSamplePreviewVariables,
  getArrayTableTemplates,
  TemplateVariableItem,
} from '../../../../config/printTemplateSchemas';
import {
  EMPTY_PDFME_TEMPLATE,
  PAPER_PRESETS,
  DEFAULT_PADDING,
  getBasePdfFromTemplate,
  getStaticSchemaTexts,
  buildStaticSchemaFromConfig,
  applyBasePdfToTemplate,
  applyCustomBasePdfToTemplate,
  fileToBasePdfBase64,
  isBlankPdf,
  HEADER_PRESETS,
  FOOTER_PRESETS,
} from '../../../../components/pdfme-doc/constants';
import { buildTemplateWithFields, sanitizeTemplate } from '../../../../utils/pdfmeTemplateUtils';
import type { Template } from '@pdfme/common';

const { Title } = Typography;

/** 解析为有效 pdfme 模板 */
function parsePdfmeTemplate(content: string): Template {
  try {
    const parsed = JSON.parse(content);
    if (parsed?.basePdf && Array.isArray(parsed?.schemas)) {
      return parsed as Template;
    }
  } catch {
    // ignore
  }
  return EMPTY_PDFME_TEMPLATE;
}

/** 判断模板是否为空（无 schema） */
function isTemplateEmpty(template: Template): boolean {
  const schemas = template.schemas?.[0];
  return !schemas || schemas.length === 0;
}

const { useToken } = theme;

const PrintTemplateDesignPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = useToken();
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [initialTemplate, setInitialTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(false);
  const [templateType, setTemplateType] = useState<string>('');
  const [templateName, setTemplateName] = useState<string>('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);
  const [pageSettingsForm] = Form.useForm();
  const [uploadedBasePdfFile, setUploadedBasePdfFile] = useState<File | null>(null);
  const [basePdfWasCustomOnOpen, setBasePdfWasCustomOnOpen] = useState(false);
  const [availableVariables, setAvailableVariables] = useState<TemplateVariableItem[]>([]);
  const [usedKeys, setUsedKeys] = useState<Set<string>>(new Set());
  const [varSearchText, setVarSearchText] = useState('');
  const editorRef = useRef<PdfmeDesignerRef>(null);

  useEffect(() => {
    if (uuid) loadTemplate();
  }, [uuid]);

  const loadTemplate = async () => {
    if (!uuid) return;
    setLoading(true);
    try {
      const data = await getPrintTemplateByUuid(uuid);
      let template = parsePdfmeTemplate(data.content);
      const docType = data.config?.document_type || data.type || '';
      setTemplateType(docType);
      // 空模板时预加载业务字段到 pdfme 原生编辑器（字段列表）
      const variableItems = getTemplateVariableItems(docType);
      if (isTemplateEmpty(template) && docType) {
        const arrayTableTemplates = getArrayTableTemplates(docType);
        template = buildTemplateWithFields(template, variableItems, arrayTableTemplates);
      } else if (docType) {
        // 性能与稳定性优化：不再强制将 ID 转换为纯中文，防止设计器图层渲染异常
        // template = enhanceTemplateWithLabels(template, variableItems);
      }
      // 加固并修复已污染内容（如「备注」重复），设计器与预览均使用修复后的模板
      template = sanitizeTemplate(template);
      document.title = t('pages.system.printTemplatesDesign.documentTitle');
      setTemplateName(data.name);
      setInitialTemplate(template);
      setAvailableVariables(variableItems);
      
      // 初始化已使用键集
      const keys = new Set<string>();
      template.schemas.forEach(page => {
        page.forEach((s: any) => { if (s.name) keys.add(s.name); });
      });
      setUsedKeys(keys);

      const searchParams = new URLSearchParams(location.search || '');
      searchParams.delete('_refresh');
      // Title update is handled by CanvasPageTemplate via functionalTitle prop
    } catch (error) {
      console.error('[Print Template Design] 加载失败:', error);
      messageApi.error(t('pages.system.printTemplatesDesign.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!uuid || !editorRef.current) return;
    try {
      const template = editorRef.current.getTemplate();
      const content = JSON.stringify(template);
      await updatePrintTemplate(uuid, {
        content,
        config: templateType ? { document_type: templateType } : undefined,
      });
      messageApi.success(t('pages.system.printTemplatesDesign.saveSuccess'));
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.printTemplatesDesign.saveFailed'));
    }
  };

  const handleOpenPageSettings = () => {
    const current = editorRef.current?.getTemplate() ?? initialTemplate;
    if (!current) return;
    const bp = getBasePdfFromTemplate(current);
    const preset = PAPER_PRESETS.find(
      (p) => p.id !== 'custom' && p.width === bp.width && p.height === bp.height
    );
    setUploadedBasePdfFile(null);
    setBasePdfWasCustomOnOpen(bp.isCustomPdf);
    const staticTexts = getStaticSchemaTexts(current);
    
    // 匹配页眉预设
    const headerP = HEADER_PRESETS.find(p => p.value !== 'custom' && p.value === staticTexts.headerText)?.value ?? (staticTexts.headerText ? 'custom' : '');
    // 匹配页脚预设
    const footerP = FOOTER_PRESETS.find(p => p.value !== 'custom' && p.value === staticTexts.footerText)?.value ?? (staticTexts.footerText ? 'custom' : '');

    pageSettingsForm.setFieldsValue({
      basePdfSource: bp.isCustomPdf ? 'custom' : 'blank',
      paperPreset: preset?.id ?? 'custom',
      customWidth: bp.width,
      customHeight: bp.height,
      paddingTop: bp.padding[0],
      paddingRight: bp.padding[1],
      paddingBottom: bp.padding[2],
      paddingLeft: bp.padding[3],
      headerPreset: headerP,
      headerText: staticTexts.headerText,
      footerPreset: footerP,
      footerText: staticTexts.footerText,
    });
    setPageSettingsOpen(true);
  };

  const handleApplyPageSettings = async () => {
    try {
      const fieldsToValidate = ['basePdfSource'];
      const basePdfSource = pageSettingsForm.getFieldValue('basePdfSource');
      if (basePdfSource === 'blank') {
        fieldsToValidate.push('paperPreset', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft');
        if (pageSettingsForm.getFieldValue('paperPreset') === 'custom') {
          fieldsToValidate.push('customWidth', 'customHeight');
        }
      }
      const values = await pageSettingsForm.validateFields(fieldsToValidate);
      const currentTemplate = editorRef.current?.getTemplate() ?? initialTemplate;
      if (!currentTemplate) {
        messageApi.error(t('pages.system.printTemplatesDesign.notReady'));
        return;
      }
      let nextTemplate: Template;

      if (values.basePdfSource === 'custom' && uploadedBasePdfFile) {
        const base64 = await fileToBasePdfBase64(uploadedBasePdfFile);
        nextTemplate = applyCustomBasePdfToTemplate(currentTemplate, base64);
      } else if (values.basePdfSource === 'blank') {
        let width: number;
        let height: number;
        if (values.paperPreset === 'custom') {
          width = values.customWidth;
          height = values.customHeight;
        } else {
          const preset = PAPER_PRESETS.find((p) => p.id === values.paperPreset);
          width = preset?.width ?? 210;
          height = preset?.height ?? 297;
        }
        const padding: [number, number, number, number] = [
          values.paddingTop ?? DEFAULT_PADDING[0],
          values.paddingRight ?? DEFAULT_PADDING[1],
          values.paddingBottom ?? DEFAULT_PADDING[2],
          values.paddingLeft ?? DEFAULT_PADDING[3],
        ];
        const staticSchema = buildStaticSchemaFromConfig(
          { headerText: values.headerText, footerText: values.footerText },
          { width, height, padding }
        );
        nextTemplate = applyBasePdfToTemplate(currentTemplate, {
          width,
          height,
          padding,
          staticSchema: staticSchema.length > 0 ? staticSchema : undefined,
        });
      } else if (values.basePdfSource === 'custom' && isBlankPdf(currentTemplate.basePdf)) {
        messageApi.warning(t('pages.system.printTemplatesDesign.selectPdf'));
        return;
      } else {
        nextTemplate = currentTemplate;
      }

      editorRef.current?.updateTemplate(nextTemplate);
      setInitialTemplate(nextTemplate);
      setPageSettingsOpen(false);
      setUploadedBasePdfFile(null);
      messageApi.success(t('pages.system.printTemplatesDesign.pageSettingsApplied'));
    } catch (e) {
      // 表单校验失败
    }
  };

  const handlePreview = () => {
    if (!editorRef.current) return;
    const template = editorRef.current.getTemplate();
    const hasSchemas = template.schemas?.some((page) => page && page.length > 0);
    if (!hasSchemas) {
      messageApi.warning(t('pages.system.printTemplatesDesign.noPreview'));
      return;
    }
    setPreviewTemplate(template);
    setPreviewOpen(true);
  };

  const lastKeysStrRef = useRef('');
  const updateTimeoutRef = useRef<any>(null);

  const updateUsedKeys = useCallback((t: Template) => {
    // 防抖处理：避免高频触发导致 UI 阻塞
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    
    updateTimeoutRef.current = setTimeout(() => {
      const keysArray: string[] = [];
      t.schemas.forEach(page => {
        page.forEach((s: any) => { if (s.name) keysArray.push(s.name); });
      });
      
      const currentKeysStr = JSON.stringify(keysArray.sort());
      // 只有当实际使用的 Key 列表发生变化时才更新状态，选中字段不会改变 Key 列表
      if (currentKeysStr !== lastKeysStrRef.current) {
        lastKeysStrRef.current = currentKeysStr;
        setUsedKeys(new Set(keysArray));
      }
    }, 100); // 100ms 延迟足以过滤掉绝大部分交互产生的瞬时事件
  }, []);

  const handleAddVariable = useCallback((item: TemplateVariableItem) => {
    if (!editorRef.current) return;
    try {
      const template = editorRef.current.getTemplate();
      const nextTemplate = JSON.parse(JSON.stringify(template)) as Template;
      
      if (!nextTemplate.schemas[0]) nextTemplate.schemas[0] = [];
      
      const count = nextTemplate.schemas[0].length;
      const x = 20 + (count % 5) * 10;
      const y = 30 + (Math.floor(count / 5) % 10) * 10;

      const isQr = item.key.endsWith('_qrcode');
      const isSign = item.key === 'signature';

      const newSchema: any = {
        name: item.key,
        type: isQr ? 'qrcode' : (isSign ? 'signature' : 'text'),
        position: { x, y },
        width: isQr ? 30 : (isSign ? 60 : 80),
        height: isQr ? 30 : (isSign ? 30 : 8),
      };

      if (!isQr && !isSign) {
        newSchema.content = `{${item.key}}`;
        newSchema.readOnly = true;
      } else if (isQr) {
        newSchema.content = 'SAMPLE';
        newSchema.backgroundColor = '#ffffff';
        newSchema.barColor = '#000000';
      }

      nextTemplate.schemas[0].push(newSchema);
      editorRef.current.updateTemplate(nextTemplate);
      updateUsedKeys(nextTemplate);
      messageApi.success(t('pages.system.printTemplatesDesign.fieldAdded', { label: item.label }));
    } catch (e: any) {
      messageApi.error(t('pages.system.printTemplatesDesign.addFieldFailed', { message: e.message }));
    }
  }, [t, messageApi, updateUsedKeys]);

  const filteredVariables = useMemo(() => 
    availableVariables.filter(v => 
      v.label.toLowerCase().includes(varSearchText.toLowerCase()) || 
      v.key.toLowerCase().includes(varSearchText.toLowerCase())
    ), [availableVariables, varSearchText]);

  const variableItemsList = useMemo(() => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {filteredVariables.map((item) => {
        const isUsed = usedKeys.has(item.key);
        return (
          <div
            key={item.key}
            onClick={() => !isUsed && handleAddVariable(item)}
            style={{
              padding: '10px 12px',
              background: isUsed ? '#fafafa' : '#fff',
              border: '1px solid',
              borderColor: isUsed ? token.colorBorderSecondary : token.colorBorder,
              borderRadius: 6,
              cursor: isUsed ? 'default' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              opacity: isUsed ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isUsed) {
                e.currentTarget.style.borderColor = '#1677ff';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isUsed) {
                e.currentTarget.style.borderColor = token.colorBorder;
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
              <div style={{ 
                fontWeight: 600, 
                color: isUsed ? '#8c8c8c' : '#1a1a1a', 
                fontSize: 14 
              }}>
                {item.label}
              </div>
              <div style={{ color: '#bfbfbf', fontSize: 11, fontFamily: 'monospace' }}>{item.key}</div>
            </div>
            {isUsed && (
              <div style={{ color: '#52c41a', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                <CheckCircleOutlined />
                <span>{t('pages.system.printTemplatesDesign.added')}</span>
              </div>
            )}
          </div>
        );
      })}
      {filteredVariables.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
          {t('pages.system.printTemplatesDesign.noMatchField')}
        </div>
      )}
    </div>
  ), [filteredVariables, usedKeys, handleAddVariable, token, t]);



  if (loading) {
    return <div style={{ padding: 20 }}>{t('pages.system.printTemplatesDesign.loading')}</div>;
  }

  return (
    <div style={{ height: 'calc(100vh - 48px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <CanvasPageTemplate
        functionalTitle={t('pages.system.printTemplatesDesign.functionalTitle')}
        toolbar={
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
                {t('pages.system.printTemplatesDesign.back')}
              </Button>
              <Title level={5} style={{ margin: 0 }}>
                {templateName || t('pages.system.printTemplatesDesign.designTemplate')}
              </Title>
            </Space>
            <Space>
              <Button icon={<SettingOutlined />} onClick={handleOpenPageSettings}>
                {t('pages.system.printTemplatesDesign.pageSettings')}
              </Button>
              <Button icon={<EyeOutlined />} onClick={handlePreview}>
                {t('pages.system.printTemplatesDesign.preview')}
              </Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
                {t('pages.system.printTemplatesDesign.save')}
              </Button>
            </Space>
          </Space>
        }
        canvas={
          initialTemplate !== null ? (
            <PdfmeDesigner 
              ref={editorRef} 
              template={initialTemplate} 
              onChange={updateUsedKeys}
            />
          ) : null
        }
        canvasMinHeight={500}
        rightPanel={{
          title: t('pages.system.printTemplatesDesign.availableVariables'),
          children: (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
              <div style={{ padding: '4px 0' }}>
                <Input.Search 
                  placeholder={t('pages.system.printTemplatesDesign.searchFieldPlaceholder')} 
                  allowClear 
                  onSearch={setVarSearchText}
                  onChange={(e) => setVarSearchText(e.target.value)}
                />
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                {variableItemsList}
              </div>
              <div style={{ fontSize: 12, color: '#8c8c8c', background: '#fafafa', padding: 8, borderRadius: 4 }}>
                {t('pages.system.printTemplatesDesign.variableHint')}
              </div>
            </div>
          )
        }}
      />
      <Modal
        title={t('pages.system.printTemplatesDesign.modalPageSettings')}
        open={pageSettingsOpen}
        onCancel={() => {
          setPageSettingsOpen(false);
          setUploadedBasePdfFile(null);
        }}
        onOk={handleApplyPageSettings}
        okText={t('pages.system.printTemplatesDesign.apply')}
        cancelText={t('pages.system.printTemplatesDesign.cancel')}
        width={480}
      >
        <Form form={pageSettingsForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="basePdfSource" label={t('pages.system.printTemplatesDesign.basePdfLabel')}>
            <Select
              options={[
                { label: t('pages.system.printTemplatesDesign.optionBlank'), value: 'blank' },
                { label: t('pages.system.printTemplatesDesign.optionCustom'), value: 'custom' },
              ]}
            />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.basePdfSource !== curr.basePdfSource}
          >
            {({ getFieldValue }) =>
              getFieldValue('basePdfSource') === 'blank' ? (
                <>
                  <Form.Item name="paperPreset" label={t('pages.system.printTemplatesDesign.paperPreset')}>
                    <Select
                      options={PAPER_PRESETS.map((p) => ({ label: p.label, value: p.id }))}
                      onChange={(id) => {
                        if (id !== 'custom') {
                          const preset = PAPER_PRESETS.find((x) => x.id === id);
                          if (preset) {
                            pageSettingsForm.setFieldsValue({
                              customWidth: preset.width,
                              customHeight: preset.height,
                            });
                          }
                        }
                      }}
                    />
                  </Form.Item>
                  <Form.Item
                    noStyle
                    shouldUpdate={(prev, curr) => prev.paperPreset !== curr.paperPreset}
                  >
                    {({ getFieldValue: gf }) =>
                      gf('paperPreset') === 'custom' ? (
                        <Space style={{ width: '100%' }} wrap>
                          <Form.Item name="customWidth" label={t('pages.system.printTemplatesDesign.widthMm')} rules={[{ required: true }]}>
                            <InputNumber min={50} max={500} style={{ width: 120 }} />
                          </Form.Item>
                          <Form.Item name="customHeight" label={t('pages.system.printTemplatesDesign.heightMm')} rules={[{ required: true }]}>
                            <InputNumber min={50} max={600} style={{ width: 120 }} />
                          </Form.Item>
                        </Space>
                      ) : null
                    }
                  </Form.Item>
                  <Form.Item label={t('pages.system.printTemplatesDesign.marginMm')} style={{ marginTop: 16 }}>
                    <Space wrap size="middle">
                      <Form.Item name="paddingTop" label={t('pages.system.printTemplatesDesign.marginTop')} style={{ marginBottom: 0 }}>
                        <InputNumber min={0} max={50} style={{ width: 90 }} />
                      </Form.Item>
                      <Form.Item name="paddingRight" label={t('pages.system.printTemplatesDesign.marginRight')} style={{ marginBottom: 0 }}>
                        <InputNumber min={0} max={50} style={{ width: 90 }} />
                      </Form.Item>
                      <Form.Item name="paddingBottom" label={t('pages.system.printTemplatesDesign.marginBottom')} style={{ marginBottom: 0 }}>
                        <InputNumber min={0} max={50} style={{ width: 90 }} />
                      </Form.Item>
                      <Form.Item name="paddingLeft" label={t('pages.system.printTemplatesDesign.marginLeft')} style={{ marginBottom: 0 }}>
                        <InputNumber min={0} max={50} style={{ width: 90 }} />
                      </Form.Item>
                    </Space>
                  </Form.Item>
                  <div style={{ background: '#fafafa', padding: 12, borderRadius: 6, marginTop: 16 }}>
                    <div style={{ fontWeight: 500, marginBottom: 12, fontSize: 13 }}>{t('pages.system.printTemplatesDesign.headerFooterTitle')}</div>
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                      <Form.Item label={t('pages.system.printTemplatesDesign.headerFormat')} style={{ marginBottom: 0 }}>
                        <Space.Compact style={{ width: '100%' }}>
                          <Form.Item name="headerPreset" noStyle>
                            <Select 
                              style={{ width: '40%' }}
                              options={HEADER_PRESETS} 
                              onChange={(v) => {
                                if (v !== 'custom') {
                                  pageSettingsForm.setFieldsValue({ headerText: v });
                                }
                              }}
                            />
                          </Form.Item>
                          <Form.Item name="headerText" noStyle>
                            <Input 
                              placeholder={t('pages.system.printTemplatesDesign.customPlaceholder')} 
                              onChange={() => pageSettingsForm.setFieldsValue({ headerPreset: 'custom' })}
                            />
                          </Form.Item>
                        </Space.Compact>
                      </Form.Item>

                      <Form.Item label={t('pages.system.printTemplatesDesign.footerFormat')} style={{ marginBottom: 0 }}>
                        <Space.Compact style={{ width: '100%' }}>
                          <Form.Item name="footerPreset" noStyle>
                            <Select 
                              style={{ width: '40%' }}
                              options={FOOTER_PRESETS} 
                              onChange={(v) => {
                                if (v !== 'custom') {
                                  pageSettingsForm.setFieldsValue({ footerText: v });
                                }
                              }}
                            />
                          </Form.Item>
                          <Form.Item name="footerText" noStyle>
                            <Input 
                              placeholder={t('pages.system.printTemplatesDesign.customPlaceholder')} 
                              onChange={() => pageSettingsForm.setFieldsValue({ footerPreset: 'custom' })}
                            />
                          </Form.Item>
                        </Space.Compact>
                      </Form.Item>
                      <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                        {t('pages.system.printTemplatesDesign.headerFooterHint')}
                      </div>
                    </Space>
                  </div>
                </>
              ) : (
                <Form.Item
                  label={t('pages.system.printTemplatesDesign.uploadPdf')}
                  extra={t('pages.system.printTemplatesDesign.uploadPdfExtra')}
                >
                  <Upload
                    accept=".pdf,application/pdf"
                    maxCount={1}
                    beforeUpload={(file) => {
                      setUploadedBasePdfFile(file);
                      return false;
                    }}
                    onRemove={() => setUploadedBasePdfFile(null)}
                    fileList={
                      uploadedBasePdfFile
                        ? [{ uid: '-1', name: uploadedBasePdfFile.name, status: 'done' }]
                        : []
                    }
                  >
                    <Button icon={<FilePdfOutlined />}>
                      {basePdfWasCustomOnOpen ? t('pages.system.printTemplatesDesign.replacePdfFile') : t('pages.system.printTemplatesDesign.selectPdfFile')}
                    </Button>
                  </Upload>
                </Form.Item>
              )
            }
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title={templateType ? t('pages.system.printTemplatesDesign.previewTitleWithData') : t('pages.system.printTemplatesDesign.previewTitle')}
        open={previewOpen}
        onCancel={() => {
          setPreviewOpen(false);
          setPreviewTemplate(null);
        }}
        footer={null}
        width="95%"
        destroyOnHidden
        centered
        styles={{ 
          body: { height: '85vh', padding: 0, overflow: 'hidden', background: '#f0f2f5' }
        }}
      >
        {previewOpen && previewTemplate && (
          <div style={{ height: '100%' }}>
            <PdfmePreview
              template={previewTemplate}
              variables={templateType ? getSamplePreviewVariables(templateType) : undefined}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PrintTemplateDesignPage;
