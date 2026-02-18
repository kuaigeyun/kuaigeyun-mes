/**
 * 打印模板设计器 - pdfme Designer
 *
 * 基于 pdfme 的可视化模板设计，支持文本、表格、图片等 schema
 */

import React, { forwardRef, useImperativeHandle, useRef, useEffect, useState } from 'react';
import { Spin } from 'antd';
import { Designer } from '@pdfme/ui';
import type { Template } from '@pdfme/common';
import { PDFME_PLUGINS } from './plugins';
import { getPdfmeChineseFont } from './fonts';

export interface PdfmeDesignerRef {
  getTemplate: () => Template;
  updateTemplate: (template: Template) => void;
}

interface PdfmeDesignerProps {
  template?: Template;
  onChange?: (template: Template) => void;
}

const PdfmeDesigner = forwardRef<PdfmeDesignerRef, PdfmeDesignerProps>(
  ({ template: initialTemplate, onChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const designerRef = useRef<Designer | null>(null);
    const [fontReady, setFontReady] = useState(false);
    const [fontError, setFontError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      getTemplate: () => {
        if (!designerRef.current) throw new Error('Designer not initialized');
        return designerRef.current.getTemplate();
      },
      updateTemplate: (template: Template) => {
        if (!designerRef.current) throw new Error('Designer not initialized');
        designerRef.current.updateTemplate(template);
      },
    }));

    useEffect(() => {
      getPdfmeChineseFont()
        .then(() => setFontReady(true))
        .catch((e) => setFontError(e?.message ?? '字体加载失败'));
    }, []);

    useEffect(() => {
      if (!containerRef.current || !initialTemplate || !fontReady) return;

      let designer: Designer | null = null;
      let mounted = true;

      getPdfmeChineseFont().then((font) => {
        if (!mounted || !containerRef.current) return;
        
        designer = new Designer({
          domContainer: containerRef.current,
          template: initialTemplate,
          options: {
            zoomLevel: 1,
            sidebarOpen: true,
            lang: 'zh',
            font,
          },
          plugins: PDFME_PLUGINS as any,
        });

        designerRef.current = designer;

        if (onChange) {
          designer.onChangeTemplate((t) => onChange(t));
        }
      });

      return () => {
        mounted = false;
        if (designer) {
          try { designer.destroy(); } catch (e) { /* ignore */ }
        }
        designerRef.current = null;
      };
    }, [fontReady, initialTemplate]);

    if (fontError) {
      return (
        <div style={{ padding: 24, color: '#ff4d4f' }}>
          字体加载失败：{fontError}，请检查 /fonts/noto-serif-sc-22-400-normal.woff 是否存在
        </div>
      );
    }

    if (!fontReady) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 500 }}>
          <Spin tip="加载字体中..." size="large" />
        </div>
      );
    }

    return (
      <div
        className="pdfme-designer-wrapper"
        style={{
          width: '100%',
          height: '100%',
          minHeight: 500,
          background: '#f5f5f5',
          border: '8px solid #4A4A4A',
          borderRadius: '4px',
          boxSizing: 'border-box',
        }}
      >
        <div
          ref={containerRef}
          style={{ width: '100%', height: '100%', boxSizing: 'border-box' }}
        />
      </div>
    );
  }
);

PdfmeDesigner.displayName = 'PdfmeDesigner';

export default React.memo(PdfmeDesigner);
