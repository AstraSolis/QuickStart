import { ipcMain, shell, app, BrowserWindow, dialog } from 'electron';
import { join, extname, basename } from 'path';
import { existsSync, readFileSync, writeFileSync, statSync } from 'fs';
import https from 'https';
import http from 'http';

import { getAppDataPath } from './config';
import { configManager } from './config-manager';
// import { fileManager } from './file-manager'; // 替换为SQLite版本
import { fileManagerDB } from './file-manager-db';
import { categoryDAO } from './category-dao';
import { databaseManager } from './database-manager';
import { backgroundCacheManager } from './background-cache-manager';
import { createMainLogger, LogCategory, LogAnalyzer } from '../shared/logger';
import type {
  ConfigType,
  FileAddOptions,
  CategoryCreateInput,
  CategoryUpdateInput,
  ElectronPathName,
  FileQueryOptions,
  FileUpdateOptions,
  LogEntry as IPCLogEntry
} from '../shared/ipc-types';
import type { LogEntry, LogSource, LogLevel } from '../shared/logger/types';


// 导入i18n系统



// 初始化日志记录器
const logger = createMainLogger({
  logDir: join(getAppDataPath(), 'logs'),
});

// 兼容性辅助函数 - 逐步迁移旧的log调用
// 转换IPC LogEntry到Logger LogEntry
const convertIPCLogToLoggerLog = (ipcLog: IPCLogEntry): LogEntry => {
  return {
    timestamp: ipcLog.timestamp,
    source: ipcLog.source as LogSource,
    level: ipcLog.level as LogLevel,
    process: {
      type: ipcLog.process.type as 'MAIN' | 'RENDERER' | 'WORKER',
      pid: ipcLog.process.pid,
      tid: ipcLog.process.tid,
    },
    module: {
      category: ipcLog.module.category as LogCategory,
      filename: ipcLog.module.filename,
    },
    message: ipcLog.message,
    transactionId: ipcLog.transactionId,
    data: ipcLog.data,
    error: ipcLog.error ? new Error(ipcLog.error.message) : undefined,
    userId: ipcLog.userId,
    sessionId: ipcLog.sessionId,
  };
};

const log = {
  info: (message: string, ...args: unknown[]) => {
    const fullMessage = args.length > 0 ? `${message} ${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')}` : message;
    logger.info(fullMessage, LogCategory.IPC, 'ipc-handlers.ts').catch(console.error);
  },
  error: (message: string, ...args: unknown[]) => {
    const fullMessage = args.length > 0 ? `${message} ${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')}` : message;
    const error = args.find(arg => arg instanceof Error) ?? new Error(fullMessage);
    logger.error(fullMessage, LogCategory.IPC, 'ipc-handlers.ts', undefined, error).catch(console.error);
  },
  warn: (message: string, ...args: unknown[]) => {
    const fullMessage = args.length > 0 ? `${message} ${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')}` : message;
    logger.warn(fullMessage, LogCategory.IPC, 'ipc-handlers.ts').catch(console.error);
  },
  debug: (message: string, ...args: unknown[]) => {
    const fullMessage = args.length > 0 ? `${message} ${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')}` : message;
    logger.debug(fullMessage, LogCategory.IPC, 'ipc-handlers.ts').catch(console.error);
  }
};

// 获取错误消息的辅助函数
const getErrorMessage = (fallback: string): string => {
  return fallback;
};

// IPC消息类型枚举
enum IPCMessageType {
  FILE_OPERATION = 'file@',
  THEME_SYNC = 'theme@',
  CONFIG_OPERATION = 'config@',
  WINDOW_OPERATION = 'window@',
  SYSTEM_OPERATION = 'system@',
  I18N_OPERATION = 'i18n@',
  ERROR_HANDLER = 'error@',
  APP_OPERATION = 'app@',
  DEV_OPERATION = 'dev@',
  DATABASE_OPERATION = 'database@',
  CATEGORY_OPERATION = 'category@',
  LOG_OPERATION = 'log@',
  BACKGROUND_CACHE_OPERATION = 'background-cache@',
  NETWORK_IMAGE_OPERATION = 'network-image@'
}

// 配置文件路径
const CONFIG_DIR = join(getAppDataPath(), 'config');
const CACHE_DIR = join(getAppDataPath(), 'cache');
const I18N_DIR = join(getAppDataPath(), 'i18n');

// 确保目录存在
[CONFIG_DIR, CACHE_DIR, I18N_DIR].forEach(dir => {
  if (!existsSync(dir)) {
    require('fs').mkdirSync(dir, { recursive: true });
  }
});

/**
 * 配置管理处理器 - 使用新的ConfigManager
 */
