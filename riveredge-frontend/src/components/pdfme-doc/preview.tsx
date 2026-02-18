/**
 * 打印模板预览 - pdfme Generator + Iframe 方案
 *
 * 使用原生 Generator 生成 PDF 并在 iframe 中展示，提供最稳定的预览效果
 */

import React, { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { generate } from '@pdfme/generator';
import type { Template } from '@pdfme/common';
import { PDFME_PLUGINS } from './plugins';
import { getPdfmeChineseFont } from './fonts';
import { variablesToPdfmeInputs, sanitizeTemplate } from '../../utils/pdfmeTemplateUtils';

interface PdfmePreviewProps {
  template: Template;
  variables?: Record<string, unknown>;
}

const PdfmePreview: React.FC<PdfmePreviewProps> = ({ template, variables = {} }) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let currentUrl: string | null = null;
    let mounted = true;

    const renderPdf = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const font = await getPdfmeChineseFont();
        // 对模板进行加固：补齐缺失的 Table 样式定义，防止 Generator 逻辑崩溃
        const sanitizedTemplate = sanitizeTemplate(template);
        const inputs = variablesToPdfmeInputs(sanitizedTemplate, variables);

        const pdf = await generate({
          template: sanitizedTemplate,
          inputs,
          plugins: PDFME_PLUGINS as any,
          options: { font },
        });

        if (!mounted) return;

        const blob = new Blob([pdf.buffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        // 清理旧 URL 释放内存
        if (currentUrl) URL.revokeObjectURL(currentUrl);
        
        currentUrl = url;
        setPdfUrl(url);
      } catch (err) {
        if (!mounted) return;
        console.error('[pdfme] Generator error:', err);
        setError(err instanceof Error ? err.message : '生成预览失败');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    renderPdf();

    return () => {
      mounted = false;
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [template, JSON.stringify(variables)]);

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 500, color: '#ff4d4f' }}>
        预览生成失败：{error}
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 600, position: 'relative', background: '#f0f2f5' }}>
      {loading && (
        <div style={{ 
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(240, 242, 245, 0.8)' 
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Spin size="large" spinning={true}>
              <div style={{ padding: 20 }} />
            </Spin>
            <span style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>正在生成 PDF 预览...</span>
          </div>
        </div>
      )}
      
      {pdfUrl && !loading && (
        <iframe
          src={`${pdfUrl}#toolbar=0&navpanes=0`}
          title="PDF Preview"
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        />
      )}
    </div>
  );
};

export default PdfmePreview;
