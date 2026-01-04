/**
 * 报表设计页面
 *
 * 使用报表设计器组件进行报表模板设计
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { App, message, Modal } from 'antd';
import ReportDesigner, { ReportConfig } from '../../../../components/report-designer';
import { apiRequest } from '../../../../services/api';

/**
 * 报表设计页面组件
 */
const ReportDesignPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [config, setConfig] = useState<ReportConfig | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * 加载模板配置
   */
  useEffect(() => {
    if (id) {
      loadTemplate();
    }
  }, [id]);

  /**
   * 加载模板
   */
  const loadTemplate = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/core/reports/templates/${id}`, {
        method: 'GET',
      });
      setConfig(data.config || {
        version: '1.0',
        layout: {},
        components: [],
      });
    } catch (error) {
      messageApi.error('加载模板失败');
      navigate('/system/report-templates');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理保存
   */
  const handleSave = async (reportConfig: ReportConfig) => {
    if (!id) return;

    try {
      await apiRequest(`/core/reports/templates/${id}`, {
        method: 'PUT',
        data: {
          config: reportConfig,
        },
      });
      messageApi.success('保存成功');
    } catch (error) {
      messageApi.error('保存失败');
    }
  };

  /**
   * 处理预览
   */
  const handlePreview = (reportConfig: ReportConfig) => {
    Modal.info({
      title: '报表预览',
      width: 800,
      content: (
        <div>
          <p>预览功能开发中...</p>
          <pre>{JSON.stringify(reportConfig, null, 2)}</pre>
        </div>
      ),
    });
  };

  if (loading || !config) {
    return <div>加载中...</div>;
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ReportDesigner
        initialConfig={config}
        onSave={handleSave}
        onPreview={handlePreview}
      />
    </div>
  );
};

export default ReportDesignPage;