class ConfigHandler {
  static register() {
    // 获取配置
    ipcMain.handle(`${IPCMessageType.CONFIG_OPERATION}get`, async (_, configType: string) => {
      try {
        const config = configManager.getConfig(configType as ConfigType);
        return {
          success: true,
          data: config
        };
      } catch (error) {
        log.error('Failed to get config:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : getErrorMessage('获取配置失败')
        };
      }
    });

    // 设置配置
    ipcMain.handle(`${IPCMessageType.CONFIG_OPERATION}set`, async (_, configType: string, data: unknown) => {
      try {
        await configManager.setConfig(configType as ConfigType, data as Record<string, unknown>);
        // 只在调试模式下输出详细日志，减少日志噪音
        if (process.env.NODE_ENV === 'development') {
          log.info(`Config updated: ${configType}`);
        }
        return {
          success: true,
          data: true
        };
      } catch (error) {
        log.error('Failed to set config:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : getErrorMessage('设置配置失败')
        };
      }
    });

    // 重置配置
    ipcMain.handle(`${IPCMessageType.CONFIG_OPERATION}reset`, async (_, configType: string) => {
      try {
        await configManager.resetConfig(configType as ConfigType);
        log.info(`Config reset: ${configType}`);
        return {
          success: true,
          data: true
        };
      } catch (error) {
        log.error('Failed to reset config:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to reset config'
        };
      }
    });

    // 获取应用数据目录路径
    ipcMain.handle(`${IPCMessageType.CONFIG_OPERATION}getAppDataPath`, async () => {
      return configManager.getAppDataPath();
    });

    // 获取配置目录路径
    ipcMain.handle(`${IPCMessageType.CONFIG_OPERATION}getConfigPath`, async () => {
      return configManager.getConfigPath();
    });

    // 获取备份列表
    ipcMain.handle(`${IPCMessageType.CONFIG_OPERATION}getBackupList`, async (_, configType?: string) => {
      try {
        const backupList = await configManager.getBackupList(configType);
        // 转换为前端期望的格式
        const convertedBackups = backupList.map(backup => ({
          id: backup.filePath,
          name: backup.filename,
          type: backup.metadata.configType,
          size: backup.size,
          createdAt: new Date(backup.metadata.timestamp).toISOString(),
          description: backup.metadata.description ?? 'Auto backup'
        }));

        return {
          backups: convertedBackups,
          total: convertedBackups.length
        };
      } catch (error) {
        log.error('Failed to get backup list:', error);
        return {
          backups: [],
          total: 0
        };
      }
    });

    // 恢复配置从备份
    ipcMain.handle(`${IPCMessageType.CONFIG_OPERATION}restoreFromBackup`, async (_, backupFilePath: string, configType: string) => {
      try {
        const success = await configManager.restoreFromBackup(backupFilePath, configType as ConfigType);
        if (success) {
          log.info(`Config restored from backup: ${configType}`);
        }
        return success;
      } catch (error) {
        log.error('Failed to restore from backup:', error);
        return false;
      }
    });

    // 监听配置变更事件
    configManager.on('configChanged', (event) => {
      // 向所有渲染进程广播配置变更
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send(`${IPCMessageType.CONFIG_OPERATION}changed`, event);
      });
    });

    // 兼容旧的API - 读取配置
    ipcMain.handle(`${IPCMessageType.CONFIG_OPERATION}read`, async (_, configName: string) => {
      try {
        const configPath = join(CONFIG_DIR, `${configName}.json`);
        if (!existsSync(configPath)) {
          return null;
        }

        const data = readFileSync(configPath, 'utf8');
        return JSON.parse(data);
      } catch (error) {
        log.error('Failed to read config:', error);
        return null;
      }
    });

    // 兼容旧的API - 写入配置
    ipcMain.handle(`${IPCMessageType.CONFIG_OPERATION}write`, async (_, configName: string, data: unknown) => {
      try {
        const configPath = join(CONFIG_DIR, `${configName}.json`);
        writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
        log.info(`Config saved: ${configName}`);
        return true;
      } catch (error) {
        log.error('Failed to write config:', error);
        return false;
      }
    });
  }
}

/**
 * 文件操作处理器 (SQLite版本)
 */
