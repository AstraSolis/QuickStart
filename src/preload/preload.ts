import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI, LogQueryOptions } from '../shared/ipc-types';

// 定义IPC消息类型枚举 - 基于TODO文档中的推荐架构
export enum IPCMessageType {
  FILE_OPERATION = 'file@',
  THEME_SYNC = 'theme@',
  CONFIG_OPERATION = 'config@',
  WINDOW_OPERATION = 'window@',
  SYSTEM_OPERATION = 'system@',
  I18N_OPERATION = 'i18n@',
  ERROR_HANDLER = 'error@',
  APP_OPERATION = 'app@',
  DEV_OPERATION = 'dev@',
  LOG_OPERATION = 'log@',
  BACKGROUND_CACHE_OPERATION = 'background-cache@',
  NETWORK_IMAGE_OPERATION = 'network-image@'
}

// 注意：API接口类型定义已在shared/ipc-types.ts中的ElectronAPI中统一管理
// 这里直接使用导入的ElectronAPI类型，避免重复定义

// 实现安全的API暴露
const electronAPI: ElectronAPI = {
  // 配置管理实现
  config: {
    // 新的配置管理API
    get: (configType: string) =>
      ipcRenderer.invoke(`${IPCMessageType.CONFIG_OPERATION}get`, configType),
    set: (configType: string, data: unknown) =>
      ipcRenderer.invoke(`${IPCMessageType.CONFIG_OPERATION}set`, configType, data),
    reset: (configType?: string) =>
      ipcRenderer.invoke(`${IPCMessageType.CONFIG_OPERATION}reset`, configType),
    getAppDataPath: () =>
      ipcRenderer.invoke(`${IPCMessageType.CONFIG_OPERATION}getAppDataPath`),
    getConfigPath: () =>
      ipcRenderer.invoke(`${IPCMessageType.CONFIG_OPERATION}getConfigPath`),

    // 备份和恢复API
    getBackupList: (configType?: string) =>
      ipcRenderer.invoke(`${IPCMessageType.CONFIG_OPERATION}getBackupList`, configType),
    restoreFromBackup: (backupFilePath: string, configType: string) =>
      ipcRenderer.invoke(`${IPCMessageType.CONFIG_OPERATION}restoreFromBackup`, backupFilePath, configType),

    // 兼容旧的API
    read: (configName: string) =>
      ipcRenderer.invoke(`${IPCMessageType.CONFIG_OPERATION}read`, configName),
    write: (configName: string, data: unknown) =>
      ipcRenderer.invoke(`${IPCMessageType.CONFIG_OPERATION}write`, configName, data),
    exists: (configName: string) =>
      ipcRenderer.invoke(`${IPCMessageType.CONFIG_OPERATION}exists`, configName),
    delete: (configName: string) =>
      ipcRenderer.invoke(`${IPCMessageType.CONFIG_OPERATION}delete`, configName),
    list: () =>
      ipcRenderer.invoke(`${IPCMessageType.CONFIG_OPERATION}list`)
  },
  
  // 文件操作实现
  file: {
    selectFile: () =>
      ipcRenderer.invoke(`${IPCMessageType.FILE_OPERATION}selectFile`),
    selectFolder: () =>
      ipcRenderer.invoke(`${IPCMessageType.FILE_OPERATION}selectFolder`),
    selectMultipleFiles: () =>
      ipcRenderer.invoke(`${IPCMessageType.FILE_OPERATION}selectMultipleFiles`),
    add: (filePath: string) =>
      ipcRenderer.invoke(`${IPCMessageType.FILE_OPERATION}add`, filePath),
    addMultiple: (filePaths: string[]) =>
      ipcRenderer.invoke(`${IPCMessageType.FILE_OPERATION}addMultiple`, filePaths),
    remove: (fileId: string) =>
      ipcRenderer.invoke(`${IPCMessageType.FILE_OPERATION}remove`, fileId),
    getList: () =>
      ipcRenderer.invoke(`${IPCMessageType.FILE_OPERATION}getList`),
    launch: (fileId: string, args?: string[]) =>
      ipcRenderer.invoke(`${IPCMessageType.FILE_OPERATION}launch`, fileId, args),
    openFile: (filePath: string) =>
      ipcRenderer.invoke(`${IPCMessageType.FILE_OPERATION}openFile`, filePath),
    openFolder: (folderPath: string) =>
      ipcRenderer.invoke(`${IPCMessageType.FILE_OPERATION}openFolder`, folderPath),
    getIcon: (filePath: string) =>
      ipcRenderer.invoke(`${IPCMessageType.FILE_OPERATION}getIcon`, filePath),
    exists: (filePath: string) =>
      ipcRenderer.invoke(`${IPCMessageType.FILE_OPERATION}exists`, filePath),
    getInfo: (filePath: string) =>
      ipcRenderer.invoke(`${IPCMessageType.FILE_OPERATION}getInfo`, filePath)
  },
  
  // 主题管理实现
  theme: {
    get: () => 
      ipcRenderer.invoke(`${IPCMessageType.THEME_SYNC}get`),
    set: (theme: unknown) =>
      ipcRenderer.invoke(`${IPCMessageType.THEME_SYNC}set`, theme),
    reset: () => 
      ipcRenderer.invoke(`${IPCMessageType.THEME_SYNC}reset`),
    export: () => 
      ipcRenderer.invoke(`${IPCMessageType.THEME_SYNC}export`),
    import: (themeData: string) => 
      ipcRenderer.invoke(`${IPCMessageType.THEME_SYNC}import`, themeData)
  },
  
  // 窗口操作实现
  window: {
    minimize: async () => { ipcRenderer.send(`${IPCMessageType.WINDOW_OPERATION}minimize`); },
    maximize: async () => { ipcRenderer.send(`${IPCMessageType.WINDOW_OPERATION}maximize`); },
    close: async () => { ipcRenderer.send(`${IPCMessageType.WINDOW_OPERATION}close`); },
    hide: () => ipcRenderer.send(`${IPCMessageType.WINDOW_OPERATION}hide`),
    show: () => ipcRenderer.send(`${IPCMessageType.WINDOW_OPERATION}show`),
    setAlwaysOnTop: (flag: boolean) => 
      ipcRenderer.send(`${IPCMessageType.WINDOW_OPERATION}setAlwaysOnTop`, flag),
    getSize: () => 
      ipcRenderer.invoke(`${IPCMessageType.WINDOW_OPERATION}getSize`),
    setSize: (width: number, height: number) => 
      ipcRenderer.send(`${IPCMessageType.WINDOW_OPERATION}setSize`, width, height)
  },
  
  // 系统操作实现
  system: {
    openExternal: (url: string) => 
      ipcRenderer.invoke(`${IPCMessageType.SYSTEM_OPERATION}openExternal`, url),
    showInFolder: (path: string) => 
      ipcRenderer.invoke(`${IPCMessageType.SYSTEM_OPERATION}showInFolder`, path),
    getSystemInfo: () => 
      ipcRenderer.invoke(`${IPCMessageType.SYSTEM_OPERATION}getSystemInfo`),
    setAutoLaunch: (enable: boolean) => 
      ipcRenderer.invoke(`${IPCMessageType.SYSTEM_OPERATION}setAutoLaunch`, enable)
  },
  
  // 数据库操作实现
  database: {
    query: (sql: string, params: unknown[]) =>
      ipcRenderer.invoke('database@query', sql, params),
    execute: (sql: string, params: unknown[]) =>
      ipcRenderer.invoke('database@execute', sql, params),
    transaction: (operations: Array<{sql: string; params: unknown[]}>) =>
      ipcRenderer.invoke('database@transaction', operations)
  },

  // 国际化实现
  i18n: {
    getLanguage: () =>
      ipcRenderer.invoke(`${IPCMessageType.I18N_OPERATION}getLanguage`),
    setLanguage: (language: string) =>
      ipcRenderer.invoke(`${IPCMessageType.I18N_OPERATION}setLanguage`, language),
    getTranslations: (namespace: string) =>
      ipcRenderer.invoke(`${IPCMessageType.I18N_OPERATION}getTranslations`, namespace),
    getSupportedLanguages: () =>
      ipcRenderer.invoke(`${IPCMessageType.I18N_OPERATION}getSupportedLanguages`)
  },
  
  // 应用程序实现
  app: {
    getVersion: () =>
      ipcRenderer.invoke(`${IPCMessageType.APP_OPERATION}getVersion`),
    quit: () => ipcRenderer.send(`${IPCMessageType.APP_OPERATION}quit`),
    restart: () => ipcRenderer.send(`${IPCMessageType.APP_OPERATION}restart`),
    getPath: (name: string) =>
      ipcRenderer.invoke(`${IPCMessageType.APP_OPERATION}getPath`, name)
  },

  // 日志管理实现
  logs: {
    query: (options?: LogQueryOptions) =>
      ipcRenderer.invoke(`${IPCMessageType.LOG_OPERATION}query`, options),
    search: (keyword: string, options?: LogQueryOptions) =>
      ipcRenderer.invoke(`${IPCMessageType.LOG_OPERATION}search`, keyword, options),
    getStats: () =>
      ipcRenderer.invoke(`${IPCMessageType.LOG_OPERATION}stats`),
    getErrors: (startTime?: string, endTime?: string) =>
      ipcRenderer.invoke(`${IPCMessageType.LOG_OPERATION}errors`, startTime, endTime),
    getErrorTrends: (days?: number) =>
      ipcRenderer.invoke(`${IPCMessageType.LOG_OPERATION}error-trends`, days),
    getTopErrors: (limit?: number) =>
      ipcRenderer.invoke(`${IPCMessageType.LOG_OPERATION}top-errors`, limit),
    cleanup: () =>
      ipcRenderer.invoke(`${IPCMessageType.LOG_OPERATION}cleanup`),
    export: (options?: LogQueryOptions) =>
      ipcRenderer.invoke(`${IPCMessageType.LOG_OPERATION}export`, options)
  },

  // 背景缓存管理实现
  backgroundCache: {
    cacheImage: (originalPath: string, imageBuffer: Uint8Array, metadata: { width: number; height: number; format: string }) =>
      ipcRenderer.invoke(`${IPCMessageType.BACKGROUND_CACHE_OPERATION}cacheImage`, originalPath, imageBuffer, metadata),
    cacheImageWithOriginalName: (originalFileName: string, imageBuffer: Uint8Array, metadata: { width: number; height: number; format: string }) =>
      ipcRenderer.invoke(`${IPCMessageType.BACKGROUND_CACHE_OPERATION}cacheImageWithOriginalName`, originalFileName, imageBuffer, metadata),
    checkFileNameExists: (fileName: string) =>
      ipcRenderer.invoke(`${IPCMessageType.BACKGROUND_CACHE_OPERATION}checkFileNameExists`, fileName),
    getAllCachedImages: () =>
      ipcRenderer.invoke(`${IPCMessageType.BACKGROUND_CACHE_OPERATION}getAllCachedImages`),
    renameCachedImage: (oldFileName: string, newFileName: string) =>
      ipcRenderer.invoke(`${IPCMessageType.BACKGROUND_CACHE_OPERATION}renameCachedImage`, oldFileName, newFileName),
    getCachedImage: (originalPath: string) =>
      ipcRenderer.invoke(`${IPCMessageType.BACKGROUND_CACHE_OPERATION}getCachedImage`, originalPath),
    removeCachedImage: (originalPath: string) =>
      ipcRenderer.invoke(`${IPCMessageType.BACKGROUND_CACHE_OPERATION}removeCachedImage`, originalPath),
    getCacheStats: () =>
      ipcRenderer.invoke(`${IPCMessageType.BACKGROUND_CACHE_OPERATION}getCacheStats`),
    clearAllCache: () =>
      ipcRenderer.invoke(`${IPCMessageType.BACKGROUND_CACHE_OPERATION}clearAllCache`),
    setCacheLimits: (maxSize: number, maxFiles: number) =>
      ipcRenderer.invoke(`${IPCMessageType.BACKGROUND_CACHE_OPERATION}setCacheLimits`, maxSize, maxFiles)
  },

  // 网络图片下载实现
  networkImage: {
    download: (url: string, timeout?: number) =>
      ipcRenderer.invoke(`${IPCMessageType.NETWORK_IMAGE_OPERATION}download`, url, timeout)
  },

  // 事件监听实现
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_, ...args) => callback(...args));
  },
  off: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
  once: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.once(channel, (_, ...args) => callback(...args));
  }
};

// 安全地暴露API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// 清理可能泄露的Node.js全局变量 - 基于安全文档要求
// 注释掉这部分，因为webpack-dev-server需要require函数
// window.addEventListener('DOMContentLoaded', () => {
//   // 移除可能的 Node.js 全局变量
//   delete (window as any).require;
//   delete (window as any).exports;
//   delete (window as any).module;
//   delete (window as any).process;
//   delete (window as any).global;
//   delete (window as any).Buffer;
// });

// 导出类型定义供渲染进程使用
export type { ElectronAPI };
