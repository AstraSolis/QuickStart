/**
 * 文件类型图标映射系统
 * 提供文件扩展名与图标的映射关系，支持动态样式和主题定制
 */

import {
  FileOutlined,
  FileTextOutlined,
  FileImageOutlined,
  FileZipOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  FileWordOutlined,
  FilePptOutlined,
  CodeOutlined,
  Html5Outlined,
  DatabaseOutlined,
  SettingOutlined,
  PlayCircleOutlined,
  SoundOutlined,
  PictureOutlined,
  FolderOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import type { ComponentType } from 'react';

// 图标类型定义
export interface FileIconConfig {
  icon: ComponentType<any>;
  color: string;
  category: 'code' | 'document' | 'media' | 'archive' | 'config' | 'executable' | 'folder' | 'other';
  description: string;
}

// 文件类型分类
export enum FileCategory {
  CODE = 'code',
  DOCUMENT = 'document', 
  MEDIA = 'media',
  ARCHIVE = 'archive',
  CONFIG = 'config',
  EXECUTABLE = 'executable',
  FOLDER = 'folder',
  OTHER = 'other',
}

// 默认图标配置
const DEFAULT_ICON_CONFIG: FileIconConfig = {
  icon: FileOutlined,
  color: '#8c8c8c',
  category: 'other',
  description: '未知文件类型',
};

// 文件夹图标配置
const FOLDER_ICON_CONFIG: FileIconConfig = {
  icon: FolderOutlined,
  color: '#1890ff',
  category: 'folder',
  description: '文件夹',
};

/**
 * 文件图标映射器类
 * 管理文件类型与图标的映射关系
 */
export class FileIconMapper {
  private static instance: FileIconMapper;
  private iconMap: Map<string, FileIconConfig>;
  private categoryColors: Map<FileCategory, string>;

  private constructor() {
    this.iconMap = new Map();
    this.categoryColors = new Map();
    this.initializeDefaultMappings();
    this.initializeCategoryColors();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): FileIconMapper {
    if (!FileIconMapper.instance) {
      FileIconMapper.instance = new FileIconMapper();
    }
    return FileIconMapper.instance;
  }

  /**
   * 初始化默认图标映射
   */
  private initializeDefaultMappings(): void {
    // 代码文件
    const codeFiles = [
      { ext: 'js', icon: CodeOutlined, color: '#f7df1e', desc: 'JavaScript文件' },
      { ext: 'jsx', icon: CodeOutlined, color: '#61dafb', desc: 'React JSX文件' },
      { ext: 'ts', icon: CodeOutlined, color: '#3178c6', desc: 'TypeScript文件' },
      { ext: 'tsx', icon: CodeOutlined, color: '#3178c6', desc: 'TypeScript React文件' },
      { ext: 'html', icon: Html5Outlined, color: '#e34f26', desc: 'HTML文件' },
      { ext: 'htm', icon: Html5Outlined, color: '#e34f26', desc: 'HTML文件' },
      { ext: 'css', icon: CodeOutlined, color: '#1572b6', desc: 'CSS样式文件' },
      { ext: 'scss', icon: CodeOutlined, color: '#cf649a', desc: 'Sass样式文件' },
      { ext: 'sass', icon: CodeOutlined, color: '#cf649a', desc: 'Sass样式文件' },
      { ext: 'less', icon: CodeOutlined, color: '#1d365d', desc: 'Less样式文件' },
      { ext: 'json', icon: SettingOutlined, color: '#000000', desc: 'JSON配置文件' },
      { ext: 'xml', icon: CodeOutlined, color: '#ff6600', desc: 'XML文件' },
      { ext: 'py', icon: CodeOutlined, color: '#3776ab', desc: 'Python文件' },
      { ext: 'java', icon: CodeOutlined, color: '#ed8b00', desc: 'Java文件' },
      { ext: 'c', icon: CodeOutlined, color: '#a8b9cc', desc: 'C语言文件' },
      { ext: 'cpp', icon: CodeOutlined, color: '#00599c', desc: 'C++文件' },
      { ext: 'cs', icon: CodeOutlined, color: '#239120', desc: 'C#文件' },
      { ext: 'php', icon: CodeOutlined, color: '#777bb4', desc: 'PHP文件' },
      { ext: 'rb', icon: CodeOutlined, color: '#cc342d', desc: 'Ruby文件' },
      { ext: 'go', icon: CodeOutlined, color: '#00add8', desc: 'Go语言文件' },
      { ext: 'rs', icon: CodeOutlined, color: '#dea584', desc: 'Rust文件' },
      { ext: 'swift', icon: CodeOutlined, color: '#fa7343', desc: 'Swift文件' },
      { ext: 'kt', icon: CodeOutlined, color: '#7f52ff', desc: 'Kotlin文件' },
    ];

    codeFiles.forEach(({ ext, icon, color, desc }) => {
      this.iconMap.set(ext, {
        icon,
        color,
        category: 'code',
        description: desc,
      });
    });

    // 文档文件
    const documentFiles = [
      { ext: 'txt', icon: FileTextOutlined, color: '#8c8c8c', desc: '文本文件' },
      { ext: 'md', icon: FileTextOutlined, color: '#083fa1', desc: 'Markdown文件' },
      { ext: 'pdf', icon: FilePdfOutlined, color: '#ff0000', desc: 'PDF文档' },
      { ext: 'doc', icon: FileWordOutlined, color: '#2b579a', desc: 'Word文档' },
      { ext: 'docx', icon: FileWordOutlined, color: '#2b579a', desc: 'Word文档' },
      { ext: 'xls', icon: FileExcelOutlined, color: '#217346', desc: 'Excel表格' },
      { ext: 'xlsx', icon: FileExcelOutlined, color: '#217346', desc: 'Excel表格' },
      { ext: 'ppt', icon: FilePptOutlined, color: '#d24726', desc: 'PowerPoint演示' },
      { ext: 'pptx', icon: FilePptOutlined, color: '#d24726', desc: 'PowerPoint演示' },
    ];

    documentFiles.forEach(({ ext, icon, color, desc }) => {
      this.iconMap.set(ext, {
        icon,
        color,
        category: 'document',
        description: desc,
      });
    });

    // 媒体文件
    const mediaFiles = [
      { ext: 'jpg', icon: FileImageOutlined, color: '#87d068', desc: 'JPEG图片' },
      { ext: 'jpeg', icon: FileImageOutlined, color: '#87d068', desc: 'JPEG图片' },
      { ext: 'png', icon: FileImageOutlined, color: '#87d068', desc: 'PNG图片' },
      { ext: 'gif', icon: FileImageOutlined, color: '#87d068', desc: 'GIF图片' },
      { ext: 'svg', icon: PictureOutlined, color: '#ff7875', desc: 'SVG矢量图' },
      { ext: 'webp', icon: FileImageOutlined, color: '#87d068', desc: 'WebP图片' },
      { ext: 'ico', icon: FileImageOutlined, color: '#87d068', desc: '图标文件' },
      { ext: 'mp3', icon: SoundOutlined, color: '#722ed1', desc: 'MP3音频' },
      { ext: 'wav', icon: SoundOutlined, color: '#722ed1', desc: 'WAV音频' },
      { ext: 'mp4', icon: PlayCircleOutlined, color: '#eb2f96', desc: 'MP4视频' },
      { ext: 'avi', icon: PlayCircleOutlined, color: '#eb2f96', desc: 'AVI视频' },
      { ext: 'mov', icon: PlayCircleOutlined, color: '#eb2f96', desc: 'MOV视频' },
    ];

    mediaFiles.forEach(({ ext, icon, color, desc }) => {
      this.iconMap.set(ext, {
        icon,
        color,
        category: 'media',
        description: desc,
      });
    });

    // 压缩文件
    const archiveFiles = [
      { ext: 'zip', icon: FileZipOutlined, color: '#faad14', desc: 'ZIP压缩包' },
      { ext: 'rar', icon: FileZipOutlined, color: '#faad14', desc: 'RAR压缩包' },
      { ext: '7z', icon: FileZipOutlined, color: '#faad14', desc: '7Z压缩包' },
      { ext: 'tar', icon: FileZipOutlined, color: '#faad14', desc: 'TAR归档' },
      { ext: 'gz', icon: FileZipOutlined, color: '#faad14', desc: 'GZ压缩文件' },
    ];

    archiveFiles.forEach(({ ext, icon, color, desc }) => {
      this.iconMap.set(ext, {
        icon,
        color,
        category: 'archive',
        description: desc,
      });
    });

    // 配置文件
    const configFiles = [
      { ext: 'config', icon: SettingOutlined, color: '#8c8c8c', desc: '配置文件' },
      { ext: 'conf', icon: SettingOutlined, color: '#8c8c8c', desc: '配置文件' },
      { ext: 'ini', icon: SettingOutlined, color: '#8c8c8c', desc: 'INI配置' },
      { ext: 'yaml', icon: SettingOutlined, color: '#8c8c8c', desc: 'YAML配置' },
      { ext: 'yml', icon: SettingOutlined, color: '#8c8c8c', desc: 'YAML配置' },
      { ext: 'toml', icon: SettingOutlined, color: '#8c8c8c', desc: 'TOML配置' },
      { ext: 'env', icon: SettingOutlined, color: '#8c8c8c', desc: '环境变量文件' },
    ];

    configFiles.forEach(({ ext, icon, color, desc }) => {
      this.iconMap.set(ext, {
        icon,
        color,
        category: 'config',
        description: desc,
      });
    });

    // 可执行文件
    const executableFiles = [
      { ext: 'exe', icon: AppstoreOutlined, color: '#ff4d4f', desc: 'Windows可执行文件' },
      { ext: 'msi', icon: AppstoreOutlined, color: '#ff4d4f', desc: 'Windows安装包' },
      { ext: 'app', icon: AppstoreOutlined, color: '#ff4d4f', desc: 'macOS应用程序' },
      { ext: 'dmg', icon: AppstoreOutlined, color: '#ff4d4f', desc: 'macOS磁盘镜像' },
      { ext: 'deb', icon: AppstoreOutlined, color: '#ff4d4f', desc: 'Debian安装包' },
      { ext: 'rpm', icon: AppstoreOutlined, color: '#ff4d4f', desc: 'RPM安装包' },
    ];

    executableFiles.forEach(({ ext, icon, color, desc }) => {
      this.iconMap.set(ext, {
        icon,
        color,
        category: 'executable',
        description: desc,
      });
    });

    // 数据库文件
    const databaseFiles = [
      { ext: 'db', icon: DatabaseOutlined, color: '#13c2c2', desc: '数据库文件' },
      { ext: 'sqlite', icon: DatabaseOutlined, color: '#13c2c2', desc: 'SQLite数据库' },
      { ext: 'sql', icon: DatabaseOutlined, color: '#13c2c2', desc: 'SQL脚本' },
    ];

    databaseFiles.forEach(({ ext, icon, color, desc }) => {
      this.iconMap.set(ext, {
        icon,
        color,
        category: 'other',
        description: desc,
      });
    });
  }

  /**
   * 初始化分类颜色
   */
  private initializeCategoryColors(): void {
    this.categoryColors.set(FileCategory.CODE, '#52c41a');
    this.categoryColors.set(FileCategory.DOCUMENT, '#1890ff');
    this.categoryColors.set(FileCategory.MEDIA, '#722ed1');
    this.categoryColors.set(FileCategory.ARCHIVE, '#faad14');
    this.categoryColors.set(FileCategory.CONFIG, '#8c8c8c');
    this.categoryColors.set(FileCategory.EXECUTABLE, '#ff4d4f');
    this.categoryColors.set(FileCategory.FOLDER, '#1890ff');
    this.categoryColors.set(FileCategory.OTHER, '#8c8c8c');
  }

  /**
   * 根据文件路径获取图标配置
   */
  public getIconConfig(filePath: string, isDirectory: boolean = false): FileIconConfig {
    if (isDirectory) {
      return FOLDER_ICON_CONFIG;
    }

    const extension = this.getFileExtension(filePath);
    return this.iconMap.get(extension) || DEFAULT_ICON_CONFIG;
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(filePath: string): string {
    const lastDotIndex = filePath.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex === filePath.length - 1) {
      return '';
    }
    return filePath.substring(lastDotIndex + 1).toLowerCase();
  }

  /**
   * 添加自定义图标映射
   */
  public addCustomMapping(extension: string, config: FileIconConfig): void {
    this.iconMap.set(extension.toLowerCase(), config);
  }

  /**
   * 移除图标映射
   */
  public removeMapping(extension: string): void {
    this.iconMap.delete(extension.toLowerCase());
  }

  /**
   * 获取所有支持的文件类型
   */
  public getSupportedExtensions(): string[] {
    return Array.from(this.iconMap.keys());
  }

  /**
   * 根据分类获取颜色
   */
  public getCategoryColor(category: FileCategory): string {
    return this.categoryColors.get(category) || '#8c8c8c';
  }

  /**
   * 获取分类统计信息
   */
  public getCategoryStats(): Map<FileCategory, number> {
    const stats = new Map<FileCategory, number>();

    this.iconMap.forEach((config) => {
      const categoryEnum = config.category as FileCategory;
      const count = stats.get(categoryEnum) || 0;
      stats.set(categoryEnum, count + 1);
    });

    return stats;
  }

  /**
   * 重置为默认映射
   */
  public resetToDefaults(): void {
    this.iconMap.clear();
    this.initializeDefaultMappings();
  }
}

// 导出单例实例
export const fileIconMapper = FileIconMapper.getInstance();
