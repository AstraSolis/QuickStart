/**
 * QuickStart 结构化日志系统类型定义
 * 
 * 实现统一的日志格式规范：
 * [时间戳] [来源] [日志级别] [进程/线程] [模块/文件] - 消息内容
 */

/**
 * 日志级别枚举
 */
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5
}

/**
 * 日志来源类型
 */
export enum LogSource {
  MAIN = 'MAIN',           // 主进程
  RENDERER = 'RENDERER',   // 渲染进程
  PRELOAD = 'PRELOAD'      // 预加载脚本
}

/**
 * 日志分类
 */
export enum LogCategory {
  APP = 'app',         // 应用程序核心
  CONFIG = 'config',   // 配置管理
  DB = 'db',          // 数据库操作
  FILE = 'file',      // 文件管理
  UI = 'ui',          // 用户界面
  I18N = 'i18n',      // 国际化
  IPC = 'ipc',        // 进程间通信
  PERF = 'perf',      // 性能监控
  THEME = 'theme',    // 主题系统
  BACKUP = 'backup'   // 备份系统
}

/**
 * 进程/线程信息
 */
export interface ProcessInfo {
  type: 'MAIN' | 'RENDERER' | 'WORKER';
  pid: number;
  tid?: number;
}

/**
 * 模块信息
 */
export interface ModuleInfo {
  category: LogCategory;
  filename: string;
}

/**
 * 日志条目接口
 */
export interface LogEntry {
  /** 时间戳 (ISO 8601格式) */
  timestamp: string;
  
  /** 来源 */
  source: LogSource;
  
  /** 日志级别 */
  level: LogLevel;
  
  /** 进程信息 */
  process: ProcessInfo;
  
  /** 模块信息 */
  module: ModuleInfo;
  
  /** 消息内容 */
  message: string;
  
  /** 事务ID (用于链路追踪) */
  transactionId?: string;
  
  /** 结构化数据 */
  data?: Record<string, unknown>;
  
  /** 错误对象 */
  error?: Error;
  
  /** 用户ID (脱敏处理) */
  userId?: string;
  
  /** 会话ID */
  sessionId?: string;
}

/**
 * 日志格式化选项
 */
export interface LogFormatOptions {
  /** 是否包含颜色 */
  colors?: boolean;
  
  /** 是否包含堆栈跟踪 */
  includeStack?: boolean;
  
  /** 时间戳格式 */
  timestampFormat?: string;
  
  /** 是否压缩JSON */
  compactJson?: boolean;
}

/**
 * 日志配置接口
 */
export interface LogConfig {
  /** 日志级别 */
  level: LogLevel;
  
  /** 是否启用文件日志 */
  enableFile: boolean;
  
  /** 是否启用控制台日志 */
  enableConsole: boolean;
  
  /** 日志文件路径 */
  logDir: string;
  
  /** 最大文件大小 (MB) */
  maxFileSize: number;
  
  /** 最大文件数量 */
  maxFiles: number;
  
  /** 日志保留天数 */
  retentionDays: number;
  
  /** 是否启用压缩 */
  enableCompression: boolean;
  
  /** 缓冲区大小 */
  bufferSize: number;
  
  /** 刷新间隔 (ms) */
  flushInterval: number;
}

/**
 * 日志记录器接口
 */
export interface ILogger {
  /** 记录TRACE级别日志 */
  trace(message: string, category: LogCategory, filename: string, data?: Record<string, unknown>, error?: Error): Promise<void>;
  
  /** 记录DEBUG级别日志 */
  debug(message: string, category: LogCategory, filename: string, data?: Record<string, unknown>, error?: Error): Promise<void>;
  
  /** 记录INFO级别日志 */
  info(message: string, category: LogCategory, filename: string, data?: Record<string, unknown>, error?: Error): Promise<void>;
  
  /** 记录WARN级别日志 */
  warn(message: string, category: LogCategory, filename: string, data?: Record<string, unknown>, error?: Error): Promise<void>;
  
  /** 记录ERROR级别日志 */
  error(message: string, category: LogCategory, filename: string, data?: Record<string, unknown>, error?: Error): Promise<void>;
  
  /** 记录FATAL级别日志 */
  fatal(message: string, category: LogCategory, filename: string, data?: Record<string, unknown>, error?: Error): Promise<void>;
}

/**
 * 日志文件管理器接口
 */
export interface ILogFileManager {
  /** 写入日志到文件 */
  writeLog(entry: LogEntry, formatted: string): Promise<void>;
  
  /** 轮转日志文件 */
  rotateLog(filename: string): Promise<void>;
  
  /** 压缩日志文件 */
  compressLog(filename: string): Promise<void>;
  
  /** 清理过期日志 */
  cleanupOldLogs(): Promise<void>;
  
  /** 获取日志文件列表 */
  getLogFiles(): Promise<string[]>;
}

/**
 * 日志格式化器接口
 */
export interface ILogFormatter {
  /** 格式化日志条目 */
  format(entry: LogEntry, options?: LogFormatOptions): string;
  
  /** 格式化时间戳 */
  formatTimestamp(timestamp: string): string;
  
  /** 格式化进程信息 */
  formatProcess(process: ProcessInfo): string;
  
  /** 格式化模块信息 */
  formatModule(module: ModuleInfo): string;
  
  /** 格式化日志级别 */
  formatLevel(level: LogLevel): string;
  
  /** 格式化来源 */
  formatSource(source: LogSource): string;
}

/**
 * 日志事件类型
 */
export interface LogEvents {
  'log': (entry: LogEntry) => void;
  'error': (error: Error) => void;
  'rotate': (filename: string) => void;
  'cleanup': (deletedFiles: string[]) => void;
}

/**
 * 支持的语言类型 (与项目i18n保持一致)
 */
export type SupportedLanguage = 'zh-CN' | 'en' | 'ru' | 'fr';

/**
 * 日志统计信息
 */
export interface LogStats {
  /** 总日志数量 */
  totalLogs: number;
  
  /** 按级别统计 */
  byLevel: Record<LogLevel, number>;
  
  /** 按分类统计 */
  byCategory: Record<LogCategory, number>;
  
  /** 错误数量 */
  errorCount: number;
  
  /** 警告数量 */
  warningCount: number;
  
  /** 最后更新时间 */
  lastUpdated: string;
}

/**
 * 日志查询选项
 */
export interface LogQueryOptions {
  /** 开始时间 */
  startTime?: string;
  
  /** 结束时间 */
  endTime?: string;
  
  /** 日志级别过滤 */
  levels?: LogLevel[];
  
  /** 分类过滤 */
  categories?: LogCategory[];
  
  /** 来源过滤 */
  sources?: LogSource[];
  
  /** 关键词搜索 */
  keyword?: string;
  
  /** 正则表达式搜索 */
  regex?: string;
  
  /** 限制数量 */
  limit?: number;
  
  /** 偏移量 */
  offset?: number;
  
  /** 排序方式 */
  sortBy?: 'timestamp' | 'level' | 'category';
  
  /** 排序顺序 */
  sortOrder?: 'asc' | 'desc';
}
