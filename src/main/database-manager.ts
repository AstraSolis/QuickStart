/**
 * QuickStart SQLite 数据库管理器
 * 负责文件列表的数据库存储和管理
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import log from 'electron-log';
import { getAppDataPath } from './config';

// 文件项数据库接口
export interface FileItemDB {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  description?: string; // 文件备注
  launchArgs?: string; // 启动参数
  requireAdmin: boolean; // 是否需要管理员权限
  category?: string; // 文件分类
  tags?: string; // 标签（JSON字符串）
  iconPath?: string; // 自定义图标路径
  size?: number; // 文件大小
  lastModified: string; // 最后修改时间（ISO字符串）
  addedAt: string; // 添加时间（ISO字符串）
  lastLaunched?: string; // 最后启动时间（ISO字符串）
  launchCount: number; // 启动次数
  isFavorite: boolean; // 是否收藏
  isPinned: boolean; // 是否置顶
  sortOrder: number; // 排序顺序
  isEnabled: boolean; // 是否启用
  createdAt: string; // 创建时间（ISO字符串）
  updatedAt: string; // 更新时间（ISO字符串）
}

// 启动历史记录接口
export interface LaunchHistoryDB {
  id: number;
  fileId: string;
  launchedAt: string; // 启动时间（ISO字符串）
  launchArgs?: string; // 启动时使用的参数
  success: boolean; // 是否启动成功
  errorMessage?: string; // 错误信息
  duration?: number; // 启动耗时（毫秒）
}

// 文件分类接口
export interface FileCategoryDB {
  id: number;
  name: string;
  description?: string;
  color?: string; // 分类颜色
  icon?: string; // 分类图标
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export class DatabaseManager {
  private db?: Database.Database;
  private dbPath: string = '';
  private isInitialized: boolean = false;

  constructor() {
    // 延迟初始化，等待app ready
  }

  /**
   * 初始化数据库管理器
   */
  public initialize(): void {
    if (this.isInitialized) {
      return;
    }

    // 确保数据库目录存在
    const dbDir = join(getAppDataPath(), 'database');
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    this.dbPath = join(dbDir, 'quickstart.db');
    this.initializeDatabase();
  }

  /**
   * 初始化数据库连接和表结构
   */
  private initializeDatabase(): void {
    try {
      // 创建数据库连接
      this.db = new Database(this.dbPath);

      // 启用WAL模式以提高性能
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');

      // 创建表结构
      this.createTables();

      this.isInitialized = true;
      log.info('Database initialized successfully:', this.dbPath);
    } catch (error) {
      log.error('Failed to initialize database:', error);
      log.warn('Database functionality will be disabled');
      this.isInitialized = false;
      this.db = undefined;
    }
  }

  /**
   * 创建数据库表结构
   */
  private createTables(): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    // 文件分类表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        color TEXT,
        icon TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // 文件项表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL CHECK (type IN ('file', 'folder')),
        description TEXT,
        launch_args TEXT,
        require_admin INTEGER NOT NULL DEFAULT 0,
        category_id INTEGER,
        tags TEXT, -- JSON字符串存储标签数组
        icon_path TEXT,
        size INTEGER,
        last_modified TEXT NOT NULL,
        added_at TEXT NOT NULL,
        last_launched TEXT,
        launch_count INTEGER NOT NULL DEFAULT 0,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        is_enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (category_id) REFERENCES file_categories(id) ON DELETE SET NULL
      )
    `);

    // 启动历史记录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS launch_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id TEXT NOT NULL,
        launched_at TEXT NOT NULL DEFAULT (datetime('now')),
        launch_args TEXT,
        success INTEGER NOT NULL DEFAULT 1,
        error_message TEXT,
        duration INTEGER, -- 启动耗时（毫秒）
        FOREIGN KEY (file_id) REFERENCES file_items(id) ON DELETE CASCADE
      )
    `);

    // 创建索引以提高查询性能
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_file_items_path ON file_items(path);
      CREATE INDEX IF NOT EXISTS idx_file_items_type ON file_items(type);
      CREATE INDEX IF NOT EXISTS idx_file_items_category ON file_items(category_id);
      CREATE INDEX IF NOT EXISTS idx_file_items_favorite ON file_items(is_favorite);
      CREATE INDEX IF NOT EXISTS idx_file_items_pinned ON file_items(is_pinned);
      CREATE INDEX IF NOT EXISTS idx_file_items_enabled ON file_items(is_enabled);
      CREATE INDEX IF NOT EXISTS idx_launch_history_file_id ON launch_history(file_id);
      CREATE INDEX IF NOT EXISTS idx_launch_history_launched_at ON launch_history(launched_at);
    `);

    // 插入默认分类
    this.insertDefaultCategories();
  }

  /**
   * 插入默认文件分类
   */
  private insertDefaultCategories(): void {
    if (!this.db) {
      return;
    }
    const defaultCategories = [
      { name: '应用程序', description: '可执行程序和应用', color: '#1890ff', icon: 'AppstoreOutlined' },
      { name: '文档', description: '文档和文本文件', color: '#52c41a', icon: 'FileTextOutlined' },
      { name: '媒体', description: '图片、音频和视频文件', color: '#fa8c16', icon: 'PlayCircleOutlined' },
      { name: '开发工具', description: '开发相关工具和IDE', color: '#722ed1', icon: 'CodeOutlined' },
      { name: '系统工具', description: '系统管理和维护工具', color: '#eb2f96', icon: 'SettingOutlined' },
      { name: '其他', description: '其他类型文件', color: '#8c8c8c', icon: 'FolderOutlined' }
    ];

    const insertCategory = this.db.prepare(`
      INSERT OR IGNORE INTO file_categories (name, description, color, icon, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);

    defaultCategories.forEach((category, index) => {
      insertCategory.run(category.name, category.description, category.color, category.icon, index);
    });
  }

  /**
   * 获取数据库连接
   */
  public getDatabase(): Database.Database | undefined {
    return this.db;
  }

  /**
   * 检查数据库是否已初始化
   */
  public isReady(): boolean {
    return this.isInitialized && this.db !== undefined;
  }

  /**
   * 关闭数据库连接
   */
  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = undefined;
      this.isInitialized = false;
      log.info('Database connection closed');
    }
  }

  /**
   * 执行数据库备份
   */
  public async backup(backupPath: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      await this.db.backup(backupPath);
      log.info('Database backup completed:', backupPath);
    } catch (error) {
      log.error('Database backup failed:', error);
      throw error;
    }
  }

  /**
   * 获取数据库统计信息
   */
  public getStats(): {
    fileCount: number;
    categoryCount: number;
    launchHistoryCount: number;
    dbSize: number;
  } {
    if (!this.db) {
      return {
        fileCount: 0,
        categoryCount: 0,
        launchHistoryCount: 0,
        dbSize: 0
      };
    }

    const fileCount = this.db.prepare('SELECT COUNT(*) as count FROM file_items').get() as { count: number };
    const categoryCount = this.db.prepare('SELECT COUNT(*) as count FROM file_categories').get() as { count: number };
    const launchHistoryCount = this.db.prepare('SELECT COUNT(*) as count FROM launch_history').get() as { count: number };

    // 获取数据库文件大小
    const dbSizeQuery = this.db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get() as { size: number };

    return {
      fileCount: fileCount.count,
      categoryCount: categoryCount.count,
      launchHistoryCount: launchHistoryCount.count,
      dbSize: dbSizeQuery.size
    };
  }
}

// 导出单例实例
export const databaseManager = new DatabaseManager();
