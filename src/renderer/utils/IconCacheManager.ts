/**
 * 图标缓存管理系统
 * 实现图标预加载、LRU淘汰策略、内存优化
 */

import type { FileIconConfig } from './FileIconMapper';

// 缓存项接口
interface CacheItem {
  key: string;
  config: FileIconConfig;
  lastAccessed: number;
  accessCount: number;
  size: number; // 估算的内存大小（字节）
}

// 缓存统计信息
export interface CacheStats {
  totalItems: number;
  totalSize: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  oldestItem?: string;
  newestItem?: string;
  mostAccessedItem?: string;
}

// 缓存配置
export interface CacheConfig {
  maxItems: number;
  maxSize: number; // 最大内存大小（字节）
  ttl: number; // 生存时间（毫秒）
  preloadEnabled: boolean;
  compressionEnabled: boolean;
}

// 默认缓存配置
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxItems: 500,
  maxSize: 10 * 1024 * 1024, // 10MB
  ttl: 30 * 60 * 1000, // 30分钟
  preloadEnabled: true,
  compressionEnabled: false,
};

/**
 * 图标缓存管理器
 * 使用LRU算法管理图标缓存，支持预加载和内存优化
 */
export class IconCacheManager {
  private static instance: IconCacheManager;
  private cache: Map<string, CacheItem>;
  private accessOrder: string[]; // LRU访问顺序
  private config: CacheConfig;
  private stats: {
    hitCount: number;
    missCount: number;
  };
  private cleanupTimer?: NodeJS.Timeout;
  private preloadQueue: Set<string>;

  private constructor(config: Partial<CacheConfig> = {}) {
    this.cache = new Map();
    this.accessOrder = [];
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.stats = { hitCount: 0, missCount: 0 };
    this.preloadQueue = new Set();
    this.startCleanupTimer();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(config?: Partial<CacheConfig>): IconCacheManager {
    if (!IconCacheManager.instance) {
      IconCacheManager.instance = new IconCacheManager(config);
    }
    return IconCacheManager.instance;
  }

  /**
   * 获取图标配置（带缓存）
   */
  public get(key: string): FileIconConfig | null {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.missCount++;
      return null;
    }

    // 检查TTL
    if (this.isExpired(item)) {
      this.remove(key);
      this.stats.missCount++;
      return null;
    }

    // 更新访问信息
    item.lastAccessed = Date.now();
    item.accessCount++;
    this.updateAccessOrder(key);
    this.stats.hitCount++;

    return item.config;
  }

  /**
   * 设置图标配置到缓存
   */
  public set(key: string, config: FileIconConfig): void {
    const size = this.estimateSize(config);
    const now = Date.now();

    // 如果已存在，更新
    if (this.cache.has(key)) {
      const existingItem = this.cache.get(key)!;
      existingItem.config = config;
      existingItem.lastAccessed = now;
      existingItem.accessCount++;
      existingItem.size = size;
      this.updateAccessOrder(key);
      return;
    }

    // 检查是否需要清理空间
    this.ensureCapacity(size);

    // 创建新缓存项
    const item: CacheItem = {
      key,
      config,
      lastAccessed: now,
      accessCount: 1,
      size,
    };

    this.cache.set(key, item);
    this.accessOrder.push(key);
  }

  /**
   * 移除缓存项
   */
  public remove(key: string): boolean {
    const removed = this.cache.delete(key);
    if (removed) {
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }
    return removed;
  }

  /**
   * 清空缓存
   */
  public clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.stats = { hitCount: 0, missCount: 0 };
  }

  /**
   * 预加载图标
   */
  public preload(keys: string[], configs: FileIconConfig[]): void {
    if (!this.config.preloadEnabled) return;

    keys.forEach((key, index) => {
      if (index < configs.length && !this.cache.has(key)) {
        this.preloadQueue.add(key);
        // 异步预加载，避免阻塞主线程
        setTimeout(() => {
          this.set(key, configs[index]);
          this.preloadQueue.delete(key);
        }, index * 10); // 分批加载，每10ms加载一个
      }
    });
  }

  /**
   * 获取缓存统计信息
   */
  public getStats(): CacheStats {
    const totalRequests = this.stats.hitCount + this.stats.missCount;
    const hitRate = totalRequests > 0 ? this.stats.hitCount / totalRequests : 0;

    let totalSize = 0;
    let oldestItem: string | undefined;
    let newestItem: string | undefined;
    let mostAccessedItem: string | undefined;
    let maxAccessCount = 0;
    let oldestTime = Date.now();
    let newestTime = 0;

    this.cache.forEach((item, key) => {
      totalSize += item.size;

      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed;
        oldestItem = key;
      }

      if (item.lastAccessed > newestTime) {
        newestTime = item.lastAccessed;
        newestItem = key;
      }

      if (item.accessCount > maxAccessCount) {
        maxAccessCount = item.accessCount;
        mostAccessedItem = key;
      }
    });

    return {
      totalItems: this.cache.size,
      totalSize,
      hitCount: this.stats.hitCount,
      missCount: this.stats.missCount,
      hitRate,
      oldestItem,
      newestItem,
      mostAccessedItem,
    };
  }

  /**
   * 更新缓存配置
   */
  public updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // 如果减少了容量限制，需要清理
    if (newConfig.maxItems || newConfig.maxSize) {
      this.cleanup();
    }
  }

  /**
   * 获取当前配置
   */
  public getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * 检查缓存项是否过期
   */
  private isExpired(item: CacheItem): boolean {
    return Date.now() - item.lastAccessed > this.config.ttl;
  }

  /**
   * 估算配置对象的内存大小
   */
  private estimateSize(config: FileIconConfig): number {
    // 简单估算：基础对象大小 + 字符串长度
    const baseSize = 100; // 基础对象开销
    const stringSize = (config.description?.length || 0) * 2; // Unicode字符
    const colorSize = (config.color?.length || 0) * 2;
    return baseSize + stringSize + colorSize;
  }

  /**
   * 更新访问顺序（LRU）
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * 确保缓存容量
   */
  private ensureCapacity(newItemSize: number): void {
    // 检查数量限制
    while (this.cache.size >= this.config.maxItems) {
      this.evictLRU();
    }

    // 检查大小限制
    let currentSize = this.getCurrentSize();
    while (currentSize + newItemSize > this.config.maxSize && this.cache.size > 0) {
      this.evictLRU();
      currentSize = this.getCurrentSize();
    }
  }

  /**
   * 淘汰最近最少使用的项
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const lruKey = this.accessOrder.shift()!;
    this.cache.delete(lruKey);
  }

  /**
   * 获取当前缓存总大小
   */
  private getCurrentSize(): number {
    let totalSize = 0;
    this.cache.forEach(item => {
      totalSize += item.size;
    });
    return totalSize;
  }

  /**
   * 清理过期项
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToRemove: string[] = [];

    this.cache.forEach((item, key) => {
      if (this.isExpired(item)) {
        keysToRemove.push(key);
      }
    });

    keysToRemove.forEach(key => this.remove(key));

    // 如果仍然超出限制，继续LRU淘汰
    this.ensureCapacity(0);
  }

  /**
   * 启动定时清理
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // 每5分钟清理一次过期项
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * 停止定时清理
   */
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clear();
  }
}

// 导出默认实例
export const iconCacheManager = IconCacheManager.getInstance();
