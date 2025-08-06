/**
 * QuickStart 日志分析器
 * 
 * 提供日志查询、统计、分析等功能
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { LogLevel, LogCategory, type LogEntry, type LogSource, type LogQueryOptions, type LogStats } from './types';

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const gunzip = promisify(zlib.gunzip);

/**
 * 日志分析器
 */
export class LogAnalyzer {
  private logDir: string;

  constructor(logDir: string) {
    this.logDir = logDir;
  }

  /**
   * 查询日志
   */
  async queryLogs(options: LogQueryOptions = {}): Promise<LogEntry[]> {
    const logFiles = await this.getLogFiles();
    const allEntries: LogEntry[] = [];

    for (const file of logFiles) {
      const entries = await this.parseLogFile(file);
      allEntries.push(...entries);
    }

    // 应用过滤条件
    let filteredEntries = this.applyFilters(allEntries, options);

    // 排序
    filteredEntries = this.sortEntries(filteredEntries, options);

    // 分页
    if (options.offset || options.limit) {
      const start = options.offset ?? 0;
      const end = options.limit ? start + options.limit : undefined;
      filteredEntries = filteredEntries.slice(start, end);
    }

    return filteredEntries;
  }

  /**
   * 获取日志统计信息
   */
  async getLogStats(): Promise<LogStats> {
    const entries = await this.queryLogs();
    
    const stats: LogStats = {
      totalLogs: entries.length,
      byLevel: {
        [LogLevel.TRACE]: 0,
        [LogLevel.DEBUG]: 0,
        [LogLevel.INFO]: 0,
        [LogLevel.WARN]: 0,
        [LogLevel.ERROR]: 0,
        [LogLevel.FATAL]: 0,
      },
      byCategory: {
        [LogCategory.APP]: 0,
        [LogCategory.CONFIG]: 0,
        [LogCategory.DB]: 0,
        [LogCategory.FILE]: 0,
        [LogCategory.UI]: 0,
        [LogCategory.I18N]: 0,
        [LogCategory.IPC]: 0,
        [LogCategory.PERF]: 0,
        [LogCategory.THEME]: 0,
        [LogCategory.BACKUP]: 0,
      },
      errorCount: 0,
      warningCount: 0,
      lastUpdated: new Date().toISOString(),
    };

    for (const entry of entries) {
      // 按级别统计
      stats.byLevel[entry.level]++;

      // 按分类统计
      if (entry.module.category in stats.byCategory) {
        stats.byCategory[entry.module.category]++;
      }

      // 错误和警告统计
      if (entry.level >= LogLevel.ERROR) {
        stats.errorCount++;
      } else if (entry.level === LogLevel.WARN) {
        stats.warningCount++;
      }
    }

    return stats;
  }

  /**
   * 搜索日志
   */
  async searchLogs(keyword: string, options: Partial<LogQueryOptions> = {}): Promise<LogEntry[]> {
    const searchOptions: LogQueryOptions = {
      ...options,
      keyword,
    };

    return this.queryLogs(searchOptions);
  }

  /**
   * 获取错误日志
   */
  async getErrorLogs(startTime?: string, endTime?: string): Promise<LogEntry[]> {
    return this.queryLogs({
      levels: [LogLevel.ERROR, LogLevel.FATAL],
      startTime,
      endTime,
      sortBy: 'timestamp',
      sortOrder: 'desc',
    });
  }

  /**
   * 获取性能日志
   */
  async getPerformanceLogs(startTime?: string, endTime?: string): Promise<LogEntry[]> {
    return this.queryLogs({
      categories: [LogCategory.PERF],
      startTime,
      endTime,
      sortBy: 'timestamp',
      sortOrder: 'desc',
    });
  }

