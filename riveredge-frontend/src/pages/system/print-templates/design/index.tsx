/**
 * 打印模板设计页面
 *
 * 使用画布模板布局：操作条 + 画板（Univer 编辑器）+ 右侧变量面板
 */

import React, { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { App, Button, Flex, Space, theme, Typography } from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import UniverDocEditor, { UniverDocEditorRef } from '../../../../components/univer-doc/editor';
import { CanvasPageTemplate } from '../../../../components/layout-templates';
import { getPrintTemplateByUuid, updatePrintTemplate } from '../../../../services/printTemplate';
import { getTemplateVariableItems } from '../../../../configs/printTemplateSchemas';

const { Title } = Typography;

/**
 * 打印模板设计页面组件
 */
const PrintTemplateDesignPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [initialData, setInitialData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [templateType, setTemplateType] = useState<string>('');
  const [templateName, setTemplateName] = useState<string>('');
  const editorRef = useRef<UniverDocEditorRef>(null);

  /**
   * 加载模板配置
   */
  useEffect(() => {
    if (uuid) {
      loadTemplate();
    }
    // 恢复默认标题
    return () => {
      document.title = 'RiverEdge';
    };
  }, [uuid]);

  /**
   * 加载模板
   */
  const loadTemplate = async () => {
    console.log('[Print Template Design] 开始加载模板, UUID:', uuid);
    setLoading(true);
    try {
      if (!uuid) {
        console.warn('[Print Template Design] UUID 不存在');
        return;
      }
      
      console.log('[Print Template Design] 获取模板数据...');
      const data = await getPrintTemplateByUuid(uuid);
      console.log('[Print Template Design] 模板数据已获取:', data);
      
      let parsedConfig: any;
      try {
        parsedConfig = JSON.parse(data.content);
        console.log('[Print Template Design] 模板内容解析成功:', parsedConfig);
      } catch (e) {
        console.warn('[Print Template Design] 模板内容解析失败，使用空配置:', e);
        // 如果解析失败，使用默认空配置
        parsedConfig = {};
      }

      // 仅当 content 为 Univer 格式（含 body.dataStream）时传给编辑器；否则传 undefined，完全使用 UniverDocs 空文档
      const isUniverFormat =
        parsedConfig &&
        typeof parsedConfig === 'object' &&
        typeof parsedConfig.body?.dataStream === 'string';
      const editorInitialData = isUniverFormat ? parsedConfig : undefined;
      
      console.log('[Print Template Design] 数据格式检查:', {
        isUniverFormat,
        hasBody: !!parsedConfig.body,
        hasDataStream: !!parsedConfig.body?.dataStream,
        editorInitialData: editorInitialData ? '有数据' : '无数据（将使用空文档）'
      });

      document.title = `设计模板 - ${data.name}`;
      setTemplateName(data.name);
      // 优先使用 config.document_type（关联业务单据），设计器据此显示可用变量
      setTemplateType(data.config?.document_type || data.type || '');

      // 更新标签页标题
      const searchParams = new URLSearchParams(location.search || '');
      searchParams.delete('_refresh');
      const cleanSearch = searchParams.toString();
      const tabKey = location.pathname + (cleanSearch ? `?${cleanSearch}` : '');
      
      window.dispatchEvent(new CustomEvent('riveredge:update-tab-title', {
        detail: {
          key: tabKey,
          title: `设计模板 - ${data.name}`
        }
      }));
      
      console.log('[Print Template Design] 设置初始数据:', editorInitialData ?? {});
      setInitialData(editorInitialData ?? {});
      console.log('[Print Template Design] ✅ 模板加载完成');
    } catch (error) {
      console.error('[Print Template Design] ❌ 加载模板失败:', error);
      messageApi.error('加载模板失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理保存
   */
  const handleSave = async () => {
    if (!uuid || !editorRef.current) return;

    try {
      const data = editorRef.current.getData();
      const content = JSON.stringify(data);
      // 同时保存 content 和 config (作为备份或用于旧版渲染)
      // 注意：Univer 的数据结构与旧版 ReportDesigner 不兼容
      // 这里主要依赖 content 字段存储 Univer 的 JSON 数据
      await updatePrintTemplate(uuid, {
        content,
        // config: data, // 可选：如果后端需要 config 字段用于其他用途
      });
      messageApi.success('保存成功');
    } catch (error: any) {
      messageApi.error(error.message || '保存失败');
    }
  };

  /**
   * 处理插入变量
   */
  const handleInsertVariable = (variable: string) => {
    if (editorRef.current) {
      // 插入 {{variable}} 格式
      editorRef.current.insertText(`{{${variable}}}`);
    }
  };

  const variableItems = getTemplateVariableItems(templateType);

  if (loading) {
    return <div style={{ padding: 20 }}>加载中...</div>;
  }

  return (
    <div style={{ height: 'calc(100vh - 48px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <CanvasPageTemplate
        toolbar={
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
                返回
              </Button>
              <Title level={5} style={{ margin: 0 }}>
                {templateName || '设计模板'}
              </Title>
            </Space>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
              保存
            </Button>
          </Space>
        }
        canvas={
          initialData !== null ? (
            <UniverDocEditor
              ref={editorRef}
              initialData={Object.keys(initialData).length > 0 ? initialData : undefined}
            />
          ) : null
        }
        rightPanel={{
          title: '可用变量',
          children: (
            <Flex vertical gap={4}>
              {variableItems.length === 0 ? (
                <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>
                  请在编辑模板时选择「关联业务单据」以显示可用变量
                </span>
              ) : (
                variableItems.map((item) => (
                  <div
                    key={item.key}
                    role="button"
                    tabIndex={0}
                    style={{
                      cursor: 'pointer',
                      padding: '8px',
                      borderRadius: '4px',
                      transition: 'background 0.3s',
                    }}
                    className="variable-item"
                    onClick={() => handleInsertVariable(item.key)}
                    onKeyDown={(e) => e.key === 'Enter' && handleInsertVariable(item.key)}
                  >
                    <Space orientation="vertical" size={0} style={{ width: '100%' }}>
                      <span style={{ fontWeight: 500 }}>{item.label}</span>
                      <span style={{ fontSize: '12px', color: token.colorTextSecondary }}>
                        {item.key}
                      </span>
                    </Space>
                  </div>
                ))
              )}
            </Flex>
          ),
        }}
        rightPanelWidth={280}
        canvasMinHeight={500}
      />
      <style>{`
        .variable-item:hover {
          background-color: ${token.colorFillTertiary};
        }
      `}</style>
    </div>
  );
};

export default PrintTemplateDesignPage;