class FileHandler {
  static register() {
    // 检查数据库状态的辅助函数
    const checkDatabaseReady = () => {
      if (!databaseManager.isReady()) {
        throw new Error('Database is not initialized or not ready');
      }
    };

    // 添加文件到列表
    ipcMain.handle(`${IPCMessageType.FILE_OPERATION}add`, async (_, filePath: string, options: FileAddOptions = {}) => {
      try {
        checkDatabaseReady();
        const fileItem = await fileManagerDB.addFile(filePath, options);
        log.info('File added via IPC:', filePath);
        return {
          success: true,
          data: fileItem
        };
      } catch (error) {
        log.error('Failed to add file:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : getErrorMessage('添加文件失败')
        };
      }
    });

    // 批量添加文件
    ipcMain.handle(`${IPCMessageType.FILE_OPERATION}addMultiple`, async (_, filePaths: string[], options: FileAddOptions = {}) => {
      try {
        checkDatabaseReady();
        const fileItems = await fileManagerDB.addFiles(filePaths, options);
        log.info('Multiple files added via IPC:', { count: fileItems.length });
        return {
          success: true,
          data: fileItems
        };
      } catch (error) {
        log.error('Failed to add multiple files:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : getErrorMessage('批量添加文件失败')
        };
      }
    });

    // 获取文件列表
    ipcMain.handle(`${IPCMessageType.FILE_OPERATION}getList`, async () => {
      try {
        checkDatabaseReady();
        const files = fileManagerDB.getAllFiles();
        return {
          success: true,
          data: files
        };
      } catch (error) {
        log.error('Failed to get file list:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : getErrorMessage('获取文件列表失败')
        };
      }
    });

    // 删除文件从列表
    ipcMain.handle(`${IPCMessageType.FILE_OPERATION}remove`, async (_, fileId: string) => {
      try {
        checkDatabaseReady();
        const success = fileManagerDB.deleteFile(fileId);
        log.info('File removed via IPC:', { fileId, success });
        return {
          success: true,
          data: success
        };
      } catch (error) {
        log.error('Failed to remove file:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : getErrorMessage('移除文件失败')
        };
      }
    });

    // 启动文件
    ipcMain.handle(`${IPCMessageType.FILE_OPERATION}launch`, async (_, fileId: string, args: string[] = []) => {
      try {
        checkDatabaseReady();
        const success = await fileManagerDB.launchFile(fileId, args);
        log.info('File launch via IPC:', { fileId, success });
        return {
          success: true,
          data: success
        };
      } catch (error) {
        log.error('Failed to launch file:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : getErrorMessage('启动文件失败')
        };
      }
    });

    // 打开文件
    ipcMain.handle(`${IPCMessageType.FILE_OPERATION}openFile`, async (_, filePath: string) => {
      try {
        await shell.openPath(filePath);
        log.info(`File opened: ${filePath}`);
        return true;
      } catch (error) {
        log.error('Failed to open file:', error);
        return false;
      }
    });

    // 打开文件夹
    ipcMain.handle(`${IPCMessageType.FILE_OPERATION}openFolder`, async (_, folderPath: string) => {
      try {
        await shell.openPath(folderPath);
        log.info(`Folder opened: ${folderPath}`);
        return true;
      } catch (error) {
        log.error('Failed to open folder:', error);
        return false;
      }
    });

    // 获取文件图标
    ipcMain.handle(`${IPCMessageType.FILE_OPERATION}getIcon`, async (_) => {
      // 这里可以实现获取文件图标的逻辑
      // 暂时返回null，后续可以集成Windows Shell API
      return null;
    });

    // 选择文件
    ipcMain.handle(`${IPCMessageType.FILE_OPERATION}selectFile`, async () => {
      try {
        const result = await dialog.showOpenDialog({
          title: '选择文件',
          properties: ['openFile'],
          filters: [
            { name: '可执行文件', extensions: ['exe', 'msi', 'bat', 'cmd'] },
            { name: '所有文件', extensions: ['*'] }
          ]
        });

        if (result.canceled || result.filePaths.length === 0) {
          return null;
        }

        return result.filePaths[0];
      } catch (error) {
        log.error('Failed to select file:', error);
        return null;
      }
    });

    // 更新文件信息
    ipcMain.handle(`${IPCMessageType.FILE_OPERATION}update`, async (_, fileId: string, updates: FileUpdateOptions) => {
      try {
        const success = fileManagerDB.updateFile(fileId, updates);
        log.info('File updated via IPC:', { fileId, success });
        return success;
      } catch (error) {
        log.error('Failed to update file:', error);
        return false;
      }
    });

    // 切换收藏状态
    ipcMain.handle(`${IPCMessageType.FILE_OPERATION}toggleFavorite`, async (_, fileId: string) => {
      try {
        const success = fileManagerDB.toggleFavorite(fileId);
        log.info('File favorite toggled via IPC:', { fileId, success });
        return success;
      } catch (error) {
        log.error('Failed to toggle favorite:', error);
        return false;
      }
    });

    // 切换置顶状态
    ipcMain.handle(`${IPCMessageType.FILE_OPERATION}togglePin`, async (_, fileId: string) => {
      try {
        const success = fileManagerDB.togglePin(fileId);
        log.info('File pin toggled via IPC:', { fileId, success });
        return success;
      } catch (error) {
        log.error('Failed to toggle pin:', error);
        return false;
      }
    });

    // 搜索文件
    ipcMain.handle(`${IPCMessageType.FILE_OPERATION}search`, async (_, searchTerm: string) => {
      try {
        const results = fileManagerDB.searchFiles(searchTerm);
        log.info('File search via IPC:', { searchTerm, count: results.length });
        return results;
      } catch (error) {
        log.error('Failed to search files:', error);
        return [];
      }
    });

    // 获取文件统计
    ipcMain.handle(`${IPCMessageType.FILE_OPERATION}getStats`, async () => {
      try {
        return fileManagerDB.getStats();
      } catch (error) {
        log.error('Failed to get file stats:', error);
        return null;
      }
    });

    // 选择文件夹
    ipcMain.handle(`${IPCMessageType.FILE_OPERATION}selectFolder`, async () => {
      try {
        const result = await dialog.showOpenDialog({
          title: '选择文件夹',
          properties: ['openDirectory']
        });

        if (result.canceled || result.filePaths.length === 0) {
          return null;
        }

        return result.filePaths[0];
      } catch (error) {
        log.error('Failed to select folder:', error);
        return null;
      }
    });

    // 选择多个文件
    ipcMain.handle(`${IPCMessageType.FILE_OPERATION}selectMultipleFiles`, async () => {
      try {
        const result = await dialog.showOpenDialog({
          title: '选择多个文件',
          properties: ['openFile', 'multiSelections'],
          filters: [
            { name: '可执行文件', extensions: ['exe', 'msi', 'bat', 'cmd'] },
            { name: '所有文件', extensions: ['*'] }
          ]
        });

        if (result.canceled) {
          return [];
        }

        return result.filePaths;
      } catch (error) {
        log.error('Failed to select multiple files:', error);
        return [];
      }
    });

    // 检查文件是否存在
    ipcMain.handle(`${IPCMessageType.FILE_OPERATION}exists`, async (_, filePath: string) => {
      return existsSync(filePath);
    });

    // 获取文件信息
    ipcMain.handle(`${IPCMessageType.FILE_OPERATION}getInfo`, async (_, filePath: string) => {
      try {
        if (!existsSync(filePath)) {
          return null;
        }

        const stats = statSync(filePath);
        return {
          name: basename(filePath),
          path: filePath,
          size: stats.size,
          modified: stats.mtime,
          created: stats.birthtime,
          isDirectory: stats.isDirectory(),
          extension: extname(filePath)
        };
      } catch (error) {
        log.error('Failed to get file info:', error);
        return null;
      }
    });
  }
}

/**
 * 窗口操作处理器
 */
class WindowHandler {
  static register() {
    const getMainWindow = () => BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];

    // 最小化窗口
    ipcMain.on(`${IPCMessageType.WINDOW_OPERATION}minimize`, () => {
      const window = getMainWindow();
      if (window) window.minimize();
    });

