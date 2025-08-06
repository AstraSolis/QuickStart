/**
 * QuickStart 项目配置
 * 集中管理项目相关的配置信息
 */

export interface ProjectConfig {
  name: string;
  version: string;
  description: string;
  author: {
    name: string;
  };
  repository: {
    type: string;
    url: string;
  };
  links: {
    homepage: string;
    repository: string;
    issues: string;
    documentation: string;
    support: string;
    sponsors?: string;
  };
  license: {
    type: string;
    url: string;
  };
}

// 项目配置常量 - 移除硬编码文本，使用i18n翻译
export const PROJECT_CONFIG: ProjectConfig = {
  name: 'QuickStart',
  version: '1.0.0',
  description: '', // 将通过i18n翻译获取：about:project.description
  author: {
    name: '' // 将通过i18n翻译获取：about:project.author.name
  },
  repository: {
    type: 'git',
    url: 'https://github.com/AstraSolis/QuickStart'
  },
  links: {
    homepage: 'https://quickstart.app',
    repository: 'https://github.com/AstraSolis/QuickStart',
    issues: 'https://github.com/AstraSolis/QuickStart/issues',
    documentation: 'https://docs.quickstart.app',
    support: 'https://support.quickstart.app',
    sponsors: 'https://github.com/sponsors/AstraSolis'
  },
  license: {
    type: 'MIT',
    url: 'https://github.com/AstraSolis/QuickStart/blob/main/LICENSE'
  }
} as const;

// 导出便捷访问的常量
export const GITHUB_LINKS = {
  repo: PROJECT_CONFIG.links.repository,
  issues: PROJECT_CONFIG.links.issues,
  sponsors: PROJECT_CONFIG.links.sponsors
} as const;

// 版本信息
export const VERSION_INFO = {
  app: PROJECT_CONFIG.version,
  // 这些版本信息将通过Electron API动态获取
  electron: process.versions?.electron || 'Unknown',
  node: process.versions?.node || 'Unknown',
  chrome: process.versions?.chrome || 'Unknown'
} as const;

/**
 * 获取国际化的项目配置
 * @param t 翻译函数，来自useTranslation('about')
 * @returns 包含国际化文本的项目配置
 */
export function getI18nProjectConfig(t: (key: string, fallback?: string) => string): ProjectConfig {
  return {
    ...PROJECT_CONFIG,
    description: t('project.description', 'QuickStart - Powerful file quick launcher tool'),
    author: {
      name: t('project.author.name', '开发者:AstraSolis')
    }
  };
}
