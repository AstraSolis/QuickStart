/**
 * 应用程序操作IPC处理器
 * 负责处理应用程序相关的IPC通信
 */

import { ipcMain, app } from 'electron';
import { createMainLogger, LogCategory } from '../../shared/logger';
import { join } from 'path';

// 初始化日志
const logger = createMainLogger({
  logDir: join(process.env.APPDATA ?? process.env.HOME ?? process.cwd(), 'QuickStartAPP', 'logs'),
  level: 2,
  enableFile: true,
  enableConsole: true,
});

// IPC消息类型
const APP_OPERATION = 'app@';

// Electron路径名称类型
type ElectronPathName = 'home' | 'appData' | 'userData' | 'sessionData' | 'temp' | 'exe' | 'module' | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | 'recent' | 'logs' | 'crashDumps';

/**
 * 应用程序操作处理器
 */
export class AppHandler {
  static register() {
    // 获取应用版本
    ipcMain.handle(`${APP_OPERATION}getVersion`, async () => {
      return app.getVersion();
    });

    // 获取应用名称
    ipcMain.handle(`${APP_OPERATION}getName`, async () => {
      return app.getName();
    });

    // 获取应用路径
    ipcMain.handle(`${APP_OPERATION}getPath`, async (_, name: string) => {
      return app.getPath(name as ElectronPathName);
    });

    // 退出应用
    ipcMain.on(`${APP_OPERATION}quit`, () => {
      app.quit();
    });

    // 重启应用
    ipcMain.on(`${APP_OPERATION}relaunch`, () => {
      app.relaunch();
      app.exit();
    });

    // 检查是否为打包版本
    ipcMain.handle(`${APP_OPERATION}isPackaged`, async () => {
      return app.isPackaged;
    });

    logger.info('应用程序操作处理器注册完成', LogCategory.APP, 'app-handler.ts').catch(console.error);
  }
}