  /**
   * 分析错误趋势
   */
  async analyzeErrorTrends(days: number = 7): Promise<{ date: string; count: number }[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const errorLogs = await this.getErrorLogs(
      startDate.toISOString(),
      endDate.toISOString()
    );

    const trendMap = new Map<string, number>();

    for (const entry of errorLogs) {
      const date = entry.timestamp.split('T')[0]; // YYYY-MM-DD
      trendMap.set(date, (trendMap.get(date) ?? 0) + 1);
    }

    const trends: { date: string; count: number }[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      trends.push({
        date: dateStr,
        count: trendMap.get(dateStr) ?? 0,
      });
    }

    return trends;
  }

  /**
   * 获取最频繁的错误
   */
  async getTopErrors(limit: number = 10): Promise<{ message: string; count: number; lastOccurred: string }[]> {
    const errorLogs = await this.getErrorLogs();
    const errorMap = new Map<string, { count: number; lastOccurred: string }>();

    for (const entry of errorLogs) {
      const message = entry.message;
      const existing = errorMap.get(message);
      
      if (existing) {
        existing.count++;
        if (entry.timestamp > existing.lastOccurred) {
          existing.lastOccurred = entry.timestamp;
        }
      } else {
        errorMap.set(message, {
          count: 1,
          lastOccurred: entry.timestamp,
        });
      }
    }

    return Array.from(errorMap.entries())
      .map(([message, data]) => ({ message, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * 获取日志文件列表
   */
  private async getLogFiles(): Promise<string[]> {
    try {
      const files: string[] = [];
      
      // 当前日志文件
      if (fs.existsSync(this.logDir)) {
        const currentFiles = await readdir(this.logDir);
        files.push(...currentFiles.filter(f => f.endsWith('.log')).map(f => path.join(this.logDir, f)));
      }

      // 归档日志文件
      const archiveDir = path.join(this.logDir, 'archives');
      if (fs.existsSync(archiveDir)) {
        const archiveFiles = await readdir(archiveDir);
        files.push(...archiveFiles.map(f => path.join(archiveDir, f)));
      }

      return files;
    } catch (error) {
      console.error('获取日志文件失败:', error);
      return [];
    }
  }

  /**
   * 解析日志文件
   */
  private async parseLogFile(filePath: string): Promise<LogEntry[]> {
    try {
      let content: string;

      if (filePath.endsWith('.gz')) {
        // 解压缩文件
        const compressed = await readFile(filePath);
        const decompressed = await gunzip(compressed);
        content = decompressed.toString('utf8');
      } else {
        content = await readFile(filePath, 'utf8');
      }

      const lines = content.split('\n').filter(line => line.trim());
      const entries: LogEntry[] = [];

      for (const line of lines) {
        try {
          // 尝试解析JSON格式的日志
          const entry = JSON.parse(line);
          if (this.isValidLogEntry(entry)) {
            entries.push(entry);
          }
        } catch {
          // 如果不是JSON格式，尝试解析文本格式
          const entry = this.parseTextLogLine(line);
          if (entry) {
            entries.push(entry);
          }
        }
      }

      return entries;
    } catch (error) {
      console.error(`Failed to parse log file ${filePath}:`, error);
      return [];
    }
  }

  /**
   * 验证日志条目
   */
  private isValidLogEntry(obj: unknown): obj is LogEntry {
    if (!obj || typeof obj !== 'object') return false;

    const entry = obj as Record<string, unknown>;

    // 基本字段检查
    if (typeof entry.timestamp !== 'string') return false;
    if (typeof entry.source !== 'string') return false;
    if (typeof entry.level !== 'number') return false;
    if (typeof entry.message !== 'string') return false;

    // module字段检查
    if (!entry.module || typeof entry.module !== 'object') return false;

    const module = entry.module as Record<string, unknown>;
    if (typeof module.category !== 'string') return false;
    if (typeof module.filename !== 'string') return false;

    return true;
  }

  /**
   * 解析文本格式的日志行
   */
  private parseTextLogLine(line: string): LogEntry | null {
    // 简单的文本日志解析，实际实现可能需要更复杂的正则表达式
    const match = line.match(/^\[([^\]]+)\] \[([^\]]+)\] +(\w+) \[([^\]]+)\] \(([^:]+):([^)]+)\) - (.+)$/);
    
    if (!match) {
      return null;
    }

    const [, timestamp, source, levelStr, process, category, filename, message] = match;

    return {
      timestamp,
      source: source.trim() as LogSource,
      level: this.parseLevelString(levelStr),
      process: this.parseProcessString(process),
      module: {
        category: category as LogCategory,
        filename,
      },
      message,
    };
  }

