/**
 * Univer Sheet 初始化入口（import / export 共用）
 */
import '@univerjs/design/lib/index.css';
import '@univerjs/ui/lib/index.css';
import '@univerjs/sheets-ui/lib/index.css';
import '@univerjs/presets/lib/styles/preset-sheets-core.css';
import '@univerjs/presets/lib/styles/preset-sheets-data-validation.css';

import { createUniver, defaultTheme, LocaleType, merge } from '@univerjs/presets';
import { IRenderManagerService } from '@univerjs/engine-render';
import { UniverSheetsCorePreset } from '@univerjs/presets/preset-sheets-core';
import UniverPresetSheetsCoreZhCN from '@univerjs/presets/preset-sheets-core/locales/zh-CN';
import { UniverSheetsDataValidationPreset } from '@univerjs/presets/preset-sheets-data-validation';
import UniverPresetSheetsDataValidationZhCN from '@univerjs/presets/preset-sheets-data-validation/locales/zh-CN';

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
      [LocaleType.ZH_CN]: merge(
        {},
        UniverPresetSheetsCoreZhCN,
        UniverPresetSheetsDataValidationZhCN,
      ),
    },
    theme: defaultTheme,
    darkMode,
    presets: [
      UniverSheetsCorePreset({
        container: containerId,
      }),
      UniverSheetsDataValidationPreset(),
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

/**
 * 容器尺寸变化后通知 Univer 按「可见盒」重排。
 *
 * Engine.resize() 用 getComputedStyle(width)；子树若被外层 overflow:hidden 裁切，
 * 画布父级 clientWidth 仍可能是未裁切布局宽，列已被切掉却不出现横滚条。
 * 传入 clipEl（如 .uni-import-sheet-host）时用其 clientWidth 作为视口宽。
 */
export function relayoutUniverSheet(
  instance: UniverSheetInstance,
  clipEl?: HTMLElement | null,
): void {
  const workbook = instance.univerAPI.getActiveWorkbook();
  if (!workbook) return;

  const unitId = workbook.getId();
  const injector = instance.univer.__getInjector();
  const renderManager = injector.get(IRenderManagerService);
  const engine = renderManager.getRenderById(unitId)?.engine as
    | {
        resize?: () => void;
        resizeBySize?: (width: number, height: number) => void;
        getCanvasElement?: () => HTMLCanvasElement | null;
      }
    | undefined;
  if (!engine) return;

  const canvas = typeof engine.getCanvasElement === 'function' ? engine.getCanvasElement() : null;
  const canvasHost = canvas?.parentElement;
  if (typeof engine.resizeBySize === 'function') {
    const width = (clipEl ?? canvasHost)?.clientWidth ?? 0;
    // 高度取画布宿主（不含工具栏/Sheet 栏）；若无则回退 clipEl
    const height = canvasHost?.clientHeight || clipEl?.clientHeight || 0;
    if (width > 0 && height > 0) {
      engine.resizeBySize(width, height);
      return;
    }
  }
  engine.resize?.();
}
