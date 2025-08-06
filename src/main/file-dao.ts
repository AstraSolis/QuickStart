/**
 * QuickStart 文件数据访问层
 * 负责文件项的数据库操作
 */

import { databaseManager, type FileItemDB, type LaunchHistoryDB } from './database-manager';
import log from 'electron-log';
import { v4 as uuidv4 } from 'uuid';

// 数据库行类型定义
interface FileItemRow {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  description: string | null;
  launch_args: string | null;
  require_admin: number;
  category_id: number | null;
  tags: string | null;
  icon_path: string | null;
  size: number | null;
  last_modified: string;
  added_at: string;
  last_launched: string | null;
  launch_count: number;
  is_favorite: number;
  is_pinned: number;
  sort_order: number;
  is_enabled: number;
  created_at: string;
  updated_at: string;
}

interface LaunchHistoryRow {
  id: number;
  file_id: string;
  launched_at: string;
  launch_args: string | null;
  success: number;
  error_message: string | null;
  duration: number | null;
}

export interface CreateFileItemInput {
  name: string;
  path: string;
  type: 'file' | 'folder';
  description?: string;
  launchArgs?: string;
  requireAdmin?: boolean;
  categoryId?: number;
  tags?: string[];
  iconPath?: string;
  size?: number;
  lastModified: Date;
}

export interface UpdateFileItemInput {
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

export interface FileItemQuery {
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

export class FileDAO {
  private get db() {
    if (!databaseManager.isReady()) {
      throw new Error('Database is not initialized');
    }
    const database = databaseManager.getDatabase();
    if (!database) {
      throw new Error('Database connection is not available');
    }
    return database;
  }

  /**
   * 创建新的文件项
   */
  public createFileItem(input: CreateFileItemInput): FileItemDB {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO file_items (
        id, name, path, type, description, launch_args, require_admin,
        category_id, tags, icon_path, size, last_modified, added_at,
        launch_count, is_favorite, is_pinned, sort_order, is_enabled,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      stmt.run(
        id,
        input.name,
        input.path,
        input.type,
        input.description ?? null,
        input.launchArgs ?? null,
        input.requireAdmin ? 1 : 0,
        input.categoryId ?? null,
        input.tags ? JSON.stringify(input.tags) : null,
        input.iconPath ?? null,
        input.size ?? null,
        input.lastModified.toISOString(),
        now,
        0, // launch_count
        0, // is_favorite
        0, // is_pinned
        0, // sort_order
        1, // is_enabled
        now,
        now
      );

      log.info('File item created:', { id, path: input.path });
      const fileItem = this.getFileItemById(id);
      if (!fileItem) {
        throw new Error(`Failed to retrieve created file item with id: ${id}`);
      }
      return fileItem;
    } catch (error) {
      log.error('Failed to create file item:', error);
      throw error;
    }
  }

  /**
   * 根据ID获取文件项
   */
  public getFileItemById(id: string): FileItemDB | null {
    const stmt = this.db.prepare('SELECT * FROM file_items WHERE id = ?');
    const row = stmt.get(id) as FileItemRow | undefined;

    if (!row) return null;

    return this.mapRowToFileItem(row);
  }

  /**
   * 根据路径获取文件项
   */
  public getFileItemByPath(path: string): FileItemDB | null {
    const stmt = this.db.prepare('SELECT * FROM file_items WHERE path = ?');
    const row = stmt.get(path) as FileItemRow | undefined;

    if (!row) return null;

    return this.mapRowToFileItem(row);
  }

