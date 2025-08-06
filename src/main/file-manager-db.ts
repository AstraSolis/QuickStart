/**
 * QuickStart 文件管理器 (SQLite版本)
 * 基于数据库的文件管理功能
 */

import { existsSync, statSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import log from 'electron-log';
import { fileDAO, type CreateFileItemInput, type UpdateFileItemInput, type FileItemQuery } from './file-dao';
import { categoryDAO } from './category-dao';
import type { FileItemDB, FileCategoryDB } from './database-manager';

const execAsync = promisify(exec);

export interface FileItem {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  description?: string;
  launchArgs?: string;
  requireAdmin: boolean;
  category?: FileCategoryDB;
  tags?: string[];
  iconPath?: string;
  size?: number;
  lastModified: Date;
  addedAt: Date;
  lastLaunched?: Date;
  launchCount: number;
  isFavorite: boolean;
  isPinned: boolean;
  sortOrder: number;
  isEnabled: boolean;
}

export class FileManagerDB {
  /**
   * 获取错误消息的辅助函数
   */
  private getMessage(fallback: string): string {
    return fallback;
  }

  /**
   * 添加文件到数据库
   */
  public async addFile(filePath: string, options: {
    description?: string;
    launchArgs?: string;
    requireAdmin?: boolean;
    categoryName?: string;
    tags?: string[];
  } = {}): Promise<FileItem | null> {
    try {
      if (!existsSync(filePath)) {
        throw new Error(this.getMessage('文件不存在'));
      }

      // 检查文件是否已存在
      const existingFile = fileDAO.getFileItemByPath(filePath);
      if (existingFile) {
        log.warn(this.getMessage(`文件已存在于数据库中: ${filePath}`));
        return this.mapDbItemToFileItem(existingFile);
      }

      const stats = statSync(filePath);
      const fileName = filePath.split(/[/\\]/).pop() ?? '';
      
      // 获取分类ID
      let categoryId: number | undefined;
      if (options.categoryName) {
        const category = categoryDAO.getCategoryByName(options.categoryName);
        categoryId = category?.id;
      }

      const input: CreateFileItemInput = {
        name: fileName,
        path: filePath,
        type: stats.isDirectory() ? 'folder' : 'file',
        description: options.description,
        launchArgs: options.launchArgs,
        requireAdmin: options.requireAdmin ?? false,
        categoryId,
        tags: options.tags,
        size: stats.isDirectory() ? undefined : stats.size,
        lastModified: stats.mtime,
      };

      const dbItem = fileDAO.createFileItem(input);
      return this.mapDbItemToFileItem(dbItem);
    } catch (error) {
      log.error(this.getMessage('添加文件失败:'), error);
      throw error;
    }
  }

  /**
   * 批量添加文件
   */
  public async addFiles(filePaths: string[], options: {
    description?: string;
    launchArgs?: string;
    requireAdmin?: boolean;
    categoryName?: string;
    tags?: string[];
  } = {}): Promise<FileItem[]> {
    const results: FileItem[] = [];
    
    for (const filePath of filePaths) {
      try {
        const fileItem = await this.addFile(filePath, options);
        if (fileItem) {
          results.push(fileItem);
        }
      } catch (error) {
        log.error(`Failed to add file ${filePath}:`, error);
        // 继续处理其他文件
      }
    }

    return results;
  }

  /**
   * 获取文件项
   */
  public getFileById(id: string): FileItem | null {
    const dbItem = fileDAO.getFileItemById(id);
    return dbItem ? this.mapDbItemToFileItem(dbItem) : null;
  }

  /**
   * 获取文件项（通过路径）
   */
  public getFileByPath(path: string): FileItem | null {
    const dbItem = fileDAO.getFileItemByPath(path);
    return dbItem ? this.mapDbItemToFileItem(dbItem) : null;
  }

  /**
   * 查询文件列表
   */
  public queryFiles(query: FileItemQuery = {}): FileItem[] {
    const dbItems = fileDAO.queryFileItems(query);
    return dbItems.map(item => this.mapDbItemToFileItem(item));
  }

  /**
   * 获取所有文件
   */
  public getAllFiles(): FileItem[] {
    return this.queryFiles({ isEnabled: true });
  }

  /**
   * 获取收藏文件
   */
  public getFavoriteFiles(): FileItem[] {
    return this.queryFiles({ isFavorite: true, isEnabled: true });
  }

  /**
   * 获取置顶文件
   */
  public getPinnedFiles(): FileItem[] {
    return this.queryFiles({ isPinned: true, isEnabled: true });
  }

  /**
   * 搜索文件
   */
  public searchFiles(searchTerm: string): FileItem[] {
    return this.queryFiles({ searchTerm, isEnabled: true });
  }

  /**
   * 更新文件项
   */
  public updateFile(id: string, updates: UpdateFileItemInput): boolean {
    return fileDAO.updateFileItem(id, updates);
  }

  /**
   * 删除文件项
   */
  public deleteFile(id: string): boolean {
    return fileDAO.deleteFileItem(id);
  }

  /**
   * 启动文件
   */
  public async launchFile(id: string, customArgs?: string[]): Promise<boolean> {
    const fileItem = this.getFileById(id);
    if (!fileItem) {
      log.error(this.getMessage('数据库中未找到文件:'), id);
      return false;
    }

    if (!existsSync(fileItem.path)) {
      log.error(this.getMessage('文件不存在:'), fileItem.path);
      return false;
    }

    const startTime = Date.now();
    let success = false;
    let errorMessage: string | undefined;

    try {
      // 构建启动命令
      let command = `"${fileItem.path}"`;
      
      // 添加启动参数
      const args = customArgs ?? (fileItem.launchArgs ? fileItem.launchArgs.split(' ') : []);
      if (args.length > 0) {
        command += ` ${args.join(' ')}`;
      }

      // 如果需要管理员权限，使用runas
      if (fileItem.requireAdmin) {
        command = `powershell -Command "Start-Process '${fileItem.path}' -Verb RunAs"`;
        if (args.length > 0) {
          command = `powershell -Command "Start-Process '${fileItem.path}' -ArgumentList '${args.join("','")}' -Verb RunAs"`;
        }
      }

      await execAsync(command);
      success = true;
      log.info(this.getMessage(`文件启动成功: ${fileItem.path}`));
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : String(error);
      log.error(this.getMessage('启动文件失败:'), error);
    }

    // 记录启动历史
    const duration = Date.now() - startTime;
    const launchArgs = customArgs?.join(' ') ?? fileItem.launchArgs;
    fileDAO.recordLaunch(id, launchArgs, success, errorMessage, duration);

    return success;
  }

  /**
   * 切换收藏状态
   */
  public toggleFavorite(id: string): boolean {
    const fileItem = this.getFileById(id);
    if (!fileItem) return false;

    return this.updateFile(id, { isFavorite: !fileItem.isFavorite });
  }

  /**
   * 切换置顶状态
   */
  public togglePin(id: string): boolean {
    const fileItem = this.getFileById(id);
    if (!fileItem) return false;

    return this.updateFile(id, { isPinned: !fileItem.isPinned });
  }

  /**
   * 设置文件分类
   */
  public setFileCategory(id: string, categoryName: string): boolean {
    const category = categoryDAO.getCategoryByName(categoryName);
    if (!category) {
      log.error('Category not found:', categoryName);
      return false;
    }

    return this.updateFile(id, { categoryId: category.id });
  }

  /**
   * 获取启动历史
   */
  public getLaunchHistory(id: string, limit: number = 50) {
    return fileDAO.getLaunchHistory(id, limit);
  }

  /**
   * 获取所有分类
   */
  public getCategories(): FileCategoryDB[] {
    return categoryDAO.getAllCategories();
  }

  /**
   * 获取分类统计
   */
  public getCategoryStats() {
    return categoryDAO.getCategoryStats();
  }

  /**
   * 创建分类
   */
  public createCategory(name: string, options: {
    description?: string;
    color?: string;
    icon?: string;
  } = {}): FileCategoryDB {
    return categoryDAO.createCategory({
      name,
      description: options.description,
      color: options.color,
      icon: options.icon
    });
  }

  /**
   * 获取统计信息
   */
  public getStats() {
    const totalFiles = this.queryFiles().length;
    const enabledFiles = this.queryFiles({ isEnabled: true }).length;
    const favoriteFiles = this.queryFiles({ isFavorite: true }).length;
    const pinnedFiles = this.queryFiles({ isPinned: true }).length;
    const categories = this.getCategories().length;

    return {
      totalFiles,
      enabledFiles,
      favoriteFiles,
      pinnedFiles,
      categories
    };
  }

  /**
   * 将数据库文件项映射为FileItem
   */
  private mapDbItemToFileItem(dbItem: FileItemDB): FileItem {
    // 获取分类信息
    let category: FileCategoryDB | undefined;
    if (typeof dbItem.category === 'number') {
      category = categoryDAO.getCategoryById(dbItem.category) ?? undefined;
    }

    return {
      id: dbItem.id,
      name: dbItem.name,
      path: dbItem.path,
      type: dbItem.type,
      description: dbItem.description,
      launchArgs: dbItem.launchArgs,
      requireAdmin: dbItem.requireAdmin,
      category,
      tags: typeof dbItem.tags === 'string' ? JSON.parse(dbItem.tags) : dbItem.tags,
      iconPath: dbItem.iconPath,
      size: dbItem.size,
      lastModified: new Date(dbItem.lastModified),
      addedAt: new Date(dbItem.addedAt),
      lastLaunched: dbItem.lastLaunched ? new Date(dbItem.lastLaunched) : undefined,
      launchCount: dbItem.launchCount,
      isFavorite: dbItem.isFavorite,
      isPinned: dbItem.isPinned,
      sortOrder: dbItem.sortOrder,
      isEnabled: dbItem.isEnabled
    };
  }
}

// 导出单例实例
export const fileManagerDB = new FileManagerDB();
