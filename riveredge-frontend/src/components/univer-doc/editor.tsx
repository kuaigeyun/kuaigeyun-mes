/**
 * 打印模板设计器 - Univer 文档编辑器 (系统化优化版)
 * 遵循 Univer 0.12.x 原生设定，实现稳定的页面模式与交互体验。
 */
import React, { useLayoutEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import {
  UniverInstanceType,
  LocaleType,
  DocumentFlavor,
  merge,
} from '@univerjs/core';

// 预设与插件
import { createUniver, defaultTheme } from '@univerjs/presets';
import { UniverDocsCorePreset } from '@univerjs/presets/preset-docs-core';
import { UniverDocsDrawingPreset } from '@univerjs/presets/preset-docs-drawing';

// 样式：统一引入
import '@univerjs/design/lib/index.css';
import '@univerjs/ui/lib/index.css';
import '@univerjs/docs-ui/lib/index.css';
import '@univerjs/presets/lib/styles/preset-docs-core.css';
import '@univerjs/presets/lib/styles/preset-docs-drawing.css';

import UniverPresetDocsCoreZhCN from '@univerjs/presets/preset-docs-core/locales/zh-CN';
import i18n from '../../config/i18n';
import { EMPTY_UNIVER_DOC } from './constants';

const UNIT_ID = 'SYSTEM_DOC_EDITOR';

const UniverDocEditor = forwardRef<any, { initialData?: any }>(({ initialData }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const univerInstanceRef = useRef<{ univer: any; univerAPI: any } | null>(null);
  const [isReady, setIsReady] = useState(false);

  // 暴露给外部的方法
  useImperativeHandle(ref, () => ({
    getData: () => {
      try {
        return univerInstanceRef.current?.univerAPI.getActiveDocument()?.getSnapshot();
      } catch (e) {
        console.error('[Univer] Fetch data failed', e);
        return null;
      }
    },
    insertText: (text: string) => {
      try {
        univerInstanceRef.current?.univerAPI.getActiveDocument()?.insertText(text);
      } catch (e) {
        console.error('[Univer] Insert text failed', e);
      }
    }
  }));

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    
    const init = async () => {
      if (univerInstanceRef.current) return;
      
      const uniqueId = `univer-doc-container-${Date.now()}`;
      container.id = uniqueId;

      try {
        const lang = i18n?.language || 'zh-CN';
        const univerLocale = lang.startsWith('zh') ? LocaleType.ZH_CN : LocaleType.EN_US;

        const { univer, univerAPI } = createUniver({
          locale: univerLocale,
          locales: { 
            [LocaleType.ZH_CN]: merge({}, UniverPresetDocsCoreZhCN) 
          },
          theme: defaultTheme,
          presets: [
            UniverDocsCorePreset({
              container: uniqueId,
              header: true,
              footer: true,
            }),
            UniverDocsDrawingPreset()
          ],
        });

        // 准备文档数据
        const docData = initialData?.body?.dataStream
            ? { ...JSON.parse(JSON.stringify(initialData)), id: UNIT_ID }
            : { ...JSON.parse(JSON.stringify(EMPTY_UNIVER_DOC)), id: UNIT_ID };

        // --- 关键：系统化原生页面模式配置 ---
        docData.documentStyle = merge({}, docData.documentStyle || {}, {
            pageSize: { 
                width: 595.27, // A4 Width in pt
                height: 841.89 // A4 Height in pt
            },
            marginTop: 72,
            marginBottom: 72,
            marginLeft: 90,
            marginRight: 90,
            documentFlavor: DocumentFlavor.MODERN, // 先设为现代模式，以便编辑区能渲染
            renderConfig: { 
                isPageMode: true 
            }
        });

        univer.createUnit(UniverInstanceType.UNIVER_DOC, docData);
        univerInstanceRef.current = { univer, univerAPI };
        setIsReady(true);

        // 先现代模式创建（编辑区可渲染），再模拟点击切换按钮 → 得到传统模式且编辑区可见
        setTimeout(() => {
          try {
            univerAPI.executeCommand('doc.command.switch-mode', {});
            univerAPI.focus();
            window.dispatchEvent(new Event('resize'));
          } catch(e) {}
        }, 500);

      } catch (err) {
        console.error('[Univer] Initialization Error:', err);
      }
    };

    const timer = setTimeout(init, 300);
    return () => {
      clearTimeout(timer);
      if (univerInstanceRef.current) {
        univerInstanceRef.current.univer.dispose();
        univerInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="univer-optimized-wrapper" style={{ 
      width: '100%', 
      height: 'calc(100vh - 120px)', 
      display: 'flex', 
      flexDirection: 'column',
      position: 'relative',
      background: '#f0f2f5' 
    }}>
      <style>{`
        /* 屏幕显示效果：仿真 A4 纸张 */
        @media screen {
            .univer-optimized-wrapper .univer-render-canvas-container {
                background-color: #f0f2f5 !important;
                padding: 40px 0 !important;
                display: flex !important;
                justify-content: center !important;
            }

            .univer-optimized-wrapper .univer-render-canvas-main {
                background-color: #ffffff !important;
                box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important;
                border: 1px solid #e0e0e0 !important;
            }
        }

        /* 打印输出优化：移除所有 UI 装饰 */
        @media print {
            .univer-optimized-wrapper {
                background: none !important;
                height: auto !important;
            }
            .univer-optimized-wrapper .univer-render-canvas-container {
                background: none !important;
                padding: 0 !important;
                display: block !important;
            }
            .univer-optimized-wrapper .univer-render-canvas-main {
                box-shadow: none !important;
                border: none !important;
                margin: 0 !important;
            }
            /* 隐藏可能存在的滚动条或辅助 UI */
            .univer-optimized-wrapper [class*="ruler"],
            .univer-optimized-wrapper .univer-toolbar,
            .univer-optimized-wrapper .univer-footer {
                display: none !important;
            }
        }
.univer-optimized-wrapper [class*="ruler"] {
            display: block !important;
            visibility: visible !important;
            background: #fff;
        }

        .univer-loading-state {
            position: absolute;
            inset: 0;
            background: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100;
            transition: opacity 0.5s;
            pointer-events: none;
        }
        .univer-ready .univer-loading-state {
            opacity: 0;
        }
      `}</style>

      <div className={`univer-container-outer ${isReady ? 'univer-ready' : ''}`} style={{ flex: 1, position: 'relative' }}>
          {!isReady && (
            <div className="univer-loading-state">
                <span style={{ color: '#1890ff', fontSize: '14px' }}>正在为您准备河岸协同办公编辑器...</span>
            </div>
          )}
          <div 
            ref={containerRef} 
            style={{ width: '100%', height: '100%' }} 
          />
      </div>
    </div>
  );
});

export default UniverDocEditor;