    // 最大化/还原窗口
    ipcMain.on(`${IPCMessageType.WINDOW_OPERATION}maximize`, () => {
      const window = getMainWindow();
      if (window) {
        if (window.isMaximized()) {
          window.unmaximize();
        } else {
          window.maximize();
        }
      }
    });

    // 关闭窗口
    ipcMain.on(`${IPCMessageType.WINDOW_OPERATION}close`, () => {
      const window = getMainWindow();
      if (window) window.close();
    });

    // 隐藏窗口
    ipcMain.on(`${IPCMessageType.WINDOW_OPERATION}hide`, () => {
      const window = getMainWindow();
      if (window) window.hide();
    });

    // 显示窗口
    ipcMain.on(`${IPCMessageType.WINDOW_OPERATION}show`, () => {
      const window = getMainWindow();
      if (window) {
        window.show();
        window.focus();
      }
    });

    // 设置窗口置顶
    ipcMain.on(`${IPCMessageType.WINDOW_OPERATION}setAlwaysOnTop`, (_, flag: boolean) => {
      const window = getMainWindow();
      if (window) window.setAlwaysOnTop(flag);
    });

    // 获取窗口大小
    ipcMain.handle(`${IPCMessageType.WINDOW_OPERATION}getSize`, async () => {
      const window = getMainWindow();
      return window ? window.getSize() : [800, 600];
    });

    // 设置窗口大小
    ipcMain.on(`${IPCMessageType.WINDOW_OPERATION}setSize`, (_, width: number, height: number) => {
      const window = getMainWindow();
      if (window) window.setSize(width, height);
    });
  }
}

/**
 * 系统操作处理器
 */
class SystemHandler {
  static register() {
    // 打开外部链接
    ipcMain.handle(`${IPCMessageType.SYSTEM_OPERATION}openExternal`, async (_, url: string) => {
      try {
        await shell.openExternal(url);
        return true;
      } catch (error) {
        log.error('Failed to open external URL:', error);
        return false;
      }
    });

    // 在文件管理器中显示
    ipcMain.handle(`${IPCMessageType.SYSTEM_OPERATION}showInFolder`, async (_, path: string) => {
      try {
        shell.showItemInFolder(path);
        return true;
      } catch (error) {
        log.error('Failed to show in folder:', error);
        return false;
      }
    });

    // 获取系统信息
    ipcMain.handle(`${IPCMessageType.SYSTEM_OPERATION}getSystemInfo`, async () => {
      return {
        platform: process.platform,
        arch: process.arch,
        version: process.version,
        appVersion: app.getVersion(),
        appName: app.getName(),
      };
    });

    // 设置开机自启
    ipcMain.handle(`${IPCMessageType.SYSTEM_OPERATION}setAutoLaunch`, async (_, enable: boolean) => {
      try {
        app.setLoginItemSettings({
          openAtLogin: enable,
          openAsHidden: false,
        });
        return true;
      } catch (error) {
        log.error('Failed to set auto launch:', error);
        return false;
      }
    });
  }
}

/**
 * 应用程序操作处理器
 */
class AppHandler {
  static register() {
    // 获取应用版本
    ipcMain.handle(`${IPCMessageType.APP_OPERATION}getVersion`, async () => {
      return app.getVersion();
    });

    // 获取应用名称
    ipcMain.handle(`${IPCMessageType.APP_OPERATION}getName`, async () => {
      return app.getName();
    });

    // 获取应用路径
    ipcMain.handle(`${IPCMessageType.APP_OPERATION}getPath`, async (_, name: string) => {
      return app.getPath(name as ElectronPathName);
    });

    // 退出应用
    ipcMain.on(`${IPCMessageType.APP_OPERATION}quit`, () => {
      app.quit();
    });

    // 重启应用
    ipcMain.on(`${IPCMessageType.APP_OPERATION}relaunch`, () => {
      app.relaunch();
      app.exit();
    });

    // 检查是否为打包版本
    ipcMain.handle(`${IPCMessageType.APP_OPERATION}isPackaged`, async () => {
      return app.isPackaged;
    });
  }
}

/**
 * 数据库文件管理处理器
 */