  /**
   * 解析日志级别字符串
   */
  private parseLevelString(levelStr: string): LogLevel {
    const level = levelStr.trim().toUpperCase();
    switch (level) {
      case 'TRACE': return LogLevel.TRACE;
      case 'DEBUG': return LogLevel.DEBUG;
      case 'INFO': return LogLevel.INFO;
      case 'WARN': return LogLevel.WARN;
      case 'ERROR': return LogLevel.ERROR;
      case 'FATAL': return LogLevel.FATAL;
      default: return LogLevel.INFO;
    }
  }

  /**
   * 解析进程字符串
   */
  private parseProcessString(processStr: string): { type: 'MAIN' | 'RENDERER' | 'WORKER'; pid: number; tid?: number } {
    const parts = processStr.split(':');
    return {
      type: parts[0] as 'MAIN' | 'RENDERER' | 'WORKER',
      pid: parseInt(parts[1]) || 0,
      tid: parts[2] ? parseInt(parts[2]) : undefined,
    };
  }

  /**
   * 应用过滤条件
   */
  private applyFilters(entries: LogEntry[], options: LogQueryOptions): LogEntry[] {
    let filtered = entries;

    // 时间范围过滤
    if (options.startTime) {
      const startTime = options.startTime;
      filtered = filtered.filter(entry => entry.timestamp >= startTime);
    }
    if (options.endTime) {
      const endTime = options.endTime;
      filtered = filtered.filter(entry => entry.timestamp <= endTime);
    }

    // 日志级别过滤
    if (options.levels && options.levels.length > 0) {
      const levels = options.levels;
      filtered = filtered.filter(entry => levels.includes(entry.level));
    }

    // 分类过滤
    if (options.categories && options.categories.length > 0) {
      const categories = options.categories;
      filtered = filtered.filter(entry => categories.includes(entry.module.category));
    }

    // 来源过滤
    if (options.sources && options.sources.length > 0) {
      const sources = options.sources;
      filtered = filtered.filter(entry => sources.includes(entry.source));
    }

    // 关键词搜索
    if (options.keyword) {
      const keyword = options.keyword.toLowerCase();
      filtered = filtered.filter(entry => 
        entry.message.toLowerCase().includes(keyword) ||
        entry.module.filename.toLowerCase().includes(keyword)
      );
    }

    // 正则表达式搜索
    if (options.regex) {
      try {
        const regex = new RegExp(options.regex, 'i');
        filtered = filtered.filter(entry => 
          regex.test(entry.message) || regex.test(entry.module.filename)
        );
      } catch {
        console.error('无效的正则表达式模式:', options.regex);
      }
    }

    return filtered;
  }

  /**
   * 排序日志条目
   */
  private sortEntries(entries: LogEntry[], options: LogQueryOptions): LogEntry[] {
    const sortBy = options.sortBy ?? 'timestamp';
    const sortOrder = options.sortOrder ?? 'desc';

    return entries.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'timestamp':
          comparison = a.timestamp.localeCompare(b.timestamp);
          break;
        case 'level':
          comparison = a.level - b.level;
          break;
        case 'category':
          comparison = a.module.category.localeCompare(b.module.category);
          break;
        default:
          comparison = a.timestamp.localeCompare(b.timestamp);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }
}
