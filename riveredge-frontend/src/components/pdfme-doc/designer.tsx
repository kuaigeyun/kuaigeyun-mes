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
        .catch((e) => setFontError(e?.message || '字体加载失败'));
    }, []);

    // 真正的“一次性”初始化逻辑：确保 11MB 负载仅在启动时发生一次
    useEffect(() => {
      if (!containerRef.current || !initialTemplate || !fontReady || designerRef.current) return;

      let designer: Designer | null = null;
      let mounted = true;

      getPdfmeChineseFont().then((font) => {
        if (!mounted || !containerRef.current) return;
        
        try {
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

          // 仅在必要时同步最简单的信息，绝不全量序列化
          if (onChange) {
            designer.onChangeTemplate((t) => {
              // 关键：不直接传 t 给 React，防止外部触发高开销同步
              onChange(t);
            });
          }
        } catch (err) {
          console.error('[pdfme] FATAL_INIT_ERROR:', err);
        }
      });

      return () => {
        mounted = false;
        if (designer) {
          try { designer.destroy(); } catch (e) { /* ignore */ }
          designerRef.current = null;
        }
      };
    }, [fontReady]); // 仅依赖 fontReady，一旦加载完就再也不动了

    // 严禁在 useEffect 中对比模板！所有更新必须通过 Ref 手动触发
    useImperativeHandle(ref, () => ({
      getTemplate: () => {
        if (!designerRef.current) throw new Error('未初始化');
        return designerRef.current.getTemplate();
      },
      updateTemplate: (template: Template) => {
        if (!designerRef.current) return;
        designerRef.current.updateTemplate(template);
      },
    }));

    // 设计器本身不再受 Props 干扰，是一个纯净的图形容器
    if (fontError) return <div style={{ color: 'red', padding: 20 }}>字体加载失败: {fontError}</div>;
    if (!fontReady) return <div style={{ padding: 40, textAlign: 'center' }}><Spin tip="启动渲染引擎..." spinning={true}><div /></Spin></div>;

    return (
      <div
        className="pdfme-designer-wrapper"
        style={{
          width: '100%',
          height: '100%',
          minHeight: 500,
          background: '#f0f2f5',
          border: '8px solid #4A4A4A',
          borderRadius: '4px',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}
      >
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    );
  }
);

PdfmeDesigner.displayName = 'PdfmeDesigner';

export default React.memo(PdfmeDesigner);
