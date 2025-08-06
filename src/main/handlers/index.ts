/**
 * IPC处理器统一注册入口
 * 将所有处理器模块化，提高代码可维护性
 */

import { createMainLogger, LogCategory } from '../../shared/logger';
import { join } from 'path';

// 导入所有处理器
import { ConfigHandler } from './config-handler';
import { AppHandler } from './app-handler';
import { WindowHandler } from './window-handler';

// 初始化日志
const logger = createMainLogger({
  logDir: join(process.env.APPDATA ?? process.env.HOME ?? process.cwd(), 'QuickStartAPP', 'logs'),
  level: 2,
  enableFile: true,
  enableConsole: true,
});

/**
 * 注册所有IPC处理器
 * 模块化的处理器注册，提高代码组织性和可维护性
 */
export function registerIPCHandlers() {
  logger.info('正在注册IPC处理器...', LogCategory.IPC, 'handlers/index.ts').catch(console.error);

  try {
    // 注册各个处理器模块
    ConfigHandler.register();
    AppHandler.register();
    WindowHandler.register();

    // TODO: 将其他处理器也迁移到独立文件
    // FileHandler.register();
    // SystemHandler.register();
    // DatabaseFileHandler.register();
    // CategoryHandler.register();
    // LogHandler.register();
    // BackgroundCacheHandler.register();
    // NetworkImageHandler.register();
    // I18nHandler.register();

    logger.info('所有IPC处理器注册完成', LogCategory.IPC, 'handlers/index.ts').catch(console.error);
  } catch (error) {
    logger.error('IPC处理器注册失败', LogCategory.IPC, 'handlers/index.ts', { error }).catch(console.error);
    throw error;
  }
}

// 导出处理器类，供其他模块使用
export {
  ConfigHandler,
  AppHandler,
  WindowHandler,
};
