/**
 * 打印模板设计页面
 *
 * 使用报表设计器组件进行打印模板设计
 */

import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { App } from 'antd';
import ReportDesigner, { ReportConfig } from '../../../../components/report-designer';
import { getPrintTemplateByUuid, updatePrintTemplate } from '../../../../services/printTemplate';
import { getSchemaByType } from '../../../../configs/printTemplateSchemas';

/**
 * 打印模板设计页面组件
 */
const PrintTemplateDesignPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [config, setConfig] = useState<ReportConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [templateType, setTemplateType] = useState<string>('');

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
    setLoading(true);
    try {
      if (!uuid) return;
      
      const data = await getPrintTemplateByUuid(uuid);
      
      let parsedConfig: ReportConfig;
      try {
        parsedConfig = JSON.parse(data.content);
      } catch (e) {
        // 如果解析失败，使用默认空配置
        parsedConfig = {
          version: '1.0',
          layout: data.config || {},
          components: [],
        };
      }
      
      
      document.title = `设计模板 - ${data.name}`;
      setTemplateType(data.type);

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
      
      setConfig(parsedConfig);
    } catch (error) {
      messageApi.error('加载模板失败');
      // 关闭当前标签页或根据业务需求处理
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理保存
   */
  const handleSave = async (reportConfig: ReportConfig) => {
    if (!uuid) return;

    try {
      const content = JSON.stringify(reportConfig);
      await updatePrintTemplate(uuid, {
        content,
        config: reportConfig.layout,
      });
      messageApi.success('保存成功');
    } catch (error: any) {
      messageApi.error(error.message || '保存失败');
    }
  };

  /**
   * 处理预览
   */
  const handlePreview = (reportConfig: ReportConfig) => {
    // 预览逻辑可以后续完善，目前 ReportDesigner 内部可能有预览
    console.log('Preview config:', reportConfig);
  };

  if (loading) {
    return <div style={{ padding: 20 }}>加载中...</div>;
  }

  if (!config) {
    return <div style={{ padding: 20 }}>无法加载模板配置</div>;
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>
      <ReportDesigner
        initialConfig={config}
        onSave={handleSave}
        dataSchema={getSchemaByType(templateType)}
        onPreview={handlePreview}
      />
    </div>
  );
};

export default PrintTemplateDesignPage;