  /**
   * 查询文件项列表
   */
  public queryFileItems(query: FileItemQuery = {}): FileItemDB[] {
    let sql = 'SELECT * FROM file_items WHERE 1=1';
    const params: unknown[] = [];

    // 构建WHERE条件
    if (query.type) {
      sql += ' AND type = ?';
      params.push(query.type);
    }

    if (query.categoryId !== undefined) {
      sql += ' AND category_id = ?';
      params.push(query.categoryId);
    }

    if (query.isFavorite !== undefined) {
      sql += ' AND is_favorite = ?';
      params.push(query.isFavorite ? 1 : 0);
    }

    if (query.isPinned !== undefined) {
      sql += ' AND is_pinned = ?';
      params.push(query.isPinned ? 1 : 0);
    }

    if (query.isEnabled !== undefined) {
      sql += ' AND is_enabled = ?';
      params.push(query.isEnabled ? 1 : 0);
    }

    if (query.searchTerm) {
      sql += ' AND (name LIKE ? OR description LIKE ? OR path LIKE ?)';
      const searchPattern = `%${query.searchTerm}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    // 排序
    const sortBy = query.sortBy ?? 'sort_order';
    const sortOrder = query.sortOrder ?? 'ASC';

    // 将前端字段名映射为数据库列名
    const columnMapping: { [key: string]: string } = {
      'sortOrder': 'sort_order',
      'addedAt': 'added_at',
      'lastLaunched': 'last_launched',
      'launchCount': 'launch_count'
    };

    const dbColumn = columnMapping[sortBy] || sortBy;
    sql += ` ORDER BY ${dbColumn} ${sortOrder}`;

    // 分页
    if (query.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
      
      if (query.offset) {
        sql += ' OFFSET ?';
        params.push(query.offset);
      }
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as FileItemRow[];

    return rows.map(row => this.mapRowToFileItem(row));
  }

  /**
   * 更新文件项
   */
  public updateFileItem(id: string, input: UpdateFileItemInput): boolean {
    const updates: string[] = [];
    const params: unknown[] = [];

    // 构建UPDATE语句
    Object.entries(input).forEach(([key, value]) => {
      if (value !== undefined) {
        switch (key) {
          case 'requireAdmin':
            updates.push('require_admin = ?');
            params.push(value ? 1 : 0);
            break;
          case 'categoryId':
            updates.push('category_id = ?');
            params.push(value);
            break;
          case 'tags':
            updates.push('tags = ?');
            params.push(Array.isArray(value) ? JSON.stringify(value) : value);
            break;
          case 'iconPath':
            updates.push('icon_path = ?');
            params.push(value);
            break;
          case 'isFavorite':
            updates.push('is_favorite = ?');
            params.push(value ? 1 : 0);
            break;
          case 'isPinned':
            updates.push('is_pinned = ?');
            params.push(value ? 1 : 0);
            break;
          case 'sortOrder':
            updates.push('sort_order = ?');
            params.push(value);
            break;
          case 'isEnabled':
            updates.push('is_enabled = ?');
            params.push(value ? 1 : 0);
            break;
          case 'launchArgs':
            updates.push('launch_args = ?');
            params.push(value);
            break;
          default:
            updates.push(`${key} = ?`);
            params.push(value);
        }
      }
    });

    if (updates.length === 0) return false;

    // 添加更新时间
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    const sql = `UPDATE file_items SET ${updates.join(', ')} WHERE id = ?`;
    const stmt = this.db.prepare(sql);

    try {
      const result = stmt.run(...params);
      log.info('File item updated:', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      log.error('Failed to update file item:', error);
      throw error;
    }
  }

  /**
   * 删除文件项
   */
  public deleteFileItem(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM file_items WHERE id = ?');
    
    try {
      const result = stmt.run(id);
      log.info('File item deleted:', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      log.error('Failed to delete file item:', error);
      throw error;
    }
  }

  /**
   * 记录文件启动
   */
  public recordLaunch(fileId: string, launchArgs?: string, success: boolean = true, errorMessage?: string, duration?: number): void {
    // 插入启动历史记录
    const insertHistory = this.db.prepare(`
      INSERT INTO launch_history (file_id, launched_at, launch_args, success, error_message, duration)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // 更新文件项的启动统计
    const updateFile = this.db.prepare(`
      UPDATE file_items 
      SET launch_count = launch_count + 1, last_launched = ?, updated_at = ?
      WHERE id = ?
    `);

    const now = new Date().toISOString();

    try {
      // 使用事务确保数据一致性
      const transaction = this.db.transaction(() => {
        insertHistory.run(fileId, now, launchArgs ?? null, success ? 1 : 0, errorMessage ?? null, duration ?? null);
        updateFile.run(now, now, fileId);
      });

      transaction();
      log.info('Launch recorded:', { fileId, success });
    } catch (error) {
      log.error('Failed to record launch:', error);
      throw error;
    }
  }

  /**
   * 获取启动历史记录
   */
  public getLaunchHistory(fileId: string, limit: number = 50): LaunchHistoryDB[] {
    const stmt = this.db.prepare(`
      SELECT * FROM launch_history
      WHERE file_id = ?
      ORDER BY launched_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(fileId, limit) as LaunchHistoryRow[];
    return rows.map(row => ({
      id: row.id,
      fileId: row.file_id,
      launchedAt: row.launched_at,
      launchArgs: row.launch_args ?? undefined,
      success: row.success === 1,
      errorMessage: row.error_message ?? undefined,
      duration: row.duration ?? undefined
    }));
  }

  /**
   * 将数据库行映射为FileItemDB对象
   */
  private mapRowToFileItem(row: FileItemRow): FileItemDB {
    return {
      id: row.id,
      name: row.name,
      path: row.path,
      type: row.type,
      description: row.description ?? undefined,
      launchArgs: row.launch_args ?? undefined,
      requireAdmin: row.require_admin === 1,
      category: row.category_id?.toString() ?? undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      iconPath: row.icon_path ?? undefined,
      size: row.size ?? undefined,
      lastModified: row.last_modified,
      addedAt: row.added_at,
      lastLaunched: row.last_launched ?? undefined,
      launchCount: row.launch_count,
      isFavorite: row.is_favorite === 1,
      isPinned: row.is_pinned === 1,
      sortOrder: row.sort_order,
      isEnabled: row.is_enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

// 导出单例实例
export const fileDAO = new FileDAO();
