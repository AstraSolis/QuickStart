/**
 * QuickStart 日志格式化器
 * 
 * 实现统一的日志格式规范：
 * [时间戳] [来源] [日志级别] [进程/线程] [模块/文件] - 消息内容
 */

import {
  LogLevel,
  type LogEntry,
  type LogSource,
  type ProcessInfo,
  type ModuleInfo,
  type ILogFormatter,
  type LogFormatOptions
} from './types';

/**
 * 颜色代码 (ANSI)
 */
const Colors = {
  RESET: '\x1b[0m',
  BRIGHT: '\x1b[1m',
  DIM: '\x1b[2m',
  
  // 前景色
  BLACK: '\x1b[30m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  WHITE: '\x1b[37m',
  
  // 背景色
  BG_RED: '\x1b[41m',
  BG_GREEN: '\x1b[42m',
  BG_YELLOW: '\x1b[43m',
  BG_BLUE: '\x1b[44m',
} as const;

/**
 * 日志级别颜色映射
 */
const LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.TRACE]: Colors.DIM + Colors.WHITE,
  [LogLevel.DEBUG]: Colors.CYAN,
  [LogLevel.INFO]: Colors.GREEN,
  [LogLevel.WARN]: Colors.YELLOW,
  [LogLevel.ERROR]: Colors.RED,
  [LogLevel.FATAL]: Colors.BG_RED + Colors.WHITE + Colors.BRIGHT,
};

/**
 * 日志格式化器实现
 */
export class LogFormatter implements ILogFormatter {
  private readonly defaultOptions: Required<LogFormatOptions> = {
    colors: false,
    includeStack: false,
    timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS',
    compactJson: true,
  };

  /**
   * 格式化日志条目
   */
  format(entry: LogEntry, options?: LogFormatOptions): string {
    const opts = { ...this.defaultOptions, ...options };
    
    const timestamp = this.formatTimestamp(entry.timestamp);
    const source = this.formatSource(entry.source);
    const level = this.formatLevel(entry.level);
    const process = this.formatProcess(entry.process);
    const module = this.formatModule(entry.module);
    
    // 基础格式：[时间戳] [来源] [日志级别] [进程/线程] [模块/文件] - 消息内容
    let formatted = `[${timestamp}] ${source} ${level} [${process}] (${module}) - ${entry.message}`;
    
    // 添加事务ID
    if (entry.transactionId) {
      formatted += ` [TXN:${entry.transactionId}]`;
    }
    
    // 添加结构化数据
    if (entry.data && Object.keys(entry.data).length > 0) {
      const dataStr = opts.compactJson 
        ? JSON.stringify(entry.data)
        : JSON.stringify(entry.data, null, 2);
      formatted += `\n  Data: ${dataStr}`;
    }
    
    // 添加错误信息
    if (entry.error) {
      formatted += `\n  Error: ${entry.error.message}`;
      if (opts.includeStack && entry.error.stack) {
        formatted += `\n  Stack: ${entry.error.stack}`;
      }
    }
    
    // 添加颜色
    if (opts.colors) {
      formatted = this.addColors(formatted, entry.level);
    }
    
    return formatted;
  }

  /**
   * 格式化时间戳
   * 格式: YYYY-MM-DD HH:mm:ss.SSS
   */
  formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
  }

  /**
   * 格式化来源
   * 使用[]包裹，不固定字符宽度
   */
  formatSource(source: LogSource): string {
    return `[${source}]`;
  }

  /**
   * 格式化日志级别
   * 使用[]包裹，不固定字符宽度
   */
  formatLevel(level: LogLevel): string {
    const levelName = LogLevel[level];
    return `[${levelName}]`;
  }

  /**
   * 格式化进程信息
   * 格式: TYPE:PID 或 TYPE:PID:TID
   */
  formatProcess(process: ProcessInfo): string {
    let formatted = `${process.type}:${process.pid}`;
    if (process.tid !== undefined) {
      formatted += `:${process.tid}`;
    }
    return formatted;
  }

  /**
   * 格式化模块信息
   * 格式: category:filename
   */
  formatModule(module: ModuleInfo): string {
    return `${module.category}:${module.filename}`;
  }

  /**
   * 添加颜色代码
   */
  private addColors(text: string, level: LogLevel): string {
    const color = LEVEL_COLORS[level];
    return `${color}${text}${Colors.RESET}`;
  }

  /**
   * 格式化为JSON格式 (用于文件存储)
   */
  formatAsJson(entry: LogEntry): string {
    return JSON.stringify({
      timestamp: entry.timestamp,
      source: entry.source,
      level: LogLevel[entry.level],
      process: entry.process,
      module: entry.module,
      message: entry.message,
      transactionId: entry.transactionId,
      data: entry.data,
      error: entry.error ? {
        name: entry.error.name,
        message: entry.error.message,
        stack: entry.error.stack,
      } : undefined,
      userId: entry.userId,
      sessionId: entry.sessionId,
    });
  }

  /**
   * 格式化为CSV格式 (用于导出)
   */
  formatAsCsv(entry: LogEntry): string {
    const escapeCsv = (value: string): string => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const fields = [
      this.formatTimestamp(entry.timestamp),
      entry.source,
      LogLevel[entry.level],
      this.formatProcess(entry.process),
      this.formatModule(entry.module),
      escapeCsv(entry.message),
      entry.transactionId ?? '',
      entry.data ? escapeCsv(JSON.stringify(entry.data)) : '',
      entry.error ? escapeCsv(entry.error.message) : '',
    ];

    return fields.join(',');
  }

  /**
   * 获取CSV头部
   */
  getCsvHeader(): string {
    return [
      'Timestamp',
      'Source',
      'Level',
      'Process',
      'Module',
      'Message',
      'TransactionId',
      'Data',
      'Error',
    ].join(',');
  }

  /**
   * 格式化为简洁格式 (用于控制台)
   */
  formatCompact(entry: LogEntry): string {
    const time = this.formatTimestamp(entry.timestamp).split(' ')[1]; // 只显示时间部分
    const level = LogLevel[entry.level].charAt(0); // 只显示级别首字母
    const module = entry.module.filename.split('.')[0]; // 只显示文件名（不含扩展名）
    
    return `${time} ${level} ${module}: ${entry.message}`;
  }

  /**
   * 格式化为详细格式 (用于调试)
   */
  formatDetailed(entry: LogEntry): string {
    let formatted = this.format(entry, { 
      colors: false, 
      includeStack: true, 
      compactJson: false 
    });
    
    // 添加额外的调试信息
    if (entry.userId) {
      formatted += `\n  UserId: ${entry.userId}`;
    }
    
    if (entry.sessionId) {
      formatted += `\n  SessionId: ${entry.sessionId}`;
    }
    
    return formatted;
  }
}
