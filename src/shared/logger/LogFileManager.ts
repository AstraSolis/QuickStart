/**
 * QuickStart 日志文件管理器
 * 
 * 实现日志文件的轮转、压缩、清理等功能
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';
import type { LogEntry, LogConfig, ILogFileManager } from './types';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const appendFile = promisify(fs.appendFile);
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);
const rename = promisify(fs.rename);
const gzip = promisify(zlib.gzip);

/**
 * 日志文件管理器实现
 */
export class LogFileManager implements ILogFileManager {
  private readonly config: LogConfig;
  private readonly writeStreams: Map<string, fs.WriteStream> = new Map();
  private readonly buffers: Map<string, string[]> = new Map();
  private flushTimer?: NodeJS.Timeout;
  private sessionId?: string;

  constructor(config: LogConfig) {
    this.config = config;
    this.ensureLogDirectory();
    this.startFlushTimer();
  }

  /**
   * 确保日志目录存在
   */
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.config.logDir)) {
      fs.mkdirSync(this.config.logDir, { recursive: true });
    }

    // 创建归档目录
    const archiveDir = path.join(this.config.logDir, 'archives');
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }
  }

  /**
   * 启动定时刷新
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flushAllBuffers().catch(console.error);
    }, this.config.flushInterval);
  }

  /**
   * 写入日志到文件
   */
  async writeLog(entry: LogEntry, formatted: string): Promise<void> {
    if (!this.config.enableFile) {
      return;
    }

    try {
      const filename = this.getLogFilename(entry);
      const filepath = path.join(this.config.logDir, filename);

      // 检查文件大小，如果超过限制则轮转
      if (await this.shouldRotate(filepath)) {
        await this.rotateLog(filename);
      }

      // 添加到缓冲区
      this.addToBuffer(filename, `${formatted}\n`);

      // 如果是错误级别，立即刷新
      if (entry.level >= 4) { // ERROR 或 FATAL
        await this.flushBuffer(filename);
      }
    } catch (error) {
      // 日志文件写入失败，使用中文错误消息
      // 这是系统级错误，属于用户不可见文本，应使用中文
      console.error('日志写入失败:', error);
    }
  }

  /**
   * 获取日志文件路径（包含日期文件夹）
   */
  private getLogFilename(entry: LogEntry): string {
    const date = new Date(entry.timestamp);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

    // 创建日期文件夹路径
    const dateFolderPath = path.join(this.config.logDir, dateStr);

    // 确保日期文件夹存在
    if (!fs.existsSync(dateFolderPath)) {
      fs.mkdirSync(dateFolderPath, { recursive: true });
    }

    // 生成启动时间戳文件名（格式：年-月-日-小时:分钟:秒）
    const sessionId = this.getSessionId();
    const filename = `${sessionId}.log`;

    return path.join(dateStr, filename);
  }

  /**
   * 获取当前会话ID（应用启动时间戳）
   * 格式：年-月-日-小时-分钟-秒（Windows文件名兼容）
   */
  private getSessionId(): string {
    if (!this.sessionId) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hour = String(now.getHours()).padStart(2, '0');
      const minute = String(now.getMinutes()).padStart(2, '0');
      const second = String(now.getSeconds()).padStart(2, '0');

      // 使用连字符代替冒号，确保Windows文件名兼容
      this.sessionId = `${year}-${month}-${day}-${hour}-${minute}-${second}`;
    }
    return this.sessionId;
  }

  /**
   * 添加到缓冲区
   */
  private addToBuffer(filename: string, content: string): void {
    if (!this.buffers.has(filename)) {
      this.buffers.set(filename, []);
    }

    const buffer = this.buffers.get(filename);
    if (buffer) {
      buffer.push(content);

      // 如果缓冲区满了，立即刷新
      if (buffer.length >= this.config.bufferSize) {
        this.flushBuffer(filename).catch(console.error);
      }
    }
  }

  /**
   * 刷新指定文件的缓冲区
   */
  private async flushBuffer(filename: string): Promise<void> {
    const buffer = this.buffers.get(filename);
    if (!buffer || buffer.length === 0) {
      return;
    }

    try {
      const filepath = path.join(this.config.logDir, filename);
      const content = buffer.join('');
      
      await appendFile(filepath, content, 'utf8');
      
      // 清空缓冲区
      buffer.length = 0;
    } catch (error) {
      // 使用英文错误消息，因为这是系统级错误
      console.error(`Failed to flush buffer for ${filename}:`, error);
    }
  }

  /**
   * 刷新所有缓冲区
   */
  private async flushAllBuffers(): Promise<void> {
    const promises = Array.from(this.buffers.keys()).map(filename => 
      this.flushBuffer(filename)
    );
    
    await Promise.all(promises);
  }

  /**
   * 检查是否需要轮转
   */
  private async shouldRotate(filepath: string): Promise<boolean> {
    try {
      if (!fs.existsSync(filepath)) {
        return false;
      }

      const stats = await stat(filepath);
      const fileSizeMB = stats.size / (1024 * 1024);
      
      return fileSizeMB >= this.config.maxFileSize;
    } catch (error) {
      console.error('Failed to check file size:', error);
      return false;
    }
  }

  /**
   * 轮转日志文件
   */
  async rotateLog(filename: string): Promise<void> {
    try {
      const filepath = path.join(this.config.logDir, filename);

      if (!fs.existsSync(filepath)) {
        return;
      }

      // 先刷新缓冲区
      await this.flushBuffer(filename);

      // 生成轮转后的文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const baseFilename = path.basename(filename, '.log');
      const dateFolder = path.dirname(filename);
      const rotatedFilename = `${baseFilename}-rotated-${timestamp}.log`;

      const rotatedFilepath = path.join(this.config.logDir, dateFolder, rotatedFilename);

      // 移动文件（重命名）
      await rename(filepath, rotatedFilepath);

      // 如果启用压缩，压缩文件
      if (this.config.enableCompression) {
        await this.compressLog(path.join(dateFolder, rotatedFilename));
      }

      console.log(`Log rotated: ${filename} -> ${path.join(dateFolder, rotatedFilename)}`);
    } catch (error) {
      // 使用英文错误消息，因为这是系统级日志轮转错误，不是用户可见的
      console.error(`Failed to rotate log ${filename}:`, error);
    }
  }

  /**
   * 压缩日志文件
   */
  async compressLog(filename: string): Promise<void> {
    try {
      const filepath = path.join(this.config.logDir, filename);
      const compressedPath = `${filepath}.gz`;

      if (!fs.existsSync(filepath)) {
        return;
      }

      // 读取原文件
      const content = await readFile(filepath);

      // 压缩内容
      const compressed = await gzip(content);

      // 写入压缩文件
      await writeFile(compressedPath, compressed);

      // 删除原文件
      await unlink(filepath);

      console.log(`Log compressed: ${filename} -> ${filename}.gz`);
    } catch (error) {
      console.error(`Failed to compress log ${filename}:`, error);
    }
  }

  /**
   * 清理过期日志
   */
  async cleanupOldLogs(): Promise<void> {
    try {
      const archiveDir = path.join(this.config.logDir, 'archives');
      
      if (!fs.existsSync(archiveDir)) {
        return;
      }

      const files = await readdir(archiveDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      const deletedFiles: string[] = [];

      for (const file of files) {
        const filepath = path.join(archiveDir, file);
        const stats = await stat(filepath);
        
        if (stats.mtime < cutoffDate) {
          await unlink(filepath);
          deletedFiles.push(file);
        }
      }

      if (deletedFiles.length > 0) {
        console.log(`Cleaned up ${deletedFiles.length} old log files:`, deletedFiles);
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  /**
   * 获取日志文件列表
   */
  async getLogFiles(): Promise<string[]> {
    try {
      const logFiles: string[] = [];
      const entries = await readdir(this.config.logDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          // 这是日期文件夹
          const dateFolder = entry.name;
          const dateFolderPath = path.join(this.config.logDir, dateFolder);

          try {
            const dateFiles = await readdir(dateFolderPath);

            // 添加当前日期文件夹中的日志文件
            for (const file of dateFiles) {
              if (file.endsWith('.log')) {
                logFiles.push(path.join(dateFolder, file));
              }
            }
          } catch (err) {
            console.warn(`Failed to read date folder ${dateFolder}:`, err);
          }
        }
      }

      return logFiles.sort();
    } catch (error) {
      console.error('Failed to get log files:', error);
      return [];
    }
  }

  /**
   * 读取日志文件内容
   */
  async readLogFile(filename: string): Promise<string> {
    try {
      const filepath = path.join(this.config.logDir, filename);
      
      if (filename.endsWith('.gz')) {
        // 解压缩文件
        const compressed = await readFile(filepath);
        const decompressed = await promisify(zlib.gunzip)(compressed);
        return decompressed.toString('utf8');
      } else {
        return await readFile(filepath, 'utf8');
      }
    } catch (error) {
      console.error(`Failed to read log file ${filename}:`, error);
      return '';
    }
  }

  /**
   * 获取日志文件统计信息
   */
  async getLogStats(): Promise<{ totalSize: number; fileCount: number }> {
    try {
      const files = await this.getLogFiles();
      let totalSize = 0;
      
      for (const file of files) {
        const filepath = path.join(this.config.logDir, file);
        if (fs.existsSync(filepath)) {
          const stats = await stat(filepath);
          totalSize += stats.size;
        }
      }

      return {
        totalSize,
        fileCount: files.length
      };
    } catch (error) {
      console.error('Failed to get log stats:', error);
      return { totalSize: 0, fileCount: 0 };
    }
  }

  /**
   * 销毁管理器
   */
  async destroy(): Promise<void> {
    // 清理定时器
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // 刷新所有缓冲区
    await this.flushAllBuffers();

    // 关闭所有写入流
    for (const stream of this.writeStreams.values()) {
      stream.end();
    }

    this.writeStreams.clear();
    this.buffers.clear();
  }
}