class DatabaseFileHandler {
  static register() {
    // 添加文件到数据库
    ipcMain.handle(`${IPCMessageType.DATABASE_OPERATION}addFile`, async (_, filePath: string, options: FileAddOptions = {}) => {
      try {
        const fileItem = await fileManagerDB.addFile(filePath, options);
        log.info('File added to database:', filePath);
        return fileItem;
      } catch (error) {
        log.error('Failed to add file to database:', error);
        return null;
      }
    });

    // 批量添加文件
    ipcMain.handle(`${IPCMessageType.DATABASE_OPERATION}addFiles`, async (_, filePaths: string[], options: FileAddOptions = {}) => {
      try {
        const fileItems = await fileManagerDB.addFiles(filePaths, options);
        log.info('Files added to database:', { count: fileItems.length });
        return fileItems;
      } catch (error) {
        log.error('Failed to add files to database:', error);
        return [];
      }
    });

    // 获取所有文件
    ipcMain.handle(`${IPCMessageType.DATABASE_OPERATION}getAllFiles`, async () => {
      try {
        return fileManagerDB.getAllFiles();
      } catch (error) {
        log.error('Failed to get all files:', error);
        return [];
      }
    });

    // 查询文件
    ipcMain.handle(`${IPCMessageType.DATABASE_OPERATION}queryFiles`, async (_, query: FileQueryOptions) => {
      try {
        return fileManagerDB.queryFiles(query);
      } catch (error) {
        log.error('Failed to query files:', error);
        return [];
      }
    });

    // 获取文件详情
    ipcMain.handle(`${IPCMessageType.DATABASE_OPERATION}getFile`, async (_, id: string) => {
      try {
        return fileManagerDB.getFileById(id);
      } catch (error) {
        log.error('Failed to get file:', error);
        return null;
      }
    });

    // 更新文件
    ipcMain.handle(`${IPCMessageType.DATABASE_OPERATION}updateFile`, async (_, id: string, updates: FileUpdateOptions) => {
      try {
        const success = fileManagerDB.updateFile(id, updates);
        log.info('File updated:', { id, success });
        return success;
      } catch (error) {
        log.error('Failed to update file:', error);
        return false;
      }
    });

    // 删除文件
    ipcMain.handle(`${IPCMessageType.DATABASE_OPERATION}deleteFile`, async (_, id: string) => {
      try {
        const success = fileManagerDB.deleteFile(id);
        log.info('File deleted:', { id, success });
        return success;
      } catch (error) {
        log.error('Failed to delete file:', error);
        return false;
      }
    });

    // 启动文件
    ipcMain.handle(`${IPCMessageType.DATABASE_OPERATION}launchFile`, async (_, id: string, customArgs?: string[]) => {
      try {
        const success = await fileManagerDB.launchFile(id, customArgs);
        log.info('File launch result:', { id, success });
        return success;
      } catch (error) {
        log.error('Failed to launch file:', error);
        return false;
      }
    });

    // 切换收藏状态
    ipcMain.handle(`${IPCMessageType.DATABASE_OPERATION}toggleFavorite`, async (_, id: string) => {
      try {
        return fileManagerDB.toggleFavorite(id);
      } catch (error) {
        log.error('Failed to toggle favorite:', error);
        return false;
      }
    });

    // 切换置顶状态
    ipcMain.handle(`${IPCMessageType.DATABASE_OPERATION}togglePin`, async (_, id: string) => {
      try {
        return fileManagerDB.togglePin(id);
      } catch (error) {
        log.error('Failed to toggle pin:', error);
        return false;
      }
    });

    // 搜索文件
    ipcMain.handle(`${IPCMessageType.DATABASE_OPERATION}searchFiles`, async (_, searchTerm: string) => {
      try {
        return fileManagerDB.searchFiles(searchTerm);
      } catch (error) {
        log.error('Failed to search files:', error);
        return [];
      }
    });

    // 获取启动历史
    ipcMain.handle(`${IPCMessageType.DATABASE_OPERATION}getLaunchHistory`, async (_, id: string, limit?: number) => {
      try {
        return fileManagerDB.getLaunchHistory(id, limit);
      } catch (error) {
        log.error('Failed to get launch history:', error);
        return [];
      }
    });

    // 获取统计信息
    ipcMain.handle(`${IPCMessageType.DATABASE_OPERATION}getStats`, async () => {
      try {
        return fileManagerDB.getStats();
      } catch (error) {
        log.error('Failed to get stats:', error);
        return null;
      }
    });

    // 数据库备份
    ipcMain.handle(`${IPCMessageType.DATABASE_OPERATION}backup`, async (_, backupPath: string) => {
      try {
        await databaseManager.backup(backupPath);
        log.info('Database backup completed:', backupPath);
        return true;
      } catch (error) {
        log.error('Database backup failed:', error);
        return false;
      }
    });
  }
}

/**
 * 分类管理处理器
 */
class CategoryHandler {
  static register() {
    // 获取所有分类
    ipcMain.handle(`${IPCMessageType.CATEGORY_OPERATION}getAll`, async () => {
      try {
        return categoryDAO.getAllCategories();
      } catch (error) {
        log.error('Failed to get categories:', error);
        return [];
      }
    });

    // 创建分类
    ipcMain.handle(`${IPCMessageType.CATEGORY_OPERATION}create`, async (_, input: CategoryCreateInput) => {
      try {
        const category = categoryDAO.createCategory(input);
        log.info('Category created:', category);
        return category;
      } catch (error) {
        log.error('Failed to create category:', error);
        return null;
      }
    });

    // 更新分类
    ipcMain.handle(`${IPCMessageType.CATEGORY_OPERATION}update`, async (_, id: number, input: CategoryUpdateInput) => {
      try {
        const success = categoryDAO.updateCategory(id, input);
        log.info('Category updated:', { id, success });
        return success;
      } catch (error) {
        log.error('Failed to update category:', error);
        return false;
      }
    });

    // 删除分类
    ipcMain.handle(`${IPCMessageType.CATEGORY_OPERATION}delete`, async (_, id: number) => {
      try {
        const success = categoryDAO.deleteCategory(id);
        log.info('Category deleted:', { id, success });
        return success;
      } catch (error) {
        log.error('Failed to delete category:', error);
        return false;
      }
    });

    // 获取分类统计
    ipcMain.handle(`${IPCMessageType.CATEGORY_OPERATION}getStats`, async () => {
      try {
        return categoryDAO.getCategoryStats();
      } catch (error) {
        log.error('Failed to get category stats:', error);
        return [];
      }
    });

    // 重新排序分类
    ipcMain.handle(`${IPCMessageType.CATEGORY_OPERATION}reorder`, async (_, categoryIds: number[]) => {
      try {
        const success = categoryDAO.reorderCategories(categoryIds);
        log.info('Categories reordered:', { success });
        return success;
      } catch (error) {
        log.error('Failed to reorder categories:', error);
        return false;
      }
    });
  }
}

/**
 * 日志操作处理器
 */
