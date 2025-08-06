/**
 * QuickStart 数据库API
 * 前端与数据库交互的接口
 */

import { ipcRenderer } from 'electron';

// 文件项接口
export interface FileItem {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  description?: string;
  launchArgs?: string;
  requireAdmin: boolean;
  category?: FileCategory;
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

// 文件分类接口
export interface FileCategory {
  id: number;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// 启动历史记录接口
export interface LaunchHistory {
  id: number;
  fileId: string;
  launchedAt: string;
  launchArgs?: string;
  success: boolean;
  errorMessage?: string;
  duration?: number;
}

// 查询参数接口
export interface FileQuery {
  type?: 'file' | 'folder';
  categoryId?: number;
  isFavorite?: boolean;
  isPinned?: boolean;
  isEnabled?: boolean;
  searchTerm?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'addedAt' | 'lastLaunched' | 'launchCount' | 'sortOrder';
  sortOrder?: 'ASC' | 'DESC';
}

// 添加文件选项
export interface AddFileOptions {
  description?: string;
  launchArgs?: string;
  requireAdmin?: boolean;
  categoryName?: string;
  tags?: string[];
}

// 更新文件选项
export interface UpdateFileOptions {
  name?: string;
  description?: string;
  launchArgs?: string;
  requireAdmin?: boolean;
  categoryId?: number;
  tags?: string[];
  iconPath?: string;
  isFavorite?: boolean;
  isPinned?: boolean;
  sortOrder?: number;
  isEnabled?: boolean;
}

// 创建分类选项
export interface CreateCategoryOptions {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
}

// 更新分类选项
export interface UpdateCategoryOptions {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
}

/**
 * 数据库文件管理API
 */
export class DatabaseAPI {
  /**
   * 添加文件到数据库
   */
  static async addFile(filePath: string, options: AddFileOptions = {}): Promise<FileItem | null> {
    return await ipcRenderer.invoke('database@addFile', filePath, options);
  }

  /**
   * 批量添加文件
   */
  static async addFiles(filePaths: string[], options: AddFileOptions = {}): Promise<FileItem[]> {
    return await ipcRenderer.invoke('database@addFiles', filePaths, options);
  }

  /**
   * 获取所有文件
   */
  static async getAllFiles(): Promise<FileItem[]> {
    return await ipcRenderer.invoke('database@getAllFiles');
  }

  /**
   * 查询文件
   */
  static async queryFiles(query: FileQuery = {}): Promise<FileItem[]> {
    return await ipcRenderer.invoke('database@queryFiles', query);
  }

  /**
   * 获取文件详情
   */
  static async getFile(id: string): Promise<FileItem | null> {
    return await ipcRenderer.invoke('database@getFile', id);
  }

  /**
   * 更新文件
   */
  static async updateFile(id: string, updates: UpdateFileOptions): Promise<boolean> {
    return await ipcRenderer.invoke('database@updateFile', id, updates);
  }

  /**
   * 删除文件
   */
  static async deleteFile(id: string): Promise<boolean> {
    return await ipcRenderer.invoke('database@deleteFile', id);
  }

  /**
   * 启动文件
   */
  static async launchFile(id: string, customArgs?: string[]): Promise<boolean> {
    return await ipcRenderer.invoke('database@launchFile', id, customArgs);
  }

  /**
   * 切换收藏状态
   */
  static async toggleFavorite(id: string): Promise<boolean> {
    return await ipcRenderer.invoke('database@toggleFavorite', id);
  }

  /**
   * 切换置顶状态
   */
  static async togglePin(id: string): Promise<boolean> {
    return await ipcRenderer.invoke('database@togglePin', id);
  }

  /**
   * 搜索文件
   */
  static async searchFiles(searchTerm: string): Promise<FileItem[]> {
    return await ipcRenderer.invoke('database@searchFiles', searchTerm);
  }

  /**
   * 获取启动历史
   */
  static async getLaunchHistory(id: string, limit?: number): Promise<LaunchHistory[]> {
    return await ipcRenderer.invoke('database@getLaunchHistory', id, limit);
  }

  /**
   * 获取统计信息
   */
  static async getStats(): Promise<{
    totalFiles: number;
    enabledFiles: number;
    favoriteFiles: number;
    pinnedFiles: number;
    categories: number;
  } | null> {
    return await ipcRenderer.invoke('database@getStats');
  }

  /**
   * 数据库备份
   */
  static async backup(backupPath: string): Promise<boolean> {
    return await ipcRenderer.invoke('database@backup', backupPath);
  }
}

/**
 * 分类管理API
 */
export class CategoryAPI {
  /**
   * 获取所有分类
   */
  static async getAll(): Promise<FileCategory[]> {
    return await ipcRenderer.invoke('category@getAll');
  }

  /**
   * 创建分类
   */
  static async create(options: CreateCategoryOptions): Promise<FileCategory | null> {
    return await ipcRenderer.invoke('category@create', options);
  }

  /**
   * 更新分类
   */
  static async update(id: number, options: UpdateCategoryOptions): Promise<boolean> {
    return await ipcRenderer.invoke('category@update', id, options);
  }

  /**
   * 删除分类
   */
  static async delete(id: number): Promise<boolean> {
    return await ipcRenderer.invoke('category@delete', id);
  }

  /**
   * 获取分类统计
   */
  static async getStats(): Promise<Array<{ category: FileCategory; fileCount: number }>> {
    return await ipcRenderer.invoke('category@getStats');
  }

  /**
   * 重新排序分类
   */
  static async reorder(categoryIds: number[]): Promise<boolean> {
    return await ipcRenderer.invoke('category@reorder', categoryIds);
  }
}

// 导出便捷方法
export const dbAPI = DatabaseAPI;
export const categoryAPI = CategoryAPI;
