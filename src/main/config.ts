import { join } from 'path';
import { app } from 'electron';
import { existsSync, mkdirSync } from 'fs';
import log from 'electron-log';
import { CONFIG_PATHS } from '@shared/config-schemas';

// 获取应用数据目录路径（统一使用Electron API）
export function getAppDataPath(): string {
  return join(app.getPath('appData'), CONFIG_PATHS.APP_DATA_DIR);
}

// 向后兼容的常量（已弃用，建议使用getAppDataPath()函数）
// 注意：这个常量只能在app.whenReady()之后使用
export let APP_DATA_PATH: string;

// 确保应用数据目录存在
export function ensureAppDataDirectory(): void {
  const appDataPath = getAppDataPath();
  if (!existsSync(appDataPath)) {
    mkdirSync(appDataPath, { recursive: true });
    log.info('Created app data directory:', appDataPath);
  }
}

// 获取子目录路径的函数
export function getConfigDir(): string {
  return join(getAppDataPath(), CONFIG_PATHS.CONFIG_DIR);
}

export function getCacheDir(): string {
  return join(getAppDataPath(), CONFIG_PATHS.CACHE_DIR);
}

export function getLogsDir(): string {
  return join(getAppDataPath(), CONFIG_PATHS.LOGS_DIR);
}

export function getI18nDir(): string {
  return join(getAppDataPath(), CONFIG_PATHS.I18N_DIR);
}

// 向后兼容的常量（已弃用，建议使用对应的函数）
// 注意：这些常量只能在app.whenReady()之后使用
export let CONFIG_DIR: string;
export let CACHE_DIR: string;
export let LOGS_DIR: string;
export let I18N_DIR: string;

// 确保所有子目录存在
export function ensureSubDirectories(): void {
  const dirs = [getConfigDir(), getCacheDir(), getLogsDir(), getI18nDir()];

  dirs.forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      log.info('Created directory:', dir);
    }
  });
}

// 获取配置文件路径的函数
export function getConfigFiles() {
  const configDir = getConfigDir();
  return {
    APP_SETTINGS: join(configDir, CONFIG_PATHS.APP_SETTINGS),
    THEME_CONFIG: join(configDir, CONFIG_PATHS.THEME_CONFIG),
    LAYOUT_CONFIG: join(configDir, CONFIG_PATHS.LAYOUT_CONFIG),
    I18N_CONFIG: join(configDir, CONFIG_PATHS.I18N_CONFIG),
    USER_PREFERENCES: join(configDir, CONFIG_PATHS.USER_PREFERENCES),
    BACKGROUND_CONFIG: join(configDir, CONFIG_PATHS.BACKGROUND_CONFIG),
  };
}

// 获取缓存目录路径的函数
export function getCacheDirs() {
  const cacheDir = getCacheDir();
  return {
    BACKGROUND_IMAGES: join(cacheDir, CONFIG_PATHS.BACKGROUND_IMAGES),
    FILE_ICONS: join(cacheDir, CONFIG_PATHS.FILE_ICONS),
    THUMBNAILS: join(cacheDir, CONFIG_PATHS.THUMBNAILS),
  };
}

// 向后兼容的常量（已弃用，建议使用对应的函数）
// 注意：这些常量只能在app.whenReady()之后使用
export let CONFIG_FILES: ReturnType<typeof getConfigFiles>;
export let CACHE_DIRS: ReturnType<typeof getCacheDirs>;

// 初始化常量值（必须在app.whenReady()之后调用）
export function initializeConstants(): void {
  APP_DATA_PATH = getAppDataPath();
  CONFIG_DIR = getConfigDir();
  CACHE_DIR = getCacheDir();
  LOGS_DIR = getLogsDir();
  I18N_DIR = getI18nDir();
  CONFIG_FILES = getConfigFiles();
  CACHE_DIRS = getCacheDirs();
}

// 初始化所有目录
export function initializeAppDirectories(): void {
  // 首先初始化常量
  initializeConstants();

  ensureAppDataDirectory();
  ensureSubDirectories();

  // 确保缓存子目录存在
  const cacheDirs = getCacheDirs();
  Object.values(cacheDirs).forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      log.info('Created cache directory:', dir);
    }
  });
}