class LogHandler {
  static register() {
    // 查询日志
    ipcMain.handle(`${IPCMessageType.LOG_OPERATION}query`, async (event, options) => {
      try {
        await logger.debug('IPC消息接收: log@query', LogCategory.IPC, 'ipc-handlers.ts');

        const logAnalyzer = new LogAnalyzer(join(getAppDataPath(), 'logs'));
        const logs = await logAnalyzer.queryLogs(options);

        await logger.debug(`日志查询返回 ${logs.length} 条记录`, LogCategory.IPC, 'ipc-handlers.ts');
        return { success: true, data: logs };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error(`日志查询失败: ${errorMessage}`, LogCategory.IPC, 'ipc-handlers.ts', undefined, error instanceof Error ? error : new Error(errorMessage));
        return { success: false, error: errorMessage };
      }
    });

    // 获取日志统计
    ipcMain.handle(`${IPCMessageType.LOG_OPERATION}stats`, async () => {
      try {
        await logger.debug('IPC消息接收: log@stats', LogCategory.IPC, 'ipc-handlers.ts');

        const logAnalyzer = new LogAnalyzer(join(getAppDataPath(), 'logs'));
        const stats = await logAnalyzer.getLogStats();

        return { success: true, data: stats };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error(`日志统计失败: ${errorMessage}`, LogCategory.IPC, 'ipc-handlers.ts', undefined, error instanceof Error ? error : new Error(errorMessage));
        return { success: false, error: errorMessage };
      }
    });

    // 搜索日志
    ipcMain.handle(`${IPCMessageType.LOG_OPERATION}search`, async (event, keyword, options) => {
      try {
        await logger.debug('IPC消息接收: log@search', LogCategory.IPC, 'ipc-handlers.ts');

        const logAnalyzer = new LogAnalyzer(join(getAppDataPath(), 'logs'));
        const logs = await logAnalyzer.searchLogs(keyword, options);

        await logger.debug(`日志搜索 "${keyword}" 返回 ${logs.length} 条记录`, LogCategory.IPC, 'ipc-handlers.ts');
        return { success: true, data: logs };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error(`日志搜索失败: ${errorMessage}`, LogCategory.IPC, 'ipc-handlers.ts', undefined, error instanceof Error ? error : new Error(errorMessage));
        return { success: false, error: errorMessage };
      }
    });

    // 获取错误日志
    ipcMain.handle(`${IPCMessageType.LOG_OPERATION}errors`, async (event, startTime, endTime) => {
      try {
        await logger.debug('IPC消息接收: log@errors', LogCategory.IPC, 'ipc-handlers.ts');

        const logAnalyzer = new LogAnalyzer(join(getAppDataPath(), 'logs'));
        const errorLogs = await logAnalyzer.getErrorLogs(startTime, endTime);

        return { success: true, data: errorLogs };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error(`获取错误日志失败: ${errorMessage}`, LogCategory.IPC, 'ipc-handlers.ts', undefined, error instanceof Error ? error : new Error(errorMessage));
        return { success: false, error: errorMessage };
      }
    });

    // 分析错误趋势
    ipcMain.handle(`${IPCMessageType.LOG_OPERATION}error-trends`, async (event, days = 7) => {
      try {
        await logger.debug('IPC消息接收: log@error-trends', LogCategory.IPC, 'ipc-handlers.ts');

        const logAnalyzer = new LogAnalyzer(join(getAppDataPath(), 'logs'));
        const trends = await logAnalyzer.analyzeErrorTrends(days);

        return { success: true, data: trends };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error(`错误趋势分析失败: ${errorMessage}`, LogCategory.IPC, 'ipc-handlers.ts', undefined, error instanceof Error ? error : new Error(errorMessage));
        return { success: false, error: errorMessage };
      }
    });

    // 获取最频繁的错误
    ipcMain.handle(`${IPCMessageType.LOG_OPERATION}top-errors`, async (event, limit = 10) => {
      try {
        await logger.debug('IPC消息接收: log@top-errors', LogCategory.IPC, 'ipc-handlers.ts');

        const logAnalyzer = new LogAnalyzer(join(getAppDataPath(), 'logs'));
        const topErrors = await logAnalyzer.getTopErrors(limit);

        return { success: true, data: topErrors };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error(`获取热门错误失败: ${errorMessage}`, LogCategory.IPC, 'ipc-handlers.ts', undefined, error instanceof Error ? error : new Error(errorMessage));
        return { success: false, error: errorMessage };
      }
    });

    // 清理日志
    ipcMain.handle(`${IPCMessageType.LOG_OPERATION}cleanup`, async () => {
      try {
        await logger.debug('IPC消息接收: log@cleanup', LogCategory.IPC, 'ipc-handlers.ts');

        // 直接使用logger的清理功能
        await logger.info('日志清理完成', LogCategory.IPC, 'ipc-handlers.ts');


        return { success: true };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error(`日志清理失败: ${errorMessage}`, LogCategory.IPC, 'ipc-handlers.ts', undefined, error instanceof Error ? error : new Error(errorMessage));
        return { success: false, error: errorMessage };
      }
    });

    // 导出日志
    ipcMain.handle(`${IPCMessageType.LOG_OPERATION}export`, async (event, options) => {
      try {
        await logger.debug('IPC消息接收: log@export', LogCategory.IPC, 'ipc-handlers.ts');

        const { filePath } = await dialog.showSaveDialog({
          title: '导出日志',
          defaultPath: `logs-${new Date().toISOString().split('T')[0]}.json`,
          filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'CSV Files', extensions: ['csv'] },
            { name: 'Text Files', extensions: ['txt'] }
          ]
        });

        if (!filePath) {
          return { success: false, error: 'Export cancelled' };
        }

        const logAnalyzer = new LogAnalyzer(join(getAppDataPath(), 'logs'));
        const logs = await logAnalyzer.queryLogs(options);

        const ext = extname(filePath).toLowerCase();
        let content: string;

        if (ext === '.json') {
          content = JSON.stringify(logs, null, 2);
        } else if (ext === '.csv') {
          const formatter = new (await import('../shared/logger/LogFormatter')).LogFormatter();
          const header = formatter.getCsvHeader();
          const rows = logs.map((log: IPCLogEntry) => formatter.formatAsCsv(convertIPCLogToLoggerLog(log)));
          content = [header, ...rows].join('\n');
        } else {
          const formatter = new (await import('../shared/logger/LogFormatter')).LogFormatter();
          content = logs.map((log: IPCLogEntry) => formatter.format(convertIPCLogToLoggerLog(log))).join('\n');
        }

        writeFileSync(filePath, content, 'utf8');

        await logger.info(`日志已导出到: ${filePath}`, LogCategory.IPC, 'ipc-handlers.ts');
        return { success: true, filePath };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error(`日志导出失败: ${errorMessage}`, LogCategory.IPC, 'ipc-handlers.ts', undefined, error instanceof Error ? error : new Error(errorMessage));
        return { success: false, error: errorMessage };
      }
    });
  }
}

