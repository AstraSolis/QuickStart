/**
 * QuickStart 文件分类数据访问层
 * 负责文件分类的数据库操作
 */

import { databaseManager, type FileCategoryDB } from './database-manager';
import log from 'electron-log';

export interface CreateCategoryInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
}

// 数据库查询结果类型
interface CategoryRow {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface CategoryStatsRow extends CategoryRow {
  file_count: number;
}

export class CategoryDAO {
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
   * 创建新的文件分类
   */
  public createCategory(input: CreateCategoryInput): FileCategoryDB {
    const stmt = this.db.prepare(`
      INSERT INTO file_categories (name, description, color, icon, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);

    try {
      const result = stmt.run(
        input.name,
        input.description ?? null,
        input.color ?? null,
        input.icon ?? null,
        input.sortOrder ?? 0
      );

      log.info('Category created:', { id: result.lastInsertRowid, name: input.name });
      const createdCategory = this.getCategoryById(result.lastInsertRowid as number);
      if (!createdCategory) {
        throw new Error('Failed to retrieve created category');
      }
      return createdCategory;
    } catch (error) {
      log.error('Failed to create category:', error);
      throw error;
    }
  }

  /**
   * 根据ID获取分类
   */
  public getCategoryById(id: number): FileCategoryDB | null {
    const stmt = this.db.prepare('SELECT * FROM file_categories WHERE id = ?');
    const row = stmt.get(id) as CategoryRow | undefined;

    if (!row) return null;

    return this.mapRowToCategory(row);
  }

  /**
   * 根据名称获取分类
   */
  public getCategoryByName(name: string): FileCategoryDB | null {
    const stmt = this.db.prepare('SELECT * FROM file_categories WHERE name = ?');
    const row = stmt.get(name) as CategoryRow | undefined;

    if (!row) return null;

    return this.mapRowToCategory(row);
  }

  /**
   * 获取所有分类
   */
  public getAllCategories(): FileCategoryDB[] {
    const stmt = this.db.prepare('SELECT * FROM file_categories ORDER BY sort_order ASC, name ASC');
    const rows = stmt.all() as CategoryRow[];

    return rows.map(row => this.mapRowToCategory(row));
  }

  /**
   * 更新分类
   */
  public updateCategory(id: number, input: UpdateCategoryInput): boolean {
    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    // 构建UPDATE语句
    Object.entries(input).forEach(([key, value]) => {
      if (value !== undefined) {
        switch (key) {
          case 'sortOrder':
            updates.push('sort_order = ?');
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

    const sql = `UPDATE file_categories SET ${updates.join(', ')} WHERE id = ?`;
    const stmt = this.db.prepare(sql);

    try {
      const result = stmt.run(...params);
      log.info('Category updated:', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      log.error('Failed to update category:', error);
      throw error;
    }
  }

  /**
   * 删除分类
   */
  public deleteCategory(id: number): boolean {
    // 检查是否有文件使用此分类
    const checkStmt = this.db.prepare('SELECT COUNT(*) as count FROM file_items WHERE category_id = ?');
    const result = checkStmt.get(id) as { count: number };
    
    if (result.count > 0) {
      throw new Error(`Cannot delete category: ${result.count} files are using this category`);
    }

    const stmt = this.db.prepare('DELETE FROM file_categories WHERE id = ?');
    
    try {
      const deleteResult = stmt.run(id);
      log.info('Category deleted:', { id, changes: deleteResult.changes });
      return deleteResult.changes > 0;
    } catch (error) {
      log.error('Failed to delete category:', error);
      throw error;
    }
  }

  /**
   * 获取分类统计信息
   */
  public getCategoryStats(): Array<{ category: FileCategoryDB; fileCount: number }> {
    const stmt = this.db.prepare(`
      SELECT 
        c.*,
        COUNT(f.id) as file_count
      FROM file_categories c
      LEFT JOIN file_items f ON c.id = f.category_id AND f.is_enabled = 1
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.name ASC
    `);

    const rows = stmt.all() as CategoryStatsRow[];

    return rows.map(row => ({
      category: this.mapRowToCategory(row),
      fileCount: row.file_count
    }));
  }

  /**
   * 重新排序分类
   */
  public reorderCategories(categoryIds: number[]): boolean {
    const updateStmt = this.db.prepare('UPDATE file_categories SET sort_order = ?, updated_at = ? WHERE id = ?');
    const now = new Date().toISOString();

    try {
      const transaction = this.db.transaction(() => {
        categoryIds.forEach((id, index) => {
          updateStmt.run(index, now, id);
        });
      });

      transaction();
      log.info('Categories reordered:', { count: categoryIds.length });
      return true;
    } catch (error) {
      log.error('Failed to reorder categories:', error);
      throw error;
    }
  }

  /**
   * 将数据库行映射为FileCategoryDB对象
   */
  private mapRowToCategory(row: CategoryRow): FileCategoryDB {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      color: row.color ?? undefined,
      icon: row.icon ?? undefined,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

// 导出单例实例
export const categoryDAO = new CategoryDAO();
