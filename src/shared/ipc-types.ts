/**
 * IPC通信类型定义
 * 为Electron主进程和渲染进程之间的通信提供类型安全
 */

import type { IpcMainEvent } from 'electron';

// 基础IPC消息类型
export interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// 文件操作相关类型
export interface FileOperationResult {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
}

export interface FileIconResult {
  iconPath?: string;
  iconData?: string;
}

export interface FileStatsResult {
  size: number;
  lastModified: string;
  isDirectory: boolean;
  isFile: boolean;
}

// 配置操作相关类型
export interface ConfigOperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface BackupInfo {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  description?: string;
}

// 背景缓存相关类型
export interface CachedImage {
  id: string;
  originalPath: string;
  cachedPath: string;
  size: number;
  width: number;
  height: number;
  format: string;
  createdAt: string;
  lastAccessed: string;
  accessCount: number;
}

export interface CacheStats {
  totalFiles: number;
  totalSize: number;
  oldestFile?: CachedImage;
  newestFile?: CachedImage;
  mostAccessed?: CachedImage;
}

// 日志相关类型
export interface LogQueryOptions {
  startTime?: string;
  endTime?: string;
  levels?: number[];
  categories?: string[];
  sources?: string[];
  keyword?: string;
  regex?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'level' | 'category';
  sortOrder?: 'asc' | 'desc';
}

export interface LogEntry {
  timestamp: string;
  source: string;
  level: number;
  process: {
    type: string;
    pid: number;
    tid?: number;
  };
  module: {
    category: string;
    filename: string;
  };
  message: string;
  transactionId?: string;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  userId?: string;
  sessionId?: string;
}

export interface LogStats {
  totalLogs: number;
  byLevel: Record<number, number>;
  byCategory: Record<string, number>;
  errorCount: number;
  warningCount: number;
  lastUpdated: string;
}

export interface LogErrorTrend {
  date: string;
  count: number;
}

export interface LogTopError {
  message: string;
  count: number;
  lastOccurred: string;
}

export interface BackupListResult {
  backups: BackupInfo[];
  total: number;
}

// 数据库操作相关类型
export interface DatabaseOperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  count?: number;
}

// 系统操作相关类型
export interface SystemInfo {
  platform: string;
  arch: string;
  version: string;
  appVersion: string;
}

export interface AppInfo {
  name: string;
  version: string;
  description: string;
}

// IPC事件类型
export type IPCEventHandler<T = unknown> = (event: IpcMainEvent, ...args: T[]) => Promise<unknown> | unknown;

// 窗口操作类型
export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowState {
  isMaximized: boolean;
  isMinimized: boolean;
  isFullScreen: boolean;
  bounds: WindowBounds;
}

// 主题相关类型
export interface ThemeInfo {
  name: string;
  isDark: boolean;
  colors: Record<string, string>;
}

// 语言相关类型
export interface LanguageInfo {
  code: string;
  name: string;
  nativeName: string;
}

// 错误类型
export interface IPCError {
  code: string;
  message: string;
  stack?: string;
  details?: unknown;
}

// 通用IPC方法签名
export interface IPCMethodSignature<TArgs extends unknown[] = unknown[], TReturn = unknown> {
  (...args: TArgs): Promise<TReturn>;
}

// 配置类型枚举
export type ConfigType = 'app-settings' | 'theme-config' | 'layout-config' | 'i18n-config' | 'user-preferences' | 'background-config';

// 文件添加选项
export interface FileAddOptions {
  category?: string;
  tags?: string[];
  description?: string;
  launchArgs?: string;
  requireAdmin?: boolean;
  workingDirectory?: string;
}

// 分类创建输入
export interface CategoryCreateInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: string;
}

// 分类更新输入
export interface CategoryUpdateInput {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: string;
}

// 主题设置输入
export interface ThemeSetInput {
  name: string;
  isDark: boolean;
  colors: Record<string, string>;
  customCSS?: string;
}

// 国际化设置输入
export interface I18nSetInput {
  language: string;
  autoDetect?: boolean;
  fallbackLanguage?: string;
  dateFormat?: string;
  timeFormat?: string;
  numberFormat?: {
    decimal: string;
    thousands: string;
    currency: string;
  };
}

// Electron app.getPath 参数类型
export type ElectronPathName =
  | 'home'
  | 'appData'
  | 'userData'
  | 'sessionData'
  | 'temp'
  | 'exe'
  | 'module'
  | 'desktop'
  | 'documents'
  | 'downloads'
  | 'music'
  | 'pictures'
  | 'videos'
  | 'recent'
  | 'logs'
  | 'crashDumps';

// 文件查询参数
export interface FileQueryOptions {
  category?: string;
  tags?: string[];
  searchTerm?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'addedAt' | 'lastLaunched' | 'launchCount' | 'sortOrder';
  sortOrder?: 'ASC' | 'DESC';
}

// 主题更新参数
export interface ThemeUpdateOptions {
  name?: string;
  isDark?: boolean;
  colors?: Record<string, string>;
  customCSS?: string;
}

// 文件更新参数
export interface FileUpdateOptions {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  launchArgs?: string;
  requireAdmin?: boolean;
  workingDirectory?: string;
  icon?: string;
}

// 文件API类型
export interface FileAPI {
  selectFile: IPCMethodSignature<[], string>;
  selectFolder: IPCMethodSignature<[], string>;
  selectMultipleFiles: IPCMethodSignature<[], string[]>;
  add: IPCMethodSignature<[string], DatabaseOperationResult>;
  addMultiple: IPCMethodSignature<[string[]], DatabaseOperationResult>;
  remove: IPCMethodSignature<[string], DatabaseOperationResult>;
  getList: IPCMethodSignature<[], DatabaseOperationResult>;
  launch: IPCMethodSignature<[string, string[]?], DatabaseOperationResult>;
  openFile: IPCMethodSignature<[string], FileOperationResult>;
  openFolder: IPCMethodSignature<[string], FileOperationResult>;
  getIcon: IPCMethodSignature<[string], FileIconResult>;
  exists: IPCMethodSignature<[string], boolean>;
  getInfo: IPCMethodSignature<[string], FileStatsResult>;
}