/**
 * 背景缓存处理器
 */
class BackgroundCacheHandler {
  static register() {
    // 缓存图片
    ipcMain.handle(`${IPCMessageType.BACKGROUND_CACHE_OPERATION}cacheImage`, async (_, originalPath: string, imageBuffer: Uint8Array, metadata: { width: number; height: number; format: string }) => {
      try {
        // 将Uint8Array转换为Buffer用于文件操作
        const buffer = Buffer.from(imageBuffer);
        const cachedPath = await backgroundCacheManager.cacheImage(originalPath, buffer, metadata);
        log.info('Image cached:', { originalPath, cachedPath });
        return {
          success: true,
          data: cachedPath
        };
      } catch (error) {
        log.error('Failed to cache image:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : getErrorMessage('缓存图片失败')
        };
      }
    });

    // 获取缓存图片
    ipcMain.handle(`${IPCMessageType.BACKGROUND_CACHE_OPERATION}getCachedImage`, async (_, originalPath: string) => {
      try {
        const cachedImage = await backgroundCacheManager.getCachedImage(originalPath);
        return {
          success: true,
          data: cachedImage
        };
      } catch (error) {
        log.error('Failed to get cached image:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : getErrorMessage('获取缓存图片失败')
        };
      }
    });

    // 删除缓存图片
    ipcMain.handle(`${IPCMessageType.BACKGROUND_CACHE_OPERATION}removeCachedImage`, async (_, originalPath: string) => {
      try {
        const success = await backgroundCacheManager.removeCachedImage(originalPath);
        log.info('Cached image removed:', { originalPath, success });
        return {
          success: true,
          data: success
        };
      } catch (error) {
        log.error('Failed to remove cached image:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to remove cached image'
        };
      }
    });

    // 获取缓存统计
    ipcMain.handle(`${IPCMessageType.BACKGROUND_CACHE_OPERATION}getCacheStats`, async () => {
      try {
        const stats = backgroundCacheManager.getCacheStats();
        return {
          success: true,
          data: stats
        };
      } catch (error) {
        log.error('Failed to get cache stats:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get cache stats'
        };
      }
    });

    // 清空所有缓存
    ipcMain.handle(`${IPCMessageType.BACKGROUND_CACHE_OPERATION}clearAllCache`, async () => {
      try {
        await backgroundCacheManager.clearAllCache();
        log.info('All background cache cleared');
        return {
          success: true,
          data: true
        };
      } catch (error) {
        log.error('Failed to clear all cache:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to clear all cache'
        };
      }
    });

    // 设置缓存限制
    ipcMain.handle(`${IPCMessageType.BACKGROUND_CACHE_OPERATION}setCacheLimits`, async (_, maxSize: number, maxFiles: number) => {
      try {
        backgroundCacheManager.setCacheLimits(maxSize, maxFiles);
        log.info('Cache limits updated:', { maxSize, maxFiles });
        return {
          success: true,
          data: true
        };
      } catch (error) {
        log.error('Failed to set cache limits:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to set cache limits'
        };
      }
    });

    // 使用原文件名缓存图片
    ipcMain.handle(`${IPCMessageType.BACKGROUND_CACHE_OPERATION}cacheImageWithOriginalName`, async (_, originalFileName: string, imageBuffer: Uint8Array, metadata: { width: number; height: number; format: string }) => {
      try {
        // 将Uint8Array转换为Buffer用于文件操作
        const buffer = Buffer.from(imageBuffer);
        const cachedPath = await backgroundCacheManager.cacheImageWithOriginalName(originalFileName, buffer, metadata);
        log.info('Image cached with original name:', { originalFileName, cachedPath });
        return {
          success: true,
          data: cachedPath
        };
      } catch (error) {
        log.error('Failed to cache image with original name:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to cache image with original name'
        };
      }
    });

    // 检查文件名是否存在
    ipcMain.handle(`${IPCMessageType.BACKGROUND_CACHE_OPERATION}checkFileNameExists`, async (_, fileName: string) => {
      try {
        const exists = await backgroundCacheManager.checkFileNameExists(fileName);
        return {
          success: true,
          data: exists
        };
      } catch (error) {
        log.error('Failed to check file name exists:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : getErrorMessage('检查文件名是否存在失败')
        };
      }
    });

    // 获取所有缓存图片列表
    ipcMain.handle(`${IPCMessageType.BACKGROUND_CACHE_OPERATION}getAllCachedImages`, async () => {
      try {
        const cachedImages = backgroundCacheManager.getAllCachedImages();
        return {
          success: true,
          data: cachedImages
        };
      } catch (error) {
        log.error('Failed to get all cached images:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get all cached images'
        };
      }
    });

    // 重命名缓存图片
    ipcMain.handle(`${IPCMessageType.BACKGROUND_CACHE_OPERATION}renameCachedImage`, async (_, oldFileName: string, newFileName: string) => {
      try {
        const newPath = await backgroundCacheManager.renameCachedImage(oldFileName, newFileName);
        log.info('Cached image renamed:', { oldFileName, newFileName, newPath });
        return {
          success: true,
          data: newPath
        };
      } catch (error) {
        log.error('Failed to rename cached image:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to rename cached image'
        };
      }
    });
  }
}

