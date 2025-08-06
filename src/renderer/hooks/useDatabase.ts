/**
 * QuickStart 数据库管理 Hook
 * 提供数据库操作的React Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  DatabaseAPI,
  CategoryAPI,
  type FileItem,
  type FileCategory,
  type FileQuery,
  type AddFileOptions,
  type UpdateFileOptions
} from '../api/database-api';

export interface DatabaseStats {
  totalFiles: number;
  enabledFiles: number;
  favoriteFiles: number;
  pinnedFiles: number;
  categories: number;
}

export interface CategoryStats {
  category: FileCategory;
  fileCount: number;
}

/**
 * 数据库文件管理Hook
 */
export function useDatabase() {
  const { t } = useTranslation(['common']);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [categories, setCategories] = useState<FileCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<DatabaseStats | null>(null);

  // 加载所有文件
  const loadFiles = useCallback(async (query?: FileQuery) => {
    setLoading(true);
    try {
      const result = query ? await DatabaseAPI.queryFiles(query) : await DatabaseAPI.getAllFiles();
      setFiles(result);
    } catch (error) {
      console.error('Failed to load files:', error);
      message.error(t('common:messages.operationFailed', '操作失败'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // 加载分类
  const loadCategories = useCallback(async () => {
    try {
      const result = await CategoryAPI.getAll();
      setCategories(result);
    } catch (error) {
      console.error('Failed to load categories:', error);
      message.error(t('common:messages.operationFailed', '操作失败'));
    }
  }, [t]);

  // 加载统计信息
  const loadStats = useCallback(async () => {
    try {
      const result = await DatabaseAPI.getStats();
      setStats(result);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, []);

  // 添加文件
  const addFile = useCallback(async (filePath: string, options?: AddFileOptions) => {
    try {
      const result = await DatabaseAPI.addFile(filePath, options);
      if (result) {
        message.success(t('common:messages.fileAddSuccess', '文件添加成功'));
        await loadFiles();
        await loadStats();
        return result;
      } else {
        message.error(t('common:messages.fileAddFailed', '文件添加失败'));
        return null;
      }
    } catch (error) {
      console.error('Failed to add file:', error);
      message.error(t('common:messages.fileAddFailed', '文件添加失败'));
      return null;
    }
  }, [loadFiles, loadStats, t]);

  // 批量添加文件
  const addFiles = useCallback(async (filePaths: string[], options?: AddFileOptions) => {
    try {
      const results = await DatabaseAPI.addFiles(filePaths, options);
      if (results.length > 0) {
        message.success(`${t('common:messages.fileAddSuccess', '文件添加成功')}: ${results.length} 个文件`);
        await loadFiles();
        await loadStats();
        return results;
      } else {
        message.error(t('common:messages.fileAddFailed', '文件添加失败'));
        return [];
      }
    } catch (error) {
      console.error('Failed to add files:', error);
      message.error(t('common:messages.fileAddFailed', '文件添加失败'));
      return [];
    }
  }, [loadFiles, loadStats, t]);

  // 更新文件
  const updateFile = useCallback(async (id: string, updates: UpdateFileOptions) => {
    try {
      const success = await DatabaseAPI.updateFile(id, updates);
      if (success) {
        message.success(t('common:messages.operationSuccess', '操作成功'));
        await loadFiles();
        return true;
      } else {
        message.error(t('common:messages.operationFailed', '操作失败'));
        return false;
      }
    } catch (error) {
      console.error('Failed to update file:', error);
      message.error(t('common:messages.operationFailed', '操作失败'));
      return false;
    }
  }, [loadFiles, t]);

  // 删除文件
  const deleteFile = useCallback(async (id: string) => {
    try {
      const success = await DatabaseAPI.deleteFile(id);
      if (success) {
        message.success(t('common:messages.fileRemoveSuccess', '文件删除成功'));
        await loadFiles();
        await loadStats();
        return true;
      } else {
        message.error(t('common:messages.fileRemoveFailed', '文件删除失败'));
        return false;
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
      message.error(t('common:messages.fileRemoveError', '文件删除错误'));
      return false;
    }
  }, [loadFiles, loadStats, t]);

  // 启动文件
  const launchFile = useCallback(async (id: string, customArgs?: string[]) => {
    try {
      const success = await DatabaseAPI.launchFile(id, customArgs);
      if (success) {
        message.success(t('common:messages.fileLaunchSuccess', '文件启动成功'));
        await loadFiles(); // 刷新启动统计
        return true;
      } else {
        message.error(t('common:messages.fileLaunchFailed', '文件启动失败'));
        return false;
      }
    } catch (error) {
      console.error('Failed to launch file:', error);
      message.error(t('common:messages.fileLaunchFailed', '文件启动失败'));
      return false;
    }
  }, [loadFiles, t]);

  // 切换收藏状态
  const toggleFavorite = useCallback(async (id: string) => {
    try {
      const success = await DatabaseAPI.toggleFavorite(id);
      if (success) {
        await loadFiles();
        await loadStats();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      message.error(t('common:messages.operationFailed', '操作失败'));
      return false;
    }
  }, [loadFiles, loadStats, t]);

  // 切换置顶状态
  const togglePin = useCallback(async (id: string) => {
    try {
      const success = await DatabaseAPI.togglePin(id);
      if (success) {
        await loadFiles();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to toggle pin:', error);
      message.error(t('common:messages.operationFailed', '操作失败'));
      return false;
    }
  }, [loadFiles, t]);

  // 搜索文件
  const searchFiles = useCallback(async (searchTerm: string) => {
    setLoading(true);
    try {
      const results = await DatabaseAPI.searchFiles(searchTerm);
      setFiles(results);
      return results;
    } catch (error) {
      console.error('Failed to search files:', error);
      message.error(t('common:messages.operationFailed', '操作失败'));
      return [];
    } finally {
      setLoading(false);
    }
  }, [t]);

  // 初始化加载
  useEffect(() => {
    loadFiles();
    loadCategories();
    loadStats();
  }, [loadFiles, loadCategories, loadStats]);

  return {
    // 数据
    files,
    categories,
    loading,
    stats,
    
    // 文件操作
    addFile,
    addFiles,
    updateFile,
    deleteFile,
    launchFile,
    toggleFavorite,
    togglePin,
    searchFiles,
    
    // 数据加载
    loadFiles,
    loadCategories,
    loadStats,
    
    // 查询方法
    queryFiles: loadFiles
  };
}

/**
 * 分类管理Hook
 */
export function useCategories() {
  const { t } = useTranslation(['common']);
  const [categories, setCategories] = useState<FileCategory[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载分类
  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const result = await CategoryAPI.getAll();
      setCategories(result);
    } catch (error) {
      console.error('Failed to load categories:', error);
      message.error(t('common:messages.operationFailed', '操作失败'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // 加载分类统计
  const loadCategoryStats = useCallback(async () => {
    try {
      const result = await CategoryAPI.getStats();
      setCategoryStats(result);
    } catch (error) {
      console.error('Failed to load category stats:', error);
    }
  }, []);

  // 创建分类
  const createCategory = useCallback(async (name: string, options?: {
    description?: string;
    color?: string;
    icon?: string;
  }) => {
    try {
      const result = await CategoryAPI.create({ name, ...options });
      if (result) {
        message.success(t('common:messages.categoryCreateSuccess', '分类创建成功'));
        await loadCategories();
        await loadCategoryStats();
        return result;
      } else {
        message.error(t('common:messages.categoryCreateFailed', '分类创建失败'));
        return null;
      }
    } catch (error) {
      console.error('Failed to create category:', error);
      message.error(t('common:messages.categoryCreateFailed', '分类创建失败'));
      return null;
    }
  }, [loadCategories, loadCategoryStats, t]);

  // 更新分类
  const updateCategory = useCallback(async (id: number, updates: {
    name?: string;
    description?: string;
    color?: string;
    icon?: string;
  }) => {
    try {
      const success = await CategoryAPI.update(id, updates);
      if (success) {
        message.success(t('common:messages.operationSuccess', '操作成功'));
        await loadCategories();
        return true;
      } else {
        message.error(t('common:messages.operationFailed', '操作失败'));
        return false;
      }
    } catch (error) {
      console.error('Failed to update category:', error);
      message.error(t('common:messages.operationFailed', '操作失败'));
      return false;
    }
  }, [loadCategories, t]);

  // 删除分类
  const deleteCategory = useCallback(async (id: number) => {
    try {
      const success = await CategoryAPI.delete(id);
      if (success) {
        message.success(t('common:messages.operationSuccess', '操作成功'));
        await loadCategories();
        await loadCategoryStats();
        return true;
      } else {
        message.error(t('common:messages.operationFailed', '操作失败'));
        return false;
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
      message.error(t('common:messages.operationFailed', '操作失败'));
      return false;
    }
  }, [loadCategories, loadCategoryStats, t]);

  // 初始化加载
  useEffect(() => {
    loadCategories();
    loadCategoryStats();
  }, [loadCategories, loadCategoryStats]);

  return {
    categories,
    categoryStats,
    loading,
    createCategory,
    updateCategory,
    deleteCategory,
    loadCategories,
    loadCategoryStats
  };
}
