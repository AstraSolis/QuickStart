/**
 * 文件管理器
 * 负责管理文件列表的持久化存储和操作
 */

import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, statSync } from 'fs';
import log from 'electron-log';
import { getAppDataPath } from './config';

// 文件项接口
export interface FileItem {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  icon?: string;
  lastModified: Date;
  size?: number;
  addedAt: Date;
  launchCount: number;
  lastLaunched?: Date;
  tags?: string[];
  description?: string;
}

// 文件列表配置接口
export interface FileListConfig {
  version: string;
  files: FileItem[];
  settings: {
    autoRefresh: boolean;
    showHiddenFiles: boolean;
    sortBy: 'name' | 'lastModified' | 'lastLaunched' | 'launchCount';
    sortOrder: 'asc' | 'desc';
    viewMode: 'list' | 'grid';
  };
}

class FileManager {
  private configPath: string;
  private config: FileListConfig;

  constructor() {
    this.configPath = join(getAppDataPath(), 'file-list.json');
    this.config = this.loadConfig();
  }

  /**
   * 获取错误消息的辅助函数
   */
  private getMessage(fallback: string): string {
    return fallback;
  }

  /**
   * 加载配置文件
   */
  private loadConfig(): FileListConfig {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8');
        const config = JSON.parse(data);
        
        // 转换日期字符串为Date对象
        config.files = config.files.map((file: Record<string, unknown>) => ({
          ...file,
          lastModified: new Date(file.lastModified as string),
          addedAt: new Date(file.addedAt as string),
          lastLaunched: file.lastLaunched ? new Date(file.lastLaunched as string) : undefined,
        }));
        
        return config;
      }
    } catch (error) {
      log.error('Failed to load file list config:', error);
    }

    // 返回默认配置
    return {
      version: '1.0.0',
      files: [],
      settings: {
        autoRefresh: true,
        showHiddenFiles: false,
        sortBy: 'name',
        sortOrder: 'asc',
        viewMode: 'list',
      },
    };
  }

  /**
   * 保存配置文件
   */
  private saveConfig(): boolean {
    try {
      const data = JSON.stringify(this.config, null, 2);
      writeFileSync(this.configPath, data, 'utf-8');
      log.info('File list config saved');
      return true;
    } catch (error) {
      log.error('Failed to save file list config:', error);
      return false;
    }
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * 添加文件到列表
   */
  async addFile(filePath: string): Promise<FileItem | null> {
    try {
      if (!existsSync(filePath)) {
        throw new Error(this.getMessage('文件不存在'));
      }

      // 检查是否已存在
      const existingFile = this.config.files.find(file => file.path === filePath);
      if (existingFile) {
        log.warn(this.getMessage(`文件已存在于列表中: ${filePath}`));
        return existingFile;
      }

      const stats = statSync(filePath);
      const fileName = filePath.split(/[/\\]/).pop() ?? '';
      
      const fileItem: FileItem = {
        id: this.generateId(),
        name: fileName,
        path: filePath,
        type: stats.isDirectory() ? 'folder' : 'file',
        lastModified: stats.mtime,
        size: stats.isDirectory() ? undefined : stats.size,
        addedAt: new Date(),
        launchCount: 0,
        tags: [],
      };

      this.config.files.push(fileItem);
      this.saveConfig();

      log.info(this.getMessage(`文件已添加到列表: ${filePath}`));
      return fileItem;
    } catch (error) {
      log.error(this.getMessage('添加文件失败:'), error);
      return null;
    }
  }

  /**
   * 批量添加文件
   */
  async addMultipleFiles(filePaths: string[]): Promise<FileItem[]> {
    const addedFiles: FileItem[] = [];
    
    for (const filePath of filePaths) {
      const fileItem = await this.addFile(filePath);
      if (fileItem) {
        addedFiles.push(fileItem);
      }
    }
    
    return addedFiles;
  }

  /**
   * 删除文件从列表
   */
  removeFile(fileId: string): boolean {
    try {
      const index = this.config.files.findIndex(file => file.id === fileId);
      if (index === -1) {
        return false;
      }

      const removedFile = this.config.files.splice(index, 1)[0];
      this.saveConfig();

      log.info(this.getMessage(`文件已从列表中移除: ${removedFile.path}`));
      return true;
    } catch (error) {
      log.error(this.getMessage('移除文件失败:'), error);
      return false;
    }
  }

  /**
   * 获取文件列表
   */
  getFileList(): FileItem[] {
    return [...this.config.files];
  }

  /**
   * 获取文件信息
   */
  getFileById(fileId: string): FileItem | null {
    return this.config.files.find(file => file.id === fileId) ?? null;
  }

  /**
   * 更新文件信息
   */
  updateFile(fileId: string, updates: Partial<FileItem>): boolean {
    try {
      const fileIndex = this.config.files.findIndex(file => file.id === fileId);
      if (fileIndex === -1) {
        return false;
      }

      this.config.files[fileIndex] = {
        ...this.config.files[fileIndex],
        ...updates,
      };

      this.saveConfig();
      return true;
    } catch (error) {
      log.error('Failed to update file:', error);
      return false;
    }
  }

  /**
   * 记录文件启动
   */
  recordLaunch(fileId: string): boolean {
    try {
      const file = this.config.files.find(f => f.id === fileId);
      if (!file) {
        return false;
      }

      file.launchCount++;
      file.lastLaunched = new Date();
      
      this.saveConfig();
      return true;
    } catch (error) {
      log.error('Failed to record launch:', error);
      return false;
    }
  }

  /**
   * 刷新文件信息
   */
  async refreshFileInfo(fileId: string): Promise<boolean> {
    try {
      const file = this.config.files.find(f => f.id === fileId);
      if (!file) {
        return false;
      }

      if (!existsSync(file.path)) {
        // 文件不存在，标记为无效
        const deletedPrefix = this.getMessage('[已删除]');
        file.name = `${deletedPrefix} ${file.name}`;
        this.saveConfig();
        return false;
      }

      const stats = statSync(file.path);
      file.lastModified = stats.mtime;
      file.size = stats.isDirectory() ? undefined : stats.size;

      this.saveConfig();
      return true;
    } catch (error) {
      log.error(this.getMessage('刷新文件信息失败:'), error);
      return false;
    }
  }

  /**
   * 获取设置
   */
  getSettings() {
    return { ...this.config.settings };
  }

  /**
   * 更新设置
   */
  updateSettings(settings: Partial<FileListConfig['settings']>): boolean {
    try {
      this.config.settings = {
        ...this.config.settings,
        ...settings,
      };
      
      this.saveConfig();
      return true;
    } catch (error) {
      log.error('Failed to update settings:', error);
      return false;
    }
  }

  /**
   * 清空文件列表
   */
  clearFileList(): boolean {
    try {
      this.config.files = [];
      this.saveConfig();
      log.info('File list cleared');
      return true;
    } catch (error) {
      log.error('Failed to clear file list:', error);
      return false;
    }
  }
}

// 导出单例实例
export const fileManager = new FileManager();