/**
 * 网络图片下载处理器
 */
class NetworkImageHandler {
  static register() {
    // 下载网络图片
    ipcMain.handle(`${IPCMessageType.NETWORK_IMAGE_OPERATION}download`, async (_, url: string, timeout: number = 30000) => {
      try {
        const imageBuffer = await NetworkImageHandler.downloadImage(url, timeout);
        return {
          success: true,
          data: imageBuffer
        };
      } catch (error) {
        // 记录错误日志
        const errorMsg = `网络图片下载失败: ${error instanceof Error ? error.message : 'Unknown error'}`;
        log.error(errorMsg, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '下载网络图片失败'
        };
      }
    });
  }

  /**
   * 下载图片并返回Buffer
   */
  private static downloadImage(url: string, timeout: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;

      const request = client.get(url, {
        timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        }
      }, (response) => {
        // 检查状态码
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        // 检查内容类型
        const contentType = response.headers['content-type'];
        if (!contentType?.startsWith('image/')) {
          reject(new Error(`Invalid content type: ${contentType}. Expected image type.`));
          return;
        }

        // 检查文件大小
        const contentLength = response.headers['content-length'];
        if (contentLength) {
          const size = parseInt(contentLength, 10);
          const maxSize = 50 * 1024 * 1024; // 50MB
          if (size > maxSize) {
            reject(new Error(`Image file too large: ${Math.round(size / 1024 / 1024)}MB. Maximum supported: 50MB`));
            return;
          }
        }

        const chunks: Buffer[] = [];

        response.on('data', (chunk) => {
          chunks.push(chunk);
        });

        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve(buffer);
        });

        response.on('error', (error) => {
          reject(error);
        });
      });

      request.on('timeout', () => {
        request.destroy();
        reject(new Error(`Network image download timeout: ${timeout / 1000} seconds`));
      });

      request.on('error', (error) => {
        reject(error);
      });
    });
  }
}

/**
 * 国际化处理器
 */
class I18nHandler {
  static register() {
    // 获取当前语言
    ipcMain.handle(`${IPCMessageType.I18N_OPERATION}getLanguage`, async () => {
      try {
        const i18nConfig = configManager.getConfig('i18n-config');
        return i18nConfig?.currentLanguage || 'zh-CN';
      } catch (error) {
        log.error('Failed to get current language:', error);
        return 'zh-CN'; // 默认返回中文
      }
    });

    // 设置语言
    ipcMain.handle(`${IPCMessageType.I18N_OPERATION}setLanguage`, async (_, language: string) => {
      try {
        const i18nConfig = configManager.getConfig('i18n-config');
        const previousLanguage = i18nConfig?.currentLanguage || 'zh-CN';

        // 更新配置文件
        await configManager.setConfig('i18n-config', {
          ...i18nConfig,
          currentLanguage: language
        });

        await logger.info(`语言切换成功: ${previousLanguage} -> ${language}`, LogCategory.I18N, 'ipc-handlers.ts');

        return {
          success: true,
          data: language
        };
      } catch (error) {
        log.error('Failed to set language:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : getErrorMessage('设置语言失败')
        };
      }
    });

    // 获取翻译
    ipcMain.handle(`${IPCMessageType.I18N_OPERATION}getTranslations`, async (_, _namespace: string) => {
      // 这里可以返回主进程的翻译资源，但通常渲染进程有自己的翻译资源
      // 主要用于调试或特殊情况
      // 由于MainI18n没有getResourceBundle方法，返回空对象
      return {};
    });

    // 获取支持的语言列表
    ipcMain.handle(`${IPCMessageType.I18N_OPERATION}getSupportedLanguages`, async () => {
      try {
        // 返回固定的支持语言列表
        return [
          { code: 'zh-CN', name: '简体中文', nativeName: '简体中文' },
          { code: 'en', name: 'English', nativeName: 'English' },
          { code: 'ru', name: 'Russian', nativeName: 'Русский' },
          { code: 'fr', name: 'French', nativeName: 'Français' }
        ];
      } catch (error) {
        log.error('Failed to get supported languages:', error);
        return ['zh-CN', 'en', 'ru', 'fr']; // 默认支持的语言
      }
    });
  }
}

/**
 * 注册所有IPC处理器
 */
export function registerIPCHandlers() {
  logger.info('正在注册IPC处理器...', LogCategory.IPC, 'ipc-handlers.ts').catch(console.error);

  ConfigHandler.register();
  FileHandler.register();
  WindowHandler.register();
  SystemHandler.register();
  AppHandler.register();
  DatabaseFileHandler.register();
  CategoryHandler.register();
  LogHandler.register();
  BackgroundCacheHandler.register(); // 添加背景缓存处理器
  NetworkImageHandler.register(); // 添加网络图片处理器
  I18nHandler.register(); // 添加i18n处理器

  logger.info('所有IPC处理器注册完成', LogCategory.IPC, 'ipc-handlers.ts').catch(console.error);
}
