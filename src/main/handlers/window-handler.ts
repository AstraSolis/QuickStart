/**
 * 窗口操作IPC处理器
 * 负责处理窗口相关的IPC通信
 */

import { ipcMain, BrowserWindow } from 'electron';
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
const WINDOW_OPERATION = 'window@';

/**
 * 窗口操作处理器
 */
export class WindowHandler {
  static register() {
    // 最小化窗口
    ipcMain.on(`${WINDOW_OPERATION}minimize`, (event) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window) {
        window.minimize();
      }
    });

    // 最大化/还原窗口
    ipcMain.on(`${WINDOW_OPERATION}maximize`, (event) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window) {
        if (window.isMaximized()) {
          window.unmaximize();
        } else {
          window.maximize();
        }
      }
    });

    // 关闭窗口
    ipcMain.on(`${WINDOW_OPERATION}close`, (event) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window) {
        window.close();
      }
    });

    // 设置窗口大小
    ipcMain.on(`${WINDOW_OPERATION}setSize`, (event, width: number, height: number) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window) {
        window.setSize(width, height);
      }
    });

    // 设置窗口位置
    ipcMain.on(`${WINDOW_OPERATION}setPosition`, (event, x: number, y: number) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window) {
        window.setPosition(x, y);
      }
    });

    // 获取窗口状态
    ipcMain.handle(`${WINDOW_OPERATION}getState`, (event) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window) {
        const bounds = window.getBounds();
        return {
          isMaximized: window.isMaximized(),
          isMinimized: window.isMinimized(),
          isFullScreen: window.isFullScreen(),
          bounds: bounds
        };
      }
      return null;
    });

    // 设置窗口置顶
    ipcMain.on(`${WINDOW_OPERATION}setAlwaysOnTop`, (event, flag: boolean) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window) {
        window.setAlwaysOnTop(flag);
      }
    });

    logger.info('窗口操作处理器注册完成', LogCategory.APP, 'window-handler.ts').catch(console.error);
  }
}
