import { inspectClientPackage } from '../services/clientRelease';

export type ClientPackageMetadata = {
  app_version: string;
  version_code: number;
  package_name?: string;
  runtime_version: string;
  source: 'apk' | 'filename';
};

const FILENAME_APK_RE =
  /(?:^|[/\\])(?:[\w.-]+-)?(\d+\.\d+\.\d+)-build(\d+)(?:-[\w.-]+)?\.apk$/i;

function parseVersionFromFilename(filename: string): ClientPackageMetadata | null {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  const match = FILENAME_APK_RE.exec(base);
  if (!match) return null;
  const versionCode = Number(match[2]);
  if (!Number.isFinite(versionCode) || versionCode <= 0) return null;
  const appVersion = match[1];
  return {
    app_version: appVersion,
    version_code: versionCode,
    runtime_version: appVersion,
    source: 'filename',
  };
}

async function parseAndroidApk(file: File, platform: string): Promise<ClientPackageMetadata | null> {
  try {
    const result = await inspectClientPackage(platform, file, file.name);
    const appVersion = String(result.app_version ?? '').trim();
    const versionCode = Number(result.version_code ?? 0);
    if (!appVersion || !Number.isFinite(versionCode) || versionCode <= 0) {
      return null;
    }
    return {
      app_version: appVersion,
      version_code: versionCode,
      package_name: result.package_name ? String(result.package_name) : undefined,
      runtime_version: String(result.runtime_version ?? appVersion).trim() || appVersion,
      source: 'apk',
    };
  } catch {
    return null;
  }
}

/** 从安装包文件识别版本号与 Android versionCode。 */
export async function parseClientPackageMetadata(
  file: File,
  platform: string,
): Promise<ClientPackageMetadata | null> {
  const lowerName = file.name.toLowerCase();
  if (platform === 'android' && lowerName.endsWith('.apk')) {
    const fromApk = await parseAndroidApk(file, platform);
    if (fromApk) return fromApk;
  }
  if (lowerName.endsWith('.apk')) {
    return parseVersionFromFilename(file.name);
  }
  return null;
}
