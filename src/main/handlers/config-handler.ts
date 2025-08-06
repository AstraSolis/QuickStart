/**
 * 配置管理IPC处理器
 * 负责处理所有配置相关的IPC通信
 */

import { ipcMain } from 'electron';
import { configManager } from '../config-manager';
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
const CONFIG_OPERATION = 'config@';

/**
 * 获取错误消息的辅助函数
 */
function getErrorMessage(defaultMessage: string): string {
  return defaultMessage;
}

/**
 * 配置管理处理器
 */
export class ConfigHandler {
  static register() {
    // 获取配置
    ipcMain.handle(`${CONFIG_OPERATION}get`, async (_, configType: string) => {
      try {
        const config = configManager.getConfig(configType as any);
        return {
          success: true,
          data: config
        };
      } catch (error) {
        logger.error('Failed to get config:', LogCategory.CONFIG, 'config-handler.ts', { error }).catch(console.error);
        return {
          success: false,
          error: error instanceof Error ? error.message : getErrorMessage('获取配置失败')
        };
      }
    });

    // 保存配置
    ipcMain.handle(`${CONFIG_OPERATION}save`, async (_, configType: string, config: any) => {
      try {
        await configManager.setConfig(configType as any, config);
        return {
          success: true,
          message: '配置保存成功'
        };
      } catch (error) {
        logger.error('Failed to save config:', LogCategory.CONFIG, 'config-handler.ts', { error }).catch(console.error);
        return {
          success: false,
          error: error instanceof Error ? error.message : getErrorMessage('保存配置失败')
        };
      }
    });

    // 重置配置
    ipcMain.handle(`${CONFIG_OPERATION}reset`, async (_, configType: string) => {
      try {
        await configManager.resetConfig(configType as any);
        return {
          success: true,
          message: '配置重置成功'
        };
      } catch (error) {
        logger.error('Failed to reset config:', LogCategory.CONFIG, 'config-handler.ts', { error }).catch(console.error);
        return {
          success: false,
          error: error instanceof Error ? error.message : getErrorMessage('重置配置失败')
        };
      }
    });

    // 备份配置 - 暂时禁用，因为方法不存在
    ipcMain.handle(`${CONFIG_OPERATION}backup`, async () => {
      // TODO: 实现备份功能
      return {
        success: false,
        error: '备份功能暂未实现'
      };
    });

    // 恢复配置 - 暂时禁用，因为方法不存在
    ipcMain.handle(`${CONFIG_OPERATION}restore`, async (_, _backupPath: string) => {
      // TODO: 实现恢复功能
      return {
        success: false,
        error: '恢复功能暂未实现'
      };
    });

    logger.info('配置管理处理器注册完成', LogCategory.CONFIG, 'config-handler.ts').catch(console.error);
  }
}
