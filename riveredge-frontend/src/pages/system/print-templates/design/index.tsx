/**
 * 打印模板设计页面（Craft.js 第二轮增强）
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { App, Button, Input, Space, Typography, Card, Select } from 'antd';
import { ArrowLeftOutlined, SaveOutlined, EyeOutlined } from '@ant-design/icons';
import { CanvasPageTemplate } from '../../../../components/layout-templates';
import { compilePrintTemplate, compilePreviewPrintTemplate, getPrintTemplateByUuid, updatePrintTemplate } from '../../../../services/printTemplate';
import { getArrayTableTemplates, getTemplateVariableItems } from '../../../../config/printTemplateSchemas';

const { Title } = Typography;

type DesignerNodeSchema =
  | { id: string; type: 'text'; content: string }
  | { id: string; type: 'field'; key: string; label: string }
  | { id: string; type: 'if'; condition: string; content: string }
  | { id: string; type: 'for'; item: string; collection: string; template: string }
  | { id: string; type: 'detail_table'; collection: string; row_alias: string; columns: Array<{ key: string; label: string }> };

interface DesignerSchema {
  version: string;
  blocks: DesignerNodeSchema[];
}

type SamplePreset = { key: string; label: string; data: Record<string, any> };

const QUOTATION_SAMPLE_PRESETS: SamplePreset[] = [
  {
    key: 'quotation-short',
    label: '报价单-短单',
    data: {
      quotation_code: 'BJ-2026-0001',
      customer_name: '深圳某制造客户',
      quotation_date: '2026-04-25',
      total_amount: 12345.67,
      notes: '交期 7 天，含税含运费。',
      items: [
        {
          material_code: 'MAT-001',
          material_name: '铝合金壳体',
          material_spec: 'A356-T6',
          material_unit: '件',
          quote_quantity: 100,
          unit_price: 12.34,
          total_amount: 1234,
        },
      ],
    },
  },
  {
    key: 'quotation-long',
    label: '报价单-长单(分页压测)',
    data: {
      quotation_code: 'BJ-2026-0099',
      customer_name: '华南电子装备集团有限公司',
      quotation_date: '2026-04-25',
      total_amount: 286420.5,
      notes: '用于测试长明细分页、表头重复、尾部金额对齐。',
      items: Array.from({ length: 35 }).map((_, i) => ({
        material_code: `MAT-${String(i + 1).padStart(3, '0')}`,
        material_name: `高精密结构件-${i + 1}`,
        material_spec: `规格-${(i % 7) + 1}`,
        material_unit: '件',
        quote_quantity: (i + 1) * 3,
        unit_price: Number((8.6 + i * 0.37).toFixed(2)),
        total_amount: Number((((i + 1) * 3) * (8.6 + i * 0.37)).toFixed(2)),
      })),
    },
  },
  {
    key: 'quotation-notes',
    label: '报价单-多行备注',
    data: {
      quotation_code: 'BJ-2026-0108',
      customer_name: '华东自动化设备有限公司',
      quotation_date: '2026-04-25',
      total_amount: 56432,
      notes: '备注第一行：本报价含13%增值税。\n备注第二行：付款方式月结30天。\n备注第三行：如需开模费用请另行确认。\n备注第四行：报价有效期15天。',
      items: [
        {
          material_code: 'MAT-110',
          material_name: '控制面板总成',
          material_spec: 'CP-20',
          material_unit: '套',
          quote_quantity: 20,
          unit_price: 688.5,
          total_amount: 13770,
        },
        {
          material_code: 'MAT-111',
          material_name: '支架组件',
          material_spec: 'BR-07',
          material_unit: '套',
          quote_quantity: 50,
          unit_price: 293.24,
          total_amount: 14662,
        },
      ],
    },
  },
];

const SALES_ORDER_SAMPLE_PRESETS: SamplePreset[] = [
  {
    key: 'sales-order-default',
    label: '销售订单-标准样本',
    data: {
      order_code: 'SO-2026-0012',
      customer_name: '华北装备制造有限公司',
      order_date: '2026-04-25',
      delivery_date: '2026-05-03',
      total_amount: 98650.2,
      notes: '请按生产排期分批交付。',
      items: [
        { material_code: 'SOM-001', material_name: '装配底座', material_spec: 'DZ-01', material_unit: '件', order_quantity: 50, unit_price: 320, total_amount: 16000 },
        { material_code: 'SOM-002', material_name: '定位板', material_spec: 'DW-09', material_unit: '件', order_quantity: 80, unit_price: 180.5, total_amount: 14440 },
      ],
    },
  },
];

const PURCHASE_ORDER_SAMPLE_PRESETS: SamplePreset[] = [
  {
    key: 'purchase-order-default',
    label: '采购订单-标准样本',
    data: {
      order_code: 'PO-2026-0038',
      supplier_name: '苏州金属材料有限公司',
      order_date: '2026-04-25',
      required_date: '2026-05-08',
      total_amount: 46320,
      notes: '来料请附材质证明与质检报告。',
      items: [
        { material_code: 'POM-001', material_name: '不锈钢板', material_spec: '304-2mm', material_unit: '张', ordered_quantity: 120, unit_price: 132, total_amount: 15840 },
        { material_code: 'POM-002', material_name: '六角螺栓', material_spec: 'M8*20', material_unit: '个', ordered_quantity: 5000, unit_price: 2.1, total_amount: 10500 },
      ],
    },
  },
];

const COMMON_SAMPLE_PRESETS: SamplePreset[] = [
  {
    key: 'common-default',
    label: '通用样本',
    data: {
      code: 'DOC-2026-0001',
      name: '示例单据',
      date: '2026-04-25',
      total_amount: 0,
      notes: '请按实际单据字段调整样本 JSON。',
      items: [{ item_code: 'ITEM-001', item_name: '示例项', quantity: 1, unit_price: 0, total_amount: 0 }],
    },
  },
];

const getSamplePresetsByDocType = (docType: string): SamplePreset[] => {
  if (docType === 'quotation') return QUOTATION_SAMPLE_PRESETS;
  if (docType === 'sales_order') return SALES_ORDER_SAMPLE_PRESETS;
  if (docType === 'purchase_order') return PURCHASE_ORDER_SAMPLE_PRESETS;
  return COMMON_SAMPLE_PRESETS;
};

const TextBlock: React.FC<{ text: string; selected?: boolean; onSelect?: () => void }> = ({ text, selected, onSelect }) => {
  return (
    <div
      style={{
        padding: 10,
        border: selected ? '1px solid #1677ff' : '1px dashed #d9d9d9',
        borderRadius: 6,
        marginBottom: 8,
        background: '#fff',
      }}
      onClick={onSelect}
    >
      <div style={{ whiteSpace: 'pre-wrap' }}>{text || '文本块'}</div>
    </div>
  );
};

const FieldBlock: React.FC<{ fieldKey: string; label?: string; selected?: boolean; onSelect?: () => void }> = ({ fieldKey, label, selected, onSelect }) => {
  return (
    <div
      style={{
        padding: 10,
        border: selected ? '1px solid #1677ff' : '1px solid #91caff',
        borderRadius: 6,
        marginBottom: 8,
        background: '#e6f4ff',
      }}
      onClick={onSelect}
    >
      <div style={{ fontWeight: 600 }}>{label || fieldKey}</div>
      <div style={{ fontFamily: 'monospace', color: '#1677ff' }}>{`{{ ${fieldKey} }}`}</div>
    </div>
  );
};

const LogicBlock: React.FC<{ title: string; body: string; selected?: boolean; onSelect?: () => void }> = ({ title, body, selected, onSelect }) => {
  return (
    <div
      style={{
        padding: 10,
        border: selected ? '1px solid #1677ff' : '1px solid #d9d9d9',
        borderRadius: 6,
        marginBottom: 8,
        background: '#fff7e6',
      }}
      onClick={onSelect}
    >
      <div style={{ fontWeight: 600 }}>{title}</div>
      <div style={{ fontFamily: 'monospace', color: '#595959', whiteSpace: 'pre-wrap' }}>{body}</div>
    </div>
  );
};

const CanvasArea: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div style={{ minHeight: 500, padding: 12, background: '#fafafa' }}>
    {children}
  </div>
);

const ToolbarActions: React.FC<{
  onInsertText: () => void;
  onInsertField: (key: string, label: string) => void;
  onInsertFieldToken: (key: string, label: string) => void;
  onInsertIf: () => void;
  onInsertFor: () => void;
  onInsertDetailTable: (collection: string, columns: Array<{ key: string; label: string }>) => void;
  templateType: string;
}> = ({ onInsertText, onInsertField, onInsertFieldToken, onInsertIf, onInsertFor, onInsertDetailTable, templateType }) => {
  const [query, setQuery] = useState('');
  const tableTemplates = useMemo(() => getArrayTableTemplates(templateType), [templateType]);
  const vars = useMemo(() => {
    const all = getTemplateVariableItems(templateType);
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter((v) => v.label.toLowerCase().includes(q) || v.key.toLowerCase().includes(q));
  }, [query, templateType]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Button onClick={onInsertText}>插入文本块</Button>
      <Button onClick={onInsertIf}>插入条件块</Button>
      <Button onClick={onInsertFor}>插入循环块</Button>
      <Select
        placeholder="插入明细表块"
        options={tableTemplates.map((tpl) => ({ label: tpl.label, value: tpl.arrayKey }))}
        onChange={(value) => {
          const picked = tableTemplates.find((x) => x.arrayKey === value);
          if (picked) onInsertDetailTable(picked.arrayKey, picked.columns);
        }}
      />
      <Input.Search
        placeholder="搜索变量"
        allowClear
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div style={{ maxHeight: 420, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 6 }}>
        {vars.map((item) => (
          <div
            key={item.key}
            style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}
            onClick={() => onInsertFieldToken(item.key, item.label)}
          >
            <div style={{ fontWeight: 600 }}>{item.label}</div>
            <div style={{ fontFamily: 'monospace', color: '#8c8c8c' }}>{`{{${item.key}}}`}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PrintTemplateDesignPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [templateType, setTemplateType] = useState<string>('');
  const [templateName, setTemplateName] = useState<string>('');
  const [schemaBlocks, setSchemaBlocks] = useState<DesignerNodeSchema[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [compiledPreview, setCompiledPreview] = useState('');
  const [compileWarnings, setCompileWarnings] = useState<string[]>([]);
  const [selectedSamplePreset, setSelectedSamplePreset] = useState<string>('');
  const [previewDataText, setPreviewDataText] = useState('{}');
  const [renderedHtmlPreview, setRenderedHtmlPreview] = useState('');
  const samplePresets = useMemo(() => getSamplePresetsByDocType(templateType), [templateType]);

  useEffect(() => {
    if (uuid) void loadTemplate();
  }, [uuid]);

  useEffect(() => {
    const first = samplePresets[0];
    if (!first) return;
    setSelectedSamplePreset(first.key);
    setPreviewDataText(JSON.stringify(first.data, null, 2));
  }, [samplePresets]);

  const loadTemplate = async () => {
    if (!uuid) return;
    setLoading(true);
    try {
      const data = await getPrintTemplateByUuid(uuid);
      const docType = data.config?.document_type || data.type || '';
      setTemplateType(docType);
      setTemplateName(data.name);
      const existingSchema = (data.config?.designer_schema as DesignerSchema | undefined) || null;
      if (existingSchema?.blocks?.length) {
        setSchemaBlocks(existingSchema.blocks);
        setSelectedBlockId(existingSchema.blocks[0]?.id ?? null);
      } else {
        const first: DesignerNodeSchema = {
          id: `text-${Date.now()}`,
          type: 'text',
          content: data.content || '请输入文本内容',
        };
        setSchemaBlocks([first]);
        setSelectedBlockId(first.id);
      }
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
      const schema: DesignerSchema = { version: 'v1', blocks: schemaBlocks };
      const compiled = await compilePrintTemplate({
        source_type: 'designer_json',
        source: schema,
        target_engine: 'jinja2',
        document_type: templateType || undefined,
      });
      setCompiledPreview(compiled.compiled_template || '');
      setCompileWarnings(compiled.warnings || []);
      await updatePrintTemplate(uuid, {
        content: compiled.compiled_template,
        config: {
          document_type: templateType || undefined,
          engine: 'jinja2',
          source_type: 'designer_json',
          designer_version: compiled.schema_version || 'v1',
          designer_schema: schema,
        },
      });
      messageApi.success(t('pages.system.printTemplatesDesign.saveSuccess'));
      if (compiled.warnings?.length) {
        messageApi.warning(`模板已保存，编译告警 ${compiled.warnings.length} 条`);
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.printTemplatesDesign.saveFailed'));
    }
  };

  const handleCompilePreview = async () => {
    try {
      setPreviewLoading(true);
      const schema: DesignerSchema = { version: 'v1', blocks: schemaBlocks };
      const compiled = await compilePrintTemplate({
        source_type: 'designer_json',
        source: schema,
        target_engine: 'jinja2',
        document_type: templateType || undefined,
      });
      setCompiledPreview(compiled.compiled_template || '');
      setCompileWarnings(compiled.warnings || []);
      messageApi.success('Uni-Print 编译预览已更新');
    } catch (error: any) {
      messageApi.error(error?.message || '编译预览失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDataPreview = async () => {
    try {
      setPreviewLoading(true);
      let previewData: Record<string, any> = {};
      try {
        previewData = previewDataText.trim() ? JSON.parse(previewDataText) : {};
      } catch {
        messageApi.error('样本数据 JSON 格式错误');
        return;
      }
      const schema: DesignerSchema = { version: 'v1', blocks: schemaBlocks };
      const result = await compilePreviewPrintTemplate({
        source_type: 'designer_json',
        source: schema,
        target_engine: 'jinja2',
        document_type: templateType || undefined,
        preview_data: previewData,
      });
      setCompiledPreview(result.compiled_template || '');
      setCompileWarnings(result.warnings || []);
      setRenderedHtmlPreview(result.rendered_html || '');
      messageApi.success('Uni-Print 数据预览已更新');
    } catch (error: any) {
      messageApi.error(error?.message || '数据预览失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleApplySamplePreset = () => {
    const preset = samplePresets.find((x) => x.key === selectedSamplePreset);
    if (!preset) return;
    setPreviewDataText(JSON.stringify(preset.data, null, 2));
    messageApi.success(`已填充样本：${preset.label}`);
  };

  const handleInsertText = () => {
    const item: DesignerNodeSchema = { id: `text-${Date.now()}`, type: 'text', content: '请输入文本内容' };
    setSchemaBlocks((prev) => [...prev, item]);
    setSelectedBlockId(item.id);
  };

  const handleInsertField = (key: string, label: string) => {
    const item: DesignerNodeSchema = { id: `field-${Date.now()}`, type: 'field', key, label };
    setSchemaBlocks((prev) => [...prev, item]);
    setSelectedBlockId(item.id);
  };

  const handleInsertFieldToken = (key: string, label: string) => {
    const token = `{{ ${key} }}`;
    if (!selectedBlockId) {
      handleInsertField(key, label);
      return;
    }
    let consumed = false;
    setSchemaBlocks((prev) =>
      prev.map((blk) => {
        if (blk.id !== selectedBlockId) return blk;
        if (blk.type === 'text') {
          consumed = true;
          return { ...blk, content: `${blk.content || ''}${blk.content ? '\n' : ''}${token}` };
        }
        if (blk.type === 'if') {
          consumed = true;
          return { ...blk, content: `${blk.content || ''}${blk.content ? '\n' : ''}${token}` };
        }
        if (blk.type === 'for') {
          consumed = true;
          return { ...blk, template: `${blk.template || ''}${blk.template ? '\n' : ''}${token}` };
        }
        return blk;
      }),
    );
    if (consumed) {
      messageApi.success(`已插入变量：${label}`);
    } else {
      handleInsertField(key, label);
      messageApi.info('当前块不支持内嵌变量，已新增字段块');
    }
  };

  const handleInsertIf = () => {
    const item: DesignerNodeSchema = {
      id: `if-${Date.now()}`,
      type: 'if',
      condition: 'status == "已通过"',
      content: '条件满足后显示',
    };
    setSchemaBlocks((prev) => [...prev, item]);
    setSelectedBlockId(item.id);
  };

  const handleInsertFor = () => {
    const item: DesignerNodeSchema = {
      id: `for-${Date.now()}`,
      type: 'for',
      item: 'item',
      collection: 'items',
      template: '<div>{{ item.material_name }} - {{ item.quote_quantity }}</div>',
    };
    setSchemaBlocks((prev) => [...prev, item]);
    setSelectedBlockId(item.id);
  };

  const handleInsertDetailTable = (collection: string, columns: Array<{ key: string; label: string }>) => {
    const item: DesignerNodeSchema = {
      id: `table-${Date.now()}`,
      type: 'detail_table',
      collection,
      row_alias: 'row',
      columns: columns.slice(0, 8),
    };
    setSchemaBlocks((prev) => [...prev, item]);
    setSelectedBlockId(item.id);
  };

  const selectedBlock = useMemo(
    () => schemaBlocks.find((blk) => blk.id === selectedBlockId) || null,
    [schemaBlocks, selectedBlockId],
  );

  const updateSelectedBlock = (patch: Partial<DesignerNodeSchema>) => {
    if (!selectedBlockId) return;
    setSchemaBlocks((prev) =>
      prev.map((blk) => (blk.id === selectedBlockId ? ({ ...blk, ...patch } as DesignerNodeSchema) : blk)),
    );
  };

  const moveSelected = (delta: -1 | 1) => {
    if (!selectedBlockId) return;
    setSchemaBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === selectedBlockId);
      const target = idx + delta;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const copied = [...prev];
      const [it] = copied.splice(idx, 1);
      copied.splice(target, 0, it);
      return copied;
    });
  };

  const removeSelected = () => {
    if (!selectedBlockId) return;
    setSchemaBlocks((prev) => {
      const next = prev.filter((blk) => blk.id !== selectedBlockId);
      setSelectedBlockId(next[0]?.id ?? null);
      return next;
    });
  };

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
            <Space>
              <Button icon={<EyeOutlined />} loading={previewLoading} onClick={handleCompilePreview}>
                编译预览
              </Button>
              <Button loading={previewLoading} onClick={handleDataPreview}>
                数据预览
              </Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
                {t('pages.system.printTemplatesDesign.save')}
              </Button>
            </Space>
          </Space>
        )}
        canvas={(
          <div style={{ height: '100%', padding: 16, background: '#fff' }}>
            <Card size="small" title="画布（Uni-Print）" style={{ height: '100%' }}>
              <CanvasArea>
                {schemaBlocks.length === 0 && (
                  <div style={{ color: '#8c8c8c', padding: 12 }}>当前无块，请先从右侧插入文本块或变量。</div>
                )}
                {schemaBlocks.map((blk) => {
                  if (blk.type === 'text') {
                    return (
                      <TextBlock
                        key={blk.id}
                        text={blk.content}
                        selected={selectedBlockId === blk.id}
                        onSelect={() => setSelectedBlockId(blk.id)}
                      />
                    );
                  }
                  if (blk.type === 'field') {
                    return (
                      <FieldBlock
                        key={blk.id}
                        fieldKey={blk.key}
                        label={blk.label}
                        selected={selectedBlockId === blk.id}
                        onSelect={() => setSelectedBlockId(blk.id)}
                      />
                    );
                  }
                  return (
                    <LogicBlock
                      key={blk.id}
                      title={blk.type === 'if' ? '条件块' : blk.type === 'for' ? '循环块' : '明细表块'}
                      body={
                        blk.type === 'if'
                          ? `{% if ${blk.condition} %}${blk.content}{% endif %}`
                          : blk.type === 'for'
                            ? `{% for ${blk.item} in ${blk.collection} %}${blk.template}{% endfor %}`
                            : `collection=${blk.collection}, columns=${blk.columns.length}`
                      }
                      selected={selectedBlockId === blk.id}
                      onSelect={() => setSelectedBlockId(blk.id)}
                    />
                  );
                })}
              </CanvasArea>
            </Card>
          </div>
        )}
        canvasMinHeight={500}
        rightPanel={{
          title: t('pages.system.printTemplatesDesign.availableVariables'),
          children: (
            <>
              <ToolbarActions
                onInsertText={handleInsertText}
                onInsertField={handleInsertField}
                onInsertFieldToken={handleInsertFieldToken}
                onInsertIf={handleInsertIf}
                onInsertFor={handleInsertFor}
                onInsertDetailTable={handleInsertDetailTable}
                templateType={templateType}
              />
              {(compiledPreview || compileWarnings.length > 0) && (
                <Card size="small" title="Uni-Print 编译预览" style={{ marginTop: 12 }}>
                  {compileWarnings.length > 0 && (
                    <div style={{ marginBottom: 8, color: '#d46b08' }}>
                      告警：{compileWarnings.join('；')}
                    </div>
                  )}
                  <Input.TextArea rows={10} value={compiledPreview} readOnly />
                </Card>
              )}
              <Card size="small" title="Uni-Print 样本数据 (JSON)" style={{ marginTop: 12 }}>
                <Space style={{ marginBottom: 8, width: '100%', justifyContent: 'space-between' }}>
                  <Select
                    style={{ minWidth: 220 }}
                    value={selectedSamplePreset}
                    options={samplePresets.map((x) => ({ label: x.label, value: x.key }))}
                    onChange={setSelectedSamplePreset}
                  />
                  <Button onClick={handleApplySamplePreset}>填充样本</Button>
                </Space>
                <Input.TextArea
                  rows={10}
                  value={previewDataText}
                  onChange={(e) => setPreviewDataText(e.target.value)}
                />
              </Card>
              {renderedHtmlPreview && (
                <Card size="small" title="Uni-Print 数据渲染预览" style={{ marginTop: 12 }}>
                  <div style={{ marginBottom: 8, color: '#8c8c8c' }}>
                    以下为 Jinja 渲染后的 HTML 预览（基于样本数据）。
                  </div>
                  <div
                    style={{
                      border: '1px solid #f0f0f0',
                      borderRadius: 6,
                      background: '#fff',
                      padding: 12,
                      maxHeight: 360,
                      overflow: 'auto',
                    }}
                    dangerouslySetInnerHTML={{ __html: renderedHtmlPreview }}
                  />
                </Card>
              )}
              {selectedBlock && (
                <Card size="small" title="属性面板" style={{ marginTop: 12 }}>
                  <Space direction="vertical" style={{ width: '100%' }} size={8}>
                    <Space>
                      <Button size="small" onClick={() => moveSelected(-1)}>上移</Button>
                      <Button size="small" onClick={() => moveSelected(1)}>下移</Button>
                      <Button size="small" danger onClick={removeSelected}>删除</Button>
                    </Space>
                    {selectedBlock.type === 'text' && (
                      <Input.TextArea
                        rows={4}
                        value={selectedBlock.content}
                        onChange={(e) => updateSelectedBlock({ content: e.target.value })}
                      />
                    )}
                    {selectedBlock.type === 'field' && (
                      <>
                        <Input
                          value={selectedBlock.label}
                          placeholder="标签"
                          onChange={(e) => updateSelectedBlock({ label: e.target.value })}
                        />
                        <Input
                          value={selectedBlock.key}
                          placeholder="字段 key"
                          onChange={(e) => updateSelectedBlock({ key: e.target.value })}
                        />
                      </>
                    )}
                    {selectedBlock.type === 'if' && (
                      <>
                        <Input
                          value={selectedBlock.condition}
                          placeholder='条件，如 status == "已通过"'
                          onChange={(e) => updateSelectedBlock({ condition: e.target.value })}
                        />
                        <Input.TextArea
                          rows={4}
                          value={selectedBlock.content}
                          placeholder="条件成立时输出内容（可含 {{ }}）"
                          onChange={(e) => updateSelectedBlock({ content: e.target.value })}
                        />
                      </>
                    )}
                    {selectedBlock.type === 'for' && (
                      <>
                        <Input
                          value={selectedBlock.item}
                          placeholder="循环变量名"
                          onChange={(e) => updateSelectedBlock({ item: e.target.value })}
                        />
                        <Input
                          value={selectedBlock.collection}
                          placeholder="集合字段，如 items"
                          onChange={(e) => updateSelectedBlock({ collection: e.target.value })}
                        />
                        <Input.TextArea
                          rows={4}
                          value={selectedBlock.template}
                          placeholder="循环体模板"
                          onChange={(e) => updateSelectedBlock({ template: e.target.value })}
                        />
                      </>
                    )}
                    {selectedBlock.type === 'detail_table' && (
                      <>
                        <Input
                          value={selectedBlock.collection}
                          placeholder="集合字段"
                          onChange={(e) => updateSelectedBlock({ collection: e.target.value })}
                        />
                        <Input
                          value={selectedBlock.row_alias}
                          placeholder="行别名"
                          onChange={(e) => updateSelectedBlock({ row_alias: e.target.value })}
                        />
                        <Input.TextArea
                          rows={6}
                          value={selectedBlock.columns.map((c) => `${c.label}:${c.key}`).join('\n')}
                          placeholder="每行 label:key"
                          onChange={(e) => {
                            const columns = e.target.value
                              .split('\n')
                              .map((line) => line.trim())
                              .filter(Boolean)
                              .map((line) => {
                                const [label, key] = line.split(':');
                                return { label: (label || '').trim(), key: (key || '').trim() };
                              })
                              .filter((x) => x.key);
                            updateSelectedBlock({ columns });
                          }}
                        />
                      </>
                    )}
                  </Space>
                </Card>
              )}
            </>
          ),
        }}
      />
    </div>
  );
};

export default PrintTemplateDesignPage;
