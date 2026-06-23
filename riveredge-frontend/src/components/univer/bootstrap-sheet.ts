/**
 * Univer Sheet 初始化入口（import / export 共用）
 */
import '@univerjs/design/lib/index.css';
import '@univerjs/ui/lib/index.css';
import '@univerjs/sheets-ui/lib/index.css';
import '@univerjs/presets/lib/styles/preset-sheets-core.css';

import { createUniver, defaultTheme, LocaleType, merge } from '@univerjs/presets';
import { IRenderManagerService } from '@univerjs/engine-render';
import { UniverSheetsCorePreset } from '@univerjs/presets/preset-sheets-core';
import UniverPresetSheetsCoreZhCN from '@univerjs/presets/preset-sheets-core/locales/zh-CN';

export type UniverSheetInstance = ReturnType<typeof createUniver>;

export interface CreateUniverSheetOptions {
  containerId: string;
  darkMode?: boolean;
}

export function createUniverSheetInstance(options: CreateUniverSheetOptions): UniverSheetInstance {
  const { containerId, darkMode = false } = options;

  return createUniver({
    locale: LocaleType.ZH_CN,
    locales: {
      [LocaleType.ZH_CN]: merge({}, UniverPresetSheetsCoreZhCN),
    },
    theme: defaultTheme,
    darkMode,
    presets: [
      UniverSheetsCorePreset({
        container: containerId,
      }),
    ],
  });
}

/**
 * @univerjs/sheets-ui 的 SheetsRenderService 在构造器里通过 `Promise.resolve().then(() => this._init())`
 * 注册 workbook→renderer 监听。createWorkbook 及依赖 renderer 的命令须在该 microtask 之后执行。
 */
export function runAfterUniverSheetsRenderServiceInit(run: () => void): void {
  queueMicrotask(run);
}

/** 容器尺寸变化后（如 Modal 全屏）通知 Univer 渲染引擎按当前 DOM 尺寸重排 */
export function relayoutUniverSheet(instance: UniverSheetInstance): void {
  const workbook = instance.univerAPI.getActiveWorkbook();
  if (!workbook) return;

  const unitId = workbook.getId();
  const injector = instance.univer.__getInjector();
  const renderManager = injector.get(IRenderManagerService);
  const renderUnit = renderManager.getRenderById(unitId);
  renderUnit?.engine?.resize();
}
