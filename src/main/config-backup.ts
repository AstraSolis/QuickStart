/**
 * QuickStart 配置备份管理器
 * 负责配置文件的备份、恢复和版本管理
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { app } from 'electron';

// 备份信息接口
export interface BackupInfo {
  filename: string;
  metadata: {
    version: string;
    timestamp: number;
    configType: string;
    checksum: string;
    description?: string;
  };
  filePath: string;
  size: number;
}

// 备份元数据接口
interface BackupMetadata {
  version: string;
  timestamp: number;
  configType: string;
  checksum: string;
  description?: string;
  originalPath: string;
}

class ConfigBackupManager {
  private backupPath: string = '';
  private isInitialized: boolean = false;
  private readonly maxBackups: number = 50; // 最大备份数量

  /**
   * 初始化备份管理器
   */
  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    try {
      // 设置备份目录路径
      const appDataPath = app.getPath('appData');
      this.backupPath = path.join(appDataPath, 'QuickStartAPP', 'backups');

      // 确保备份目录存在
      this.ensureBackupDirectory();

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize ConfigBackupManager:', error);
      throw error;
    }
  }

  /**
   * 确保备份目录存在
   */
  private ensureBackupDirectory(): void {
    if (!fs.existsSync(this.backupPath)) {
      fs.mkdirSync(this.backupPath, { recursive: true });
    }
  }

  /**
   * 创建配置文件备份
   */
  async createBackup(filePath: string, configType: string, description?: string): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('ConfigBackupManager not initialized');
    }

    try {
      // 检查源文件是否存在
      if (!fs.existsSync(filePath)) {
        throw new Error(`Source file does not exist: ${filePath}`);
      }

      // 读取源文件内容
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      // 计算文件校验和
      const checksum = crypto.createHash('md5').update(fileContent).digest('hex');

      // 生成备份文件名
      const timestamp = Date.now();
      const backupFilename = `${configType}_${timestamp}.json`;
      const backupFilePath = path.join(this.backupPath, backupFilename);

      // 创建备份元数据
      const metadata: BackupMetadata = {
        version: '1.0',
        timestamp,
        configType,
        checksum,
        description: description || 'Auto backup',
        originalPath: filePath
      };

      // 创建备份文件内容
      const backupContent = {
        metadata,
        data: JSON.parse(fileContent)
      };

      // 写入备份文件
      fs.writeFileSync(backupFilePath, JSON.stringify(backupContent, null, 2), 'utf8');

      // 清理旧备份
      await this.cleanupOldBackups(configType);

      return backupFilePath;
    } catch (error) {
      console.error('Failed to create backup:', error);
      throw error;
    }
  }

  /**
   * 获取备份列表
   */
  async getBackupList(configType?: string): Promise<BackupInfo[]> {
    if (!this.isInitialized) {
      throw new Error('ConfigBackupManager not initialized');
    }

    try {
      const backups: BackupInfo[] = [];

      // 读取备份目录
      if (!fs.existsSync(this.backupPath)) {
        return backups;
      }

      const files = fs.readdirSync(this.backupPath);

      for (const file of files) {
        if (!file.endsWith('.json')) {
          continue;
        }

        const filePath = path.join(this.backupPath, file);
        
        try {
          // 读取备份文件
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const backupData = JSON.parse(fileContent);

          // 验证备份文件格式
          if (!backupData.metadata || !backupData.data) {
            continue;
          }

          const metadata = backupData.metadata as BackupMetadata;

          // 过滤配置类型
          if (configType && metadata.configType !== configType) {
            continue;
          }

          // 获取文件大小
          const stats = fs.statSync(filePath);

          backups.push({
            filename: file,
            metadata: {
              version: metadata.version,
              timestamp: metadata.timestamp,
              configType: metadata.configType,
              checksum: metadata.checksum,
              description: metadata.description
            },
            filePath,
            size: stats.size
          });
        } catch (error) {
          console.warn(`Failed to read backup file ${file}:`, error);
          continue;
        }
      }

      // 按时间戳降序排序
      backups.sort((a, b) => b.metadata.timestamp - a.metadata.timestamp);

      return backups;
    } catch (error) {
      console.error('Failed to get backup list:', error);
      throw error;
    }
  }

  /**
   * 从备份恢复配置
   */
  async restoreFromBackup(backupFilePath: string, targetPath: string): Promise<boolean> {
    if (!this.isInitialized) {
      throw new Error('ConfigBackupManager not initialized');
    }

    try {
      // 检查备份文件是否存在
      if (!fs.existsSync(backupFilePath)) {
        throw new Error(`Backup file does not exist: ${backupFilePath}`);
      }

      // 读取备份文件
      const backupContent = fs.readFileSync(backupFilePath, 'utf8');
      const backupData = JSON.parse(backupContent);

      // 验证备份文件格式
      if (!backupData.metadata || !backupData.data) {
        throw new Error('Invalid backup file format');
      }

      // 验证校验和
      const dataContent = JSON.stringify(backupData.data, null, 2);
      const checksum = crypto.createHash('md5').update(dataContent).digest('hex');
      
      if (checksum !== backupData.metadata.checksum) {
        console.warn('Backup file checksum mismatch, but proceeding with restore');
      }

      // 确保目标目录存在
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // 写入恢复的配置文件
      fs.writeFileSync(targetPath, JSON.stringify(backupData.data, null, 2), 'utf8');

      return true;
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      return false;
    }
  }

  /**
   * 清理旧备份
   */
  private async cleanupOldBackups(configType: string): Promise<void> {
    try {
      const backups = await this.getBackupList(configType);
      
      if (backups.length > this.maxBackups) {
        // 删除超出限制的旧备份
        const backupsToDelete = backups.slice(this.maxBackups);
        
        for (const backup of backupsToDelete) {
          try {
            fs.unlinkSync(backup.filePath);
          } catch (error) {
            console.warn(`Failed to delete old backup ${backup.filename}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup old backups:', error);
    }
  }

  /**
   * 删除备份文件
   */
  async deleteBackup(backupFilePath: string): Promise<boolean> {
    try {
      if (fs.existsSync(backupFilePath)) {
        fs.unlinkSync(backupFilePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to delete backup:', error);
      return false;
    }
  }

  /**
   * 获取备份统计信息
   */
  async getBackupStats(): Promise<{ total: number; byType: Record<string, number>; totalSize: number }> {
    try {
      const allBackups = await this.getBackupList();
      const byType: Record<string, number> = {};
      let totalSize = 0;

      for (const backup of allBackups) {
        byType[backup.metadata.configType] = (byType[backup.metadata.configType] || 0) + 1;
        totalSize += backup.size;
      }

      return {
        total: allBackups.length,
        byType,
        totalSize
      };
    } catch (error) {
      console.error('Failed to get backup stats:', error);
      return { total: 0, byType: {}, totalSize: 0 };
    }
  }
}

// 导出单例实例
export const configBackupManager = new ConfigBackupManager();