// 配置API类型
export interface ConfigAPI {
  get: IPCMethodSignature<[string], ConfigOperationResult>;
  set: IPCMethodSignature<[string, unknown], ConfigOperationResult>;
  reset: IPCMethodSignature<[string?], ConfigOperationResult>;
  getAppDataPath: IPCMethodSignature<[], string>;
  getConfigPath: IPCMethodSignature<[], string>;
  getBackupList: IPCMethodSignature<[string?], BackupListResult>;
  restoreFromBackup: IPCMethodSignature<[string, string], ConfigOperationResult>;
  read: IPCMethodSignature<[string], ConfigOperationResult>;
  write: IPCMethodSignature<[string, unknown], ConfigOperationResult>;
  exists: IPCMethodSignature<[string], boolean>;
  delete: IPCMethodSignature<[string], ConfigOperationResult>;
  list: IPCMethodSignature<[], ConfigOperationResult>;
}

// 数据库API类型
export interface DatabaseAPI {
  query: IPCMethodSignature<[string, unknown[]], DatabaseOperationResult>;
  execute: IPCMethodSignature<[string, unknown[]], DatabaseOperationResult>;
  transaction: IPCMethodSignature<[Array<{sql: string; params: unknown[]}>], DatabaseOperationResult>;
}

// 系统API类型
export interface SystemAPI {
  openExternal: IPCMethodSignature<[string], FileOperationResult>;
  showInFolder: IPCMethodSignature<[string], FileOperationResult>;
  getSystemInfo: IPCMethodSignature<[], SystemInfo>;
  setAutoLaunch: IPCMethodSignature<[boolean], FileOperationResult>;
}

// 窗口API类型
export interface WindowAPI {
  minimize: IPCMethodSignature<[], void>;
  maximize: IPCMethodSignature<[], void>;
  close: IPCMethodSignature<[], void>;
  hide: () => void;
  show: () => void;
  setAlwaysOnTop: (flag: boolean) => void;
  getSize: IPCMethodSignature<[], { width: number; height: number }>;
  setSize: (width: number, height: number) => void;
}

// 主要的ElectronAPI接口
export interface ElectronAPI {
  file: FileAPI;
  config: ConfigAPI;
  database: DatabaseAPI;
  system: SystemAPI;
  window: WindowAPI;
  theme: {
    get: IPCMethodSignature<[], unknown>;
    set: IPCMethodSignature<[unknown], unknown>;
    reset: IPCMethodSignature<[], unknown>;
    export: IPCMethodSignature<[], unknown>;
    import: IPCMethodSignature<[string], unknown>;
  };
  i18n: {
    getLanguage: IPCMethodSignature<[], string>;
    setLanguage: IPCMethodSignature<[string], unknown>;
    getTranslations: IPCMethodSignature<[string], unknown>;
    getSupportedLanguages: IPCMethodSignature<[], string[]>;
  };
  app: {
    getVersion: IPCMethodSignature<[], string>;
    quit: () => void;
    restart: () => void;
    getPath: IPCMethodSignature<[string], string>;
  };
  logs: {
    query: IPCMethodSignature<[LogQueryOptions?], IPCResponse<LogEntry[]>>;
    search: IPCMethodSignature<[string, LogQueryOptions?], IPCResponse<LogEntry[]>>;
    getStats: IPCMethodSignature<[], IPCResponse<LogStats>>;
    getErrors: IPCMethodSignature<[string?, string?], IPCResponse<LogEntry[]>>;
    getErrorTrends: IPCMethodSignature<[number?], IPCResponse<LogErrorTrend[]>>;
    getTopErrors: IPCMethodSignature<[number?], IPCResponse<LogTopError[]>>;
    cleanup: IPCMethodSignature<[], IPCResponse<void>>;
    export: IPCMethodSignature<[LogQueryOptions?], IPCResponse<{ filePath: string }>>;
  };
  backgroundCache: {
    cacheImage: IPCMethodSignature<[string, Uint8Array, { width: number; height: number; format: string }], IPCResponse<string>>;
    cacheImageWithOriginalName: IPCMethodSignature<[string, Uint8Array, { width: number; height: number; format: string }], IPCResponse<string>>;
    checkFileNameExists: IPCMethodSignature<[string], IPCResponse<boolean>>;
    getAllCachedImages: IPCMethodSignature<[], IPCResponse<CachedImage[]>>;
    renameCachedImage: IPCMethodSignature<[string, string], IPCResponse<string>>;
    getCachedImage: IPCMethodSignature<[string], IPCResponse<CachedImage | null>>;
    removeCachedImage: IPCMethodSignature<[string], IPCResponse<boolean>>;
    getCacheStats: IPCMethodSignature<[], IPCResponse<CacheStats>>;
    clearAllCache: IPCMethodSignature<[], IPCResponse<boolean>>;
    setCacheLimits: IPCMethodSignature<[number, number], IPCResponse<boolean>>;
  };
  networkImage: {
    download: IPCMethodSignature<[string, number?], IPCResponse<Buffer>>;
  };
  on: (channel: string, callback: (...args: unknown[]) => void) => void;
  off: (channel: string, callback: (...args: unknown[]) => void) => void;
  once: (channel: string, callback: (...args: unknown[]) => void) => void;
}

// 全局窗口对象扩展
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
