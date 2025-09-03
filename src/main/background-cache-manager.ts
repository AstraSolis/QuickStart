/**
 * 背景图片缓存管理器
 * 负责背景图片的缓存、压缩、清理和管理
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { app } from 'electron';
import { CONFIG_PATHS } from '@shared/config-schemas';

export interface CachedImage {
  id: string;
  originalPath: string;
  cachedPath: string;
  size: number;
  width: number;
  height: number;
  format: string;
  createdAt: string;
  lastAccessed: string;
  accessCount: number;
}

export interface CacheStats {
  totalFiles: number;
  totalSize: number;
  oldestFile?: CachedImage;
  newestFile?: CachedImage;
  mostAccessed?: CachedImage;
}

/**
 * 背景缓存管理器类 - 支持国际化
 */
export class BackgroundCacheManager {
  private cacheDir: string = '';
  private metadataFile: string = '';
  private cache: Map<string, CachedImage> = new Map();
  private maxCacheSize: number = 500 * 1024 * 1024; // 500MB
  private maxFiles: number = 100;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    // 延迟初始化路径，等待app ready
  }



  /**
   * 初始化缓存管理器
   */
  async initialize(): Promise<void> {
    // 防止重复初始化
    if (this.isInitialized) {
      return;
    }

    // 如果正在初始化，返回现有的Promise
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initializeInternal();
    return this.initializationPromise;
  }

  /**
   * 内部初始化方法
   */
  private async _initializeInternal(): Promise<void> {
    try {
      // 开发调试信息：背景缓存管理器初始化过程，使用英文是合理的
      console.log('BackgroundCacheManager: Starting initialization...');

      // 等待应用准备就绪
      if (!app.isReady()) {
        console.log('BackgroundCacheManager: Waiting for app to be ready...');
        await app.whenReady();
        console.log('BackgroundCacheManager: App is now ready');
      }

      // 初始化路径
      const appDataPath = path.join(app.getPath('appData'), CONFIG_PATHS.APP_DATA_DIR);
      const cacheBaseDir = path.join(appDataPath, CONFIG_PATHS.CACHE_DIR);
      this.cacheDir = path.join(cacheBaseDir, CONFIG_PATHS.BACKGROUND_IMAGES);
      this.metadataFile = path.join(this.cacheDir, 'cache-metadata.json');

      console.log('BackgroundCacheManager: Paths initialized:', {
        appDataPath,
        cacheBaseDir,
        cacheDir: this.cacheDir,
        metadataFile: this.metadataFile
      });

      // 创建缓存目录
      console.log('BackgroundCacheManager: Creating cache directory...');
      await this.ensureCacheDirectory();
      console.log('BackgroundCacheManager: Cache directory created successfully');

      // 加载缓存元数据
      console.log('BackgroundCacheManager: Loading cache metadata...');
      await this.loadCacheMetadata();
      console.log('BackgroundCacheManager: Cache metadata loaded successfully');

      // 清理过期缓存
      console.log('BackgroundCacheManager: Cleaning up expired cache...');
      await this.cleanupExpiredCache();
      console.log('BackgroundCacheManager: Expired cache cleanup completed');

      this.isInitialized = true;
      console.log('BackgroundCacheManager: Initialization completed successfully');
    } catch (error) {
      console.error('BackgroundCacheManager: Failed to initialize:', error);
      console.error('BackgroundCacheManager: Error stack:', error instanceof Error ? error.stack : 'No stack available');
      
      // 重置初始化状态，允许重试
      this.isInitialized = false;
      this.initializationPromise = null;
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('BackgroundCacheManager: Throwing initialization error:', errorMessage);
      throw new Error(`缓存管理器初始化失败: ${errorMessage}`);
    }
  }

  /**
   * 确保缓存目录存在
   */
  private async ensureCacheDirectory(): Promise<void> {
    try {
      console.log('BackgroundCacheManager: Ensuring cache directory exists...');
      
      // 检查目录是否已存在
      if (fs.existsSync(this.cacheDir)) {
        // 验证目录是否可写
        await fs.promises.access(this.cacheDir, fs.constants.W_OK);
        console.log('BackgroundCacheManager: Cache directory already exists and is writable');
        return;
      }

      // 创建目录（递归创建）
      await fs.promises.mkdir(this.cacheDir, { recursive: true });
      console.log('BackgroundCacheManager: Cache directory created successfully');

      // 验证目录创建成功并可写
      await fs.promises.access(this.cacheDir, fs.constants.F_OK | fs.constants.W_OK);
      
      // 创建测试文件验证写入权限
      const testFile = path.join(this.cacheDir, '.write-test');
      await fs.promises.writeFile(testFile, 'test');
      await fs.promises.unlink(testFile);
      
      console.log('BackgroundCacheManager: Cache directory write test passed');
    } catch (error) {
      console.error('BackgroundCacheManager: Failed to create or access cache directory:', error);
      
      // 提供更详细的错误信息
      if (error instanceof Error) {
        if (error.message.includes('EACCES') || error.message.includes('EPERM')) {
          throw new Error(`权限被拒绝：无法创建或写入缓存目录: ${this.cacheDir}。请检查文件夹权限。`);
        } else if (error.message.includes('ENOSPC')) {
          throw new Error(`磁盘空间不足，无法创建缓存目录: ${this.cacheDir}`);
        } else if (error.message.includes('ENOTDIR')) {
          throw new Error(`路径无效：文件存在于应创建目录的位置: ${this.cacheDir}`);
        }
      }

      throw new Error(`确保缓存目录失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 加载缓存元数据
   */
  private async loadCacheMetadata(): Promise<void> {
    try {
      console.log('BackgroundCacheManager: Loading cache metadata...');
      
      if (fs.existsSync(this.metadataFile)) {
        const data = await fs.promises.readFile(this.metadataFile, 'utf-8');
        const metadata = JSON.parse(data);
        
        if (Array.isArray(metadata)) {
          for (const item of metadata) {
            // 验证元数据项的完整性
            if (this.validateCacheItem(item)) {
              this.cache.set(item.id, item);
            } else {
              console.warn('BackgroundCacheManager: Invalid cache item found, skipping:', item);
            }
          }
          console.log('BackgroundCacheManager: Loaded', this.cache.size, 'cache items');
        } else {
          console.warn('BackgroundCacheManager: Invalid metadata format, rebuilding...');
          await this.rebuildCacheMetadata();
        }
      } else {
        console.log('BackgroundCacheManager: No existing metadata found, starting fresh');
      }
    } catch (error) {
      console.warn('BackgroundCacheManager: Failed to load cache metadata:', error);
      // 如果元数据损坏，重新扫描缓存目录
      await this.rebuildCacheMetadata();
    }
  }

  /**
   * 验证缓存项的有效性
   */
  private validateCacheItem(item: any): item is CachedImage {
    return (
      typeof item === 'object' &&
      typeof item.id === 'string' &&
      typeof item.originalPath === 'string' &&
      typeof item.cachedPath === 'string' &&
      typeof item.size === 'number' &&
      typeof item.width === 'number' &&
      typeof item.height === 'number' &&
      typeof item.format === 'string' &&
      typeof item.createdAt === 'string' &&
      typeof item.lastAccessed === 'string' &&
      typeof item.accessCount === 'number'
    );
  }

  /**
   * 保存缓存元数据
   */
  private async saveCacheMetadata(): Promise<void> {
    try {
      const metadata = Array.from(this.cache.values());
      await fs.promises.writeFile(this.metadataFile, JSON.stringify(metadata, null, 2));
      console.log('BackgroundCacheManager: Cache metadata saved successfully');
    } catch (error) {
      console.error('BackgroundCacheManager: Failed to save cache metadata:', error);
      throw new Error(`Failed to save cache metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 重建缓存元数据
   */
  private async rebuildCacheMetadata(): Promise<void> {
    try {
      this.cache.clear();
      
      const files = await fs.promises.readdir(this.cacheDir);
      for (const file of files) {
        if (file === 'cache-metadata.json') continue;
        
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.promises.stat(filePath);
        
        if (stats.isFile()) {
          const cachedImage: CachedImage = {
            id: path.parse(file).name,
            originalPath: '',
            cachedPath: filePath,
            size: stats.size,
            width: 0,
            height: 0,
            format: path.extname(file).slice(1),
            createdAt: stats.birthtime.toISOString(),
            lastAccessed: stats.atime.toISOString(),
            accessCount: 1,
          };
          
          this.cache.set(cachedImage.id, cachedImage);
        }
      }
      
      await this.saveCacheMetadata();
    } catch (error) {
      console.error('Failed to rebuild cache metadata:', error);
    }
  }

  /**
   * 生成缓存ID
   */
  private generateCacheId(originalPath: string): string {
    return crypto.createHash('md5').update(originalPath).digest('hex');
  }

  /**
   * 根据文件名生成缓存ID（用于原文件名保存）
   */
  private generateCacheIdFromFileName(fileName: string): string {
    // 使用文件名的base64编码 + 时间戳作为ID
    const nameBuffer = Buffer.from(fileName, 'utf8');
    const nameBase64 = nameBuffer.toString('base64').replace(/[/+=]/g, '_');
    const timestamp = Date.now().toString(36);
    return `${nameBase64}_${timestamp}`;
  }

  /**
   * 获取缓存文件路径
   */
  private getCachedFilePath(id: string, format: string): string {
    return path.join(this.cacheDir, `${id}.${format}`);
  }

  /**
   * 检查文件名是否已存在
   */
  async checkFileNameExists(fileName: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // 检查缓存记录中是否有相同的文件名
    for (const cachedImage of this.cache.values()) {
      const cachedFileName = path.basename(cachedImage.originalPath);
      if (cachedFileName === fileName) {
        return true;
      }
    }

    // 检查缓存目录中是否有相同名称的文件
    try {
      const files = await fs.promises.readdir(this.cacheDir);
      return files.some(file => {
        const fileNameWithoutExt = path.parse(fileName).name;
        const existingFileNameWithoutExt = path.parse(file).name;
        return fileNameWithoutExt === existingFileNameWithoutExt;
      });
    } catch (error) {
      console.warn('BackgroundCacheManager: Failed to read cache directory:', error);
      return false;
    }
  }

  /**
   * 根据原文件名生成缓存文件路径
   */
  private getCachedFilePathByName(fileName: string, format: string): string {
    const ext = format.toLowerCase();
    const baseName = path.parse(fileName).name;
    return path.join(this.cacheDir, `${baseName}.${ext}`);
  }

  /**
   * 缓存图片（使用原文件名）
   */
  async cacheImageWithOriginalName(originalFileName: string, imageBuffer: Buffer, metadata: {
    width: number;
    height: number;
    format: string;
  }): Promise<string> {
    // 确保管理器已初始化
    if (!this.isInitialized) {
      console.log('BackgroundCacheManager: Not initialized, initializing now...');
      await this.initialize();
    }

    // 验证输入参数
    if (!originalFileName || typeof originalFileName !== 'string') {
      throw new Error('Invalid originalFileName: must be a non-empty string');
    }

    if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
      throw new Error('Invalid imageBuffer: must be a non-empty Buffer');
    }

    if (!metadata?.format || !metadata.width || !metadata.height) {
      throw new Error('Invalid metadata: format, width, and height are required');
    }

    // 使用原文件名作为缓存路径
    const cachedPath = this.getCachedFilePathByName(originalFileName, metadata.format);
    
    try {
      console.log('BackgroundCacheManager: Caching image with original name:', { 
        originalFileName, 
        cachedPath, 
        size: imageBuffer.length 
      });

      // 检查磁盘空间（估算）
      const availableSpace = await this.getAvailableDiskSpace();
      if (availableSpace !== null && imageBuffer.length > availableSpace) {
        const required = Math.round(imageBuffer.length / 1024 / 1024);
        const available = Math.round(availableSpace / 1024 / 1024);
        throw new Error(`磁盘空间不足，需要 ${required}MB，可用 ${available}MB`);
      }

      // 写入缓存文件
      await fs.promises.writeFile(cachedPath, imageBuffer, { mode: 0o644 });

      // 验证文件写入成功
      const stats = await fs.promises.stat(cachedPath);
      if (stats.size !== imageBuffer.length) {
        throw new Error(`文件写入验证失败：期望 ${imageBuffer.length} 字节，得到 ${stats.size} 字节`);
      }

      // 生成缓存记录ID（使用文件名而非hash）
      const id = this.generateCacheIdFromFileName(originalFileName);

      // 创建缓存记录
      const cachedImage: CachedImage = {
        id,
        originalPath: originalFileName,
        cachedPath,
        size: imageBuffer.length,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        accessCount: 1,
      };

      this.cache.set(id, cachedImage);
      await this.saveCacheMetadata();

      // 检查缓存大小限制
      await this.enforceCacheLimits();

      console.log('BackgroundCacheManager: Image cached successfully with original name:', cachedPath);
      return cachedPath;
    } catch (error) {
      console.error('BackgroundCacheManager: Failed to cache image with original name:', error);
      
      // 清理可能已创建的文件
      try {
        if (fs.existsSync(cachedPath)) {
          await fs.promises.unlink(cachedPath);
        }
      } catch (cleanupError) {
        console.warn('清理部分文件失败', cleanupError);
      }

      // 提供更详细的错误信息
      if (error instanceof Error) {
        if (error.message.includes('ENOSPC')) {
          throw new Error('磁盘空间不足，无法缓存图片');
        } else if (error.message.includes('EACCES') || error.message.includes('EPERM')) {
          throw new Error(`权限被拒绝：无法写入缓存目录: ${this.cacheDir}`);
        } else if (error.message.includes('EMFILE') || error.message.includes('ENFILE')) {
          throw new Error('打开文件过多：无法缓存图片');
        }
      }

      throw new Error(`缓存图片失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 缓存图片
   */
  async cacheImage(originalPath: string, imageBuffer: Buffer, metadata: {
    width: number;
    height: number;
    format: string;
  }): Promise<string> {
    // 确保管理器已初始化
    if (!this.isInitialized) {
      console.log('BackgroundCacheManager: Not initialized, initializing now...');
      await this.initialize();
    }

    // 验证输入参数
    if (!originalPath || typeof originalPath !== 'string') {
      throw new Error('Invalid originalPath: must be a non-empty string');
    }

    if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
      throw new Error('Invalid imageBuffer: must be a non-empty Buffer');
    }

    if (!metadata?.format || !metadata.width || !metadata.height) {
      throw new Error('Invalid metadata: format, width, and height are required');
    }

    const id = this.generateCacheId(originalPath);
    const cachedPath = this.getCachedFilePath(id, metadata.format);

    try {
      console.log('BackgroundCacheManager: Caching image:', { originalPath, id, cachedPath, size: imageBuffer.length });

      // 检查是否已经存在相同的缓存
      const existingImage = this.cache.get(id);
      if (existingImage && fs.existsSync(existingImage.cachedPath)) {
        console.log('BackgroundCacheManager: Image already cached, updating access time');
        existingImage.lastAccessed = new Date().toISOString();
        existingImage.accessCount++;
        await this.saveCacheMetadata();
        return existingImage.cachedPath;
      }

      // 检查磁盘空间（估算）
      const availableSpace = await this.getAvailableDiskSpace();
      if (availableSpace !== null && imageBuffer.length > availableSpace) {
        throw new Error(`Insufficient disk space: required ${Math.round(imageBuffer.length / 1024 / 1024)}MB, available ${Math.round(availableSpace / 1024 / 1024)}MB`);
      }

      // 写入缓存文件
      await fs.promises.writeFile(cachedPath, imageBuffer, { mode: 0o644 });

      // 验证文件写入成功
      const stats = await fs.promises.stat(cachedPath);
      if (stats.size !== imageBuffer.length) {
        throw new Error(`File write verification failed: expected ${imageBuffer.length} bytes, got ${stats.size} bytes`);
      }

      // 创建缓存记录
      const cachedImage: CachedImage = {
        id,
        originalPath,
        cachedPath,
        size: imageBuffer.length,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        accessCount: 1,
      };

      this.cache.set(id, cachedImage);
      await this.saveCacheMetadata();

      // 检查缓存大小限制
      await this.enforceCacheLimits();

      console.log('BackgroundCacheManager: Image cached successfully:', cachedPath);
      return cachedPath;
    } catch (error) {
      console.error('BackgroundCacheManager: Failed to cache image:', error);
      
      // 清理可能已创建的文件
      try {
        if (fs.existsSync(cachedPath)) {
          await fs.promises.unlink(cachedPath);
        }
      } catch (cleanupError) {
        console.warn('清理部分文件失败', cleanupError);
      }

      // 提供更详细的错误信息
      if (error instanceof Error) {
        if (error.message.includes('ENOSPC')) {
          throw new Error('磁盘空间不足，无法缓存图片');
        } else if (error.message.includes('EACCES') || error.message.includes('EPERM')) {
          throw new Error(`权限被拒绝：无法写入缓存目录: ${this.cacheDir}`);
        } else if (error.message.includes('EMFILE') || error.message.includes('ENFILE')) {
          throw new Error('打开文件过多：无法缓存图片');
        }
      }

      throw new Error(`缓存图片失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 获取可用磁盘空间（简单实现）
   */
  private async getAvailableDiskSpace(): Promise<number | null> {
    try {
      const stats = await fs.promises.statfs(this.cacheDir);
      return stats.bavail * stats.bsize;
    } catch (error) {
      console.warn('BackgroundCacheManager: Unable to get disk space info:', error);
      return null; // 无法获取磁盘空间信息时返回null
    }
  }

  /**
   * 获取缓存图片
   */
  async getCachedImage(originalPath: string): Promise<CachedImage | null> {
    const id = this.generateCacheId(originalPath);
    const cachedImage = this.cache.get(id);

    if (cachedImage && fs.existsSync(cachedImage.cachedPath)) {
      // 更新访问记录
      cachedImage.lastAccessed = new Date().toISOString();
      cachedImage.accessCount++;
      await this.saveCacheMetadata();
      
      return cachedImage;
    }

    return null;
  }

  /**
   * 删除缓存图片
   */
  async removeCachedImage(originalPath: string): Promise<boolean> {
    // 查找要删除的缓存图片（通过originalPath匹配）
    let targetImage: CachedImage | null = null;
    let targetId: string | null = null;

    for (const [id, cachedImage] of this.cache.entries()) {
      if (cachedImage.originalPath === originalPath) {
        targetImage = cachedImage;
        targetId = id;
        break;
      }
    }

    if (targetImage && targetId) {
      try {
        console.log('BackgroundCacheManager: Removing cached image:', {
          originalPath,
          cachedPath: targetImage.cachedPath,
          id: targetId
        });

        if (fs.existsSync(targetImage.cachedPath)) {
          await fs.promises.unlink(targetImage.cachedPath);
        }

        this.cache.delete(targetId);
        await this.saveCacheMetadata();

        console.log('BackgroundCacheManager: Cached image removed successfully');
        return true;
      } catch (error) {
        console.error('BackgroundCacheManager: Failed to remove cached image:', error);
        return false;
      }
    }

    console.warn('BackgroundCacheManager: Cached image not found for removal:', originalPath);
    return false;
  }

  /**
   * 清理过期缓存
   */
  private async cleanupExpiredCache(): Promise<void> {
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30天

    for (const cachedImage of this.cache.values()) {
      const lastAccessed = new Date(cachedImage.lastAccessed).getTime();
      
      if (now - lastAccessed > maxAge) {
        await this.removeCachedImage(cachedImage.originalPath);
      }
    }
  }

  /**
   * 强制执行缓存限制
   */
  private async enforceCacheLimits(): Promise<void> {
    const stats = this.getCacheStats();
    
    // 检查文件数量限制
    if (stats.totalFiles > this.maxFiles) {
      await this.removeOldestFiles(stats.totalFiles - this.maxFiles);
    }
    
    // 检查大小限制
    if (stats.totalSize > this.maxCacheSize) {
      await this.removeLeastAccessedFiles(stats.totalSize - this.maxCacheSize);
    }
  }

  /**
   * 移除最旧的文件
   */
  private async removeOldestFiles(count: number): Promise<void> {
    const sortedImages = Array.from(this.cache.values())
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    for (let i = 0; i < count && i < sortedImages.length; i++) {
      await this.removeCachedImage(sortedImages[i].originalPath);
    }
  }

  /**
   * 移除最少访问的文件
   */
  private async removeLeastAccessedFiles(targetSize: number): Promise<void> {
    const sortedImages = Array.from(this.cache.values())
      .sort((a, b) => a.accessCount - b.accessCount);

    let removedSize = 0;
    for (const image of sortedImages) {
      if (removedSize >= targetSize) break;
      
      removedSize += image.size;
      await this.removeCachedImage(image.originalPath);
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): CacheStats {
    const images = Array.from(this.cache.values());
    
    return {
      totalFiles: images.length,
      totalSize: images.reduce((sum, img) => sum + img.size, 0),
      oldestFile: images.reduce((oldest, img) => 
        !oldest || new Date(img.createdAt) < new Date(oldest.createdAt) ? img : oldest, 
        undefined as CachedImage | undefined
      ),
      newestFile: images.reduce((newest, img) => 
        !newest || new Date(img.createdAt) > new Date(newest.createdAt) ? img : newest, 
        undefined as CachedImage | undefined
      ),
      mostAccessed: images.reduce((most, img) => 
        !most || img.accessCount > most.accessCount ? img : most, 
        undefined as CachedImage | undefined
      ),
    };
  }

  /**
   * 清空所有缓存
   */
  async clearAllCache(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('BackgroundCacheManager not initialized');
    }

    try {
      // 删除所有缓存文件
      for (const cachedImage of this.cache.values()) {
        if (fs.existsSync(cachedImage.cachedPath)) {
          await fs.promises.unlink(cachedImage.cachedPath);
        }
      }

      // 清空缓存记录
      this.cache.clear();
      await this.saveCacheMetadata();
      
      console.log('All background cache cleared');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      throw error;
    }
  }

  /**
   * 设置缓存限制
   */
  setCacheLimits(maxSize: number, maxFiles: number): void {
    this.maxCacheSize = maxSize;
    this.maxFiles = maxFiles;
  }

  /**
   * 获取所有缓存图片列表
   */
  getAllCachedImages(): CachedImage[] {
    if (!this.isInitialized) {
      throw new Error('BackgroundCacheManager not initialized');
    }

    return Array.from(this.cache.values()).sort((a, b) => {
      // 按最后访问时间降序排列
      return new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime();
    });
  }

  /**
   * 重命名缓存图片
   */
  async renameCachedImage(oldFileName: string, newFileName: string): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('BackgroundCacheManager not initialized');
    }

    // 验证输入参数
    if (!oldFileName || typeof oldFileName !== 'string') {
      throw new Error('Invalid oldFileName: must be a non-empty string');
    }

    if (!newFileName || typeof newFileName !== 'string') {
      throw new Error('Invalid newFileName: must be a non-empty string');
    }

    // 查找要重命名的缓存图片
    let targetImage: CachedImage | null = null;
    for (const cachedImage of this.cache.values()) {
      if (path.basename(cachedImage.originalPath) === oldFileName) {
        targetImage = cachedImage;
        break;
      }
    }

    if (!targetImage) {
      throw new Error(`找不到要重命名的图片: ${oldFileName}`);
    }

    // 检查新文件名是否已存在
    const newFileExists = await this.checkFileNameExists(newFileName);
    if (newFileExists) {
      throw new Error('文件名重复');
    }

    // 生成新的缓存路径
    const fileExtension = path.extname(targetImage.cachedPath);
    const newBaseName = path.parse(newFileName).name;
    const newCachedPath = path.join(this.cacheDir, `${newBaseName}${fileExtension}`);

    try {
      console.log('BackgroundCacheManager: Renaming cached image:', {
        oldPath: targetImage.cachedPath,
        newPath: newCachedPath,
        oldFileName,
        newFileName
      });

      // 重命名物理文件
      await fs.promises.rename(targetImage.cachedPath, newCachedPath);

      // 更新缓存记录
      const oldId = targetImage.id;
      const newId = this.generateCacheIdFromFileName(newFileName);

      // 创建新的缓存记录
      const updatedImage: CachedImage = {
        ...targetImage,
        id: newId,
        originalPath: newFileName,
        cachedPath: newCachedPath,
        lastAccessed: new Date().toISOString(),
      };

      // 删除旧记录，添加新记录
      this.cache.delete(oldId);
      this.cache.set(newId, updatedImage);

      // 保存缓存元数据
      await this.saveCacheMetadata();

      console.log('BackgroundCacheManager: Image renamed successfully:', newCachedPath);
      return newCachedPath;

    } catch (error) {
      console.error('BackgroundCacheManager: Failed to rename cached image:', error);

      // 尝试恢复文件（如果重命名失败）
      try {
        if (fs.existsSync(newCachedPath) && !fs.existsSync(targetImage.cachedPath)) {
          await fs.promises.rename(newCachedPath, targetImage.cachedPath);
        }
      } catch (recoveryError) {
        console.warn('BackgroundCacheManager: Failed to recover file after rename failure:', recoveryError);
      }

      throw error;
    }
  }
}

// 导出单例实例
export const backgroundCacheManager = new BackgroundCacheManager();
