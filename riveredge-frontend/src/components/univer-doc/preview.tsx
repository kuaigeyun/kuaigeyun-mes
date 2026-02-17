/**
 * 打印模板预览 - Univer 文档预览 (系统化优化版)
 * 与编辑器共用一套原生渲染逻辑，确保“所见即所得”。
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Univer,
  LocaleType,
  UniverInstanceType,
  ICommandService,
  merge,
} from "@univerjs/core";
import { defaultTheme } from "@univerjs/design";

import { UniverDocsPlugin, SetTextSelectionsOperation } from "@univerjs/docs";
import { UniverDocsUIPlugin, IMEInputCommand } from "@univerjs/docs-ui";
import { UniverRenderEnginePlugin } from "@univerjs/engine-render";
import { UniverUIPlugin } from "@univerjs/ui";
import { UniverFormulaEnginePlugin } from "@univerjs/engine-formula";

import "@univerjs/design/lib/index.css";
import "@univerjs/ui/lib/index.css";
import "@univerjs/docs-ui/lib/index.css";

import zhCN from "@univerjs/design/lib/locale/zh-CN";

interface UniverDocPreviewProps {
  data: any;
  variables?: Record<string, any>;
}

const UNIT_ID = 'SYSTEM_DOC_PREVIEW';

const UniverDocPreview: React.FC<UniverDocPreviewProps> = ({ data, variables }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const univerRef = useRef<Univer | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !data) return;

    // --- 系统化初始化 ---
    const univer = new Univer({
      theme: defaultTheme,
      locale: LocaleType.ZH_CN,
      locales: {
        [LocaleType.ZH_CN]: zhCN,
      },
    });

    univerRef.current = univer;

    // 注册预览所需核心插件
    univer.registerPlugin(UniverRenderEnginePlugin);
    univer.registerPlugin(UniverFormulaEnginePlugin);
    univer.registerPlugin(UniverUIPlugin, {
      container: containerRef.current,
      header: false,
      footer: false,
      toolbar: false, // 预览模式隐藏工具栏
    });
    univer.registerPlugin(UniverDocsPlugin, {
      hasScroll: true,
    });
    univer.registerPlugin(UniverDocsUIPlugin);

    // 准备文档数据
    const docData = JSON.parse(JSON.stringify(data));
    docData.id = UNIT_ID;

    // 强制同步 Preview 的页面配置
    docData.documentStyle = merge({}, docData.documentStyle || {}, {
        pageSize: { width: 595.27, height: 841.89 },
        marginTop: 72, marginBottom: 72, marginLeft: 90, marginRight: 90,
        renderConfig: { isPageMode: true }
    });

    const doc = univer.createUnit(UniverInstanceType.UNIVER_DOC, docData);
    setIsReady(true);

    // 变量替换逻辑 (保持原有功能，但使用稳定触发)
    if (variables) {
      const runSubstitution = async () => {
        try {
          const univerAny = univer as any;
          const injector = univerAny.getInjector ? univerAny.getInjector() : univerAny.__getInjector();
          const commandService = injector.get(ICommandService);
          const snapshot = doc.getSnapshot();
          const body = snapshot.body;
          if (!body || !body.dataStream) return;

          const dataStream = body.dataStream;
          const matches: { start: number; end: number; key: string }[] = [];
          const regex = /\{\{([^}]+)\}\}/g;
          let match;
          while ((match = regex.exec(dataStream)) !== null) {
            matches.push({
              start: match.index,
              end: match.index + match[0].length,
              key: match[1].trim(),
            });
          }

          const reversed = [...matches].reverse();
          for (const m of reversed) {
            const value = resolveValue(m.key, variables);
            const strValue =
              value != null && typeof value === 'object' && !(value instanceof Date)
                ? JSON.stringify(value)
                : String(value ?? '');

            await commandService.executeCommand(SetTextSelectionsOperation.id, {
              unitId: UNIT_ID,
              ranges: [{ startOffset: m.start, endOffset: m.end }],
            });

            await commandService.executeCommand(IMEInputCommand.id, {
              unitId: UNIT_ID,
              newText: strValue,
              oldTextLen: m.end - m.start,
              isCompositionStart: false,
              isCompositionEnd: true,
            });
          }
        } catch (e) {
          console.error("Preview data injection failed:", e);
        }
      };

      setTimeout(runSubstitution, 500);
    }

    return () => {
      univer.dispose();
      univerRef.current = null;
    };
  }, [data, variables]);

  const resolveValue = (key: string, vars: Record<string, unknown>): unknown => {
    const keys = key.split('.');
    let val: unknown = vars;
    for (const k of keys) {
      if (val === undefined || val === null) return '';
      if (typeof val === 'object' && !Array.isArray(val) && k in (val as object)) {
        val = (val as Record<string, unknown>)[k];
      } else if (Array.isArray(val) && /^\d+$/.test(k)) {
        val = val[parseInt(k, 10)];
      } else {
        return '';
      }
    }
    return val;
  };

  return (
    <div className="univer-preview-wrapper" style={{ width: '100%', height: '100%', position: 'relative', background: '#f0f2f5' }}>
      <style>{`
        @media screen {
            .univer-preview-wrapper .univer-render-canvas-container {
                background-color: #f0f2f5 !important;
                padding: 24px 0 !important;
                display: flex !important;
                justify-content: center !important;
            }
            .univer-preview-wrapper .univer-render-canvas-main {
                background-color: #ffffff !important;
                box-shadow: 0 4px 16px rgba(0,0,0,0.1) !important;
            }
        }

        @media print {
            .univer-preview-wrapper {
                background: none !important;
            }
            .univer-preview-wrapper .univer-render-canvas-container {
                background: none !important;
                padding: 0 !important;
                display: block !important;
            }
            .univer-preview-wrapper .univer-render-canvas-main {
                box-shadow: none !important;
                border: none !important;
            }
        }
      `}</style>
      <div 
        ref={containerRef} 
        style={{ width: '100%', height: '100%', overflow: 'hidden' }} 
      />
    </div>
  );
};

export default UniverDocPreview;
