/**
 * 打印模板预览 - pdfme Viewer
 *
 * 使用 pdfme Viewer 展示模板与变量替换后的 PDF 预览
 */

import React, { useEffect, useRef, useState } from 'react';
import { Spin } from 'antd';
import { Viewer } from '@pdfme/ui';
import type { Template } from '@pdfme/common';
import { PDFME_PLUGINS } from './plugins';
import { getPdfmeChineseFont } from './fonts';
import { variablesToPdfmeInputs } from '../../utils/pdfmeTemplateUtils';

interface PdfmePreviewProps {
  template: Template;
  variables?: Record<string, unknown>;
}

const PdfmePreview: React.FC<PdfmePreviewProps> = ({ template, variables = {} }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [fontReady, setFontReady] = useState(false);
  const [fontError, setFontError] = useState<string | null>(null);

  useEffect(() => {
    getPdfmeChineseFont()
      .then(() => setFontReady(true))
      .catch((e) => setFontError(e?.message || '字体加载失败'));
  }, []);

  useEffect(() => {
    if (!containerRef.current || !template || !fontReady) return;

    const inputs = variablesToPdfmeInputs(template, variables);
    let mounted = true;

    getPdfmeChineseFont().then((font) => {
      if (!mounted || !containerRef.current) return;
      
      // 清空容器，防止重复创建导致的重叠
      containerRef.current.innerHTML = '';
      
      const viewer = new Viewer({
        domContainer: containerRef.current,
        template,
        inputs,
        plugins: PDFME_PLUGINS as any,
        options: { lang: 'zh', font },
      });

      viewerRef.current = viewer;
    });

    return () => {
      mounted = false;
      const v = viewerRef.current;
      viewerRef.current = null;
      if (v) {
        try { v.destroy(); } catch (e) { /* ignore */ }
      }
    };
  }, [template, JSON.stringify(variables), fontReady]);

  if (fontError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, color: '#ff4d4f' }}>
        字体加载失败：{fontError}
      </div>
    );
  }

  if (!fontReady) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <Spin tip="加载渲染引擎中..." />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="pdfme-preview-container"
      style={{
        width: '100%',
        height: '100%',
        background: '#f0f2f5',
        display: 'flex',
        flexDirection: 'column',
      }}
    />
  );
};

export default PdfmePreview;
