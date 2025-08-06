#!/usr/bin/env node

/**
 * i18next翻译键一致性检查CLI工具
 * 命令行界面，支持多种检查模式和输出格式
 */

const { program } = require('commander');
const path = require('path');
const { createChecker, getVersion } = require('./i18n-checker');

// 设置CLI程序信息
program
  .name('check-i18n')
  .description('i18next翻译键一致性检查工具')
  .version(getVersion());

// 主检查命令
program
  .command('check')
  .description('执行完整的翻译键一致性检查')
  .option('-c, --config <path>', '指定配置文件路径')
  .option('-f, --format <format>', '报告格式 (console|json|html)', 'console')
  .option('-o, --output <path>', '输出文件路径')
  .option('-v, --verbose', '显示详细信息')
  .option('--no-color', '禁用颜色输出')
  .option('--fail-on <severity>', '指定失败的严重级别 (low|medium|high|critical)', 'high')
  .option('--fix', '自动修复可修复的问题')
  .action(async (options) => {
    try {
      const checker = createChecker({
        configPath: options.config,
        format: options.format,
        output: options.output,
        verbose: options.verbose
      });

      const result = await checker.run();

      // 如果启用了自动修复
      if (options.fix && result.issues.length > 0) {
        const { createAutoFixer } = require('./i18n-checker/auto-fixer');
        const fixer = createAutoFixer(checker.getConfig());
        await fixer.fixIssues(result.issues);

        // 重新检查以验证修复结果
        console.log('\n🔍 重新检查修复结果...');
        const reCheckResult = await checker.run();
        process.exit(reCheckResult.success ? 0 : 1);
      } else {
        // 根据严重级别决定退出码
        const shouldFail = shouldFailOnSeverity(result.issues, options.failOn);
        process.exit(shouldFail ? 1 : 0);
      }
    } catch (error) {
      console.error(`❌ 检查失败: ${error.message}`);
      process.exit(1);
    }
  });

// 检查特定语言
program
  .command('check-lang <language>')
  .description('检查特定语言的翻译键一致性')
  .option('-c, --config <path>', '指定配置文件路径')
  .option('-f, --format <format>', '报告格式 (console|json|html)', 'console')
  .option('-o, --output <path>', '输出文件路径')
  .action(async (language, options) => {
    try {
      const checker = createChecker({
        configPath: options.config,
        format: options.format,
        output: options.output
      });

      const result = await checker.checkLanguage(language);
      process.exit(result.success ? 0 : 1);
    } catch (error) {
      console.error(`❌ 检查语言 ${language} 失败: ${error.message}`);
      process.exit(1);
    }
  });

// 检查特定命名空间
program
  .command('check-ns <namespace>')
  .description('检查特定命名空间的翻译键一致性')
  .option('-c, --config <path>', '指定配置文件路径')
  .option('-f, --format <format>', '报告格式 (console|json|html)', 'console')
  .option('-o, --output <path>', '输出文件路径')
  .action(async (namespace, options) => {
    try {
      const checker = createChecker({
        configPath: options.config,
        format: options.format,
        output: options.output
      });

      const result = await checker.checkNamespace(namespace);
      process.exit(result.success ? 0 : 1);
    } catch (error) {
      console.error(`❌ 检查命名空间 ${namespace} 失败: ${error.message}`);
      process.exit(1);
    }
  });

// 生成配置文件模板
program
  .command('init')
  .description('生成i18n检查配置文件模板')
  .option('-o, --output <path>', '配置文件输出路径', './i18n-check-config.json')
  .action((options) => {
    try {
      const { DEFAULT_CONFIG } = require('./i18n-checker/config');
      const fs = require('fs');
      
      const configTemplate = {
        ...DEFAULT_CONFIG,
        // 添加注释说明
        _comments: {
          locales: {
            baseDir: "语言文件根目录路径",
            languages: "支持的语言列表",
            referenceLang: "用作比较基准的参考语言",
            namespaces: "要检查的命名空间列表",
            fileExtension: "语言文件的扩展名"
          },
          rules: {
            severity: "各类问题的严重级别设置",
            ignorePatterns: "要忽略的键路径正则表达式模式",
            ignoreNamespaces: "要忽略的命名空间",
            ignoreLanguages: "要忽略的语言"
          },
          report: {
            format: "报告输出格式: console, json, html",
            outputPath: "报告文件输出路径（不含扩展名）",
            verbose: "是否显示详细信息",
            showSuccess: "是否显示成功的检查项"
          }
        }
      };

      fs.writeFileSync(options.output, JSON.stringify(configTemplate, null, 2), 'utf8');
      console.log(`✅ 配置文件模板已生成: ${options.output}`);
      console.log('💡 请根据项目需要修改配置文件');
    } catch (error) {
      console.error(`❌ 生成配置文件失败: ${error.message}`);
      process.exit(1);
    }
  });

// 验证配置文件
program
  .command('validate-config [configPath]')
  .description('验证配置文件的正确性')
  .action((configPath) => {
    try {
      const { loadConfig, validateConfig } = require('./i18n-checker/config');
      const config = loadConfig(configPath);
      const errors = validateConfig(config);

      if (errors.length === 0) {
        console.log('✅ 配置文件验证通过');
        console.log('📋 配置摘要:');
        console.log(`   - 语言: ${config.locales.languages.join(', ')}`);
        console.log(`   - 命名空间: ${config.locales.namespaces.join(', ')}`);
        console.log(`   - 参考语言: ${config.locales.referenceLang}`);
        console.log(`   - 基础目录: ${config.locales.baseDir}`);
      } else {
        console.error('❌ 配置文件验证失败:');
        errors.forEach(error => console.error(`   - ${error}`));
        process.exit(1);
      }
    } catch (error) {
      console.error(`❌ 验证配置文件失败: ${error.message}`);
      process.exit(1);
    }
  });

// 自动修复命令
program
  .command('fix')
  .description('自动修复翻译键不一致问题')
  .option('-c, --config <path>', '指定配置文件路径')
  .option('--dry-run', '仅显示将要修复的问题，不实际修改文件')
  .option('--no-backup', '不创建备份文件')
  .action(async (options) => {
    try {
      const checker = createChecker({
        configPath: options.config
      });

      // 先执行检查
      console.log('🔍 正在检查翻译键一致性...\n');
      const result = await checker.run();

      if (result.issues.length === 0) {
        console.log('✅ 没有发现需要修复的问题！');
        process.exit(0);
      }

      const { createAutoFixer } = require('./i18n-checker/auto-fixer');
      const config = checker.getConfig();

      // 如果指定了不创建备份，修改配置
      if (options.noBackup) {
        config.fix.createBackup = false;
      }

      const fixer = createAutoFixer(config);

      if (options.dryRun) {
        console.log('🔍 预览模式 - 将要修复的问题:');
        const autoFixableIssues = result.issues.filter(issue =>
          config.fix.autoFixTypes.includes(issue.type)
        );

        if (autoFixableIssues.length === 0) {
          console.log('⚠️  没有可自动修复的问题');
        } else {
          for (const issue of autoFixableIssues) {
            console.log(`✅ ${issue.language}/${issue.namespace}.json: ${issue.keyPath} (${issue.type})`);
          }
          console.log(`\n📊 总计: ${autoFixableIssues.length} 个问题可自动修复`);
        }
      } else {
        await fixer.fixIssues(result.issues);

        // 重新检查验证修复结果
        console.log('\n🔍 验证修复结果...');
        const reCheckResult = await checker.run();

        if (reCheckResult.success) {
          console.log('🎉 所有问题已成功修复！');
        } else {
          console.log(`⚠️  还有 ${reCheckResult.issues.length} 个问题需要手动处理`);
        }
      }
    } catch (error) {
      console.error(`❌ 修复失败: ${error.message}`);
      process.exit(1);
    }
  });

// 显示统计信息
program
  .command('stats')
  .description('显示翻译文件统计信息')
  .option('-c, --config <path>', '指定配置文件路径')
  .action(async (options) => {
    try {
      const checker = createChecker({
        configPath: options.config
      });

      // 只提取键信息，不进行验证
      const { extractAllKeys } = require('./i18n-checker/key-extractor');
      const allKeys = extractAllKeys(checker.getConfig());
      
      console.log('\n📊 翻译文件统计信息');
      console.log('='.repeat(40));
      
      for (const [language, languageData] of Object.entries(allKeys)) {
        if (languageData.error) {
          console.log(`❌ ${language}: ${languageData.error}`);
          continue;
        }

        console.log(`\n🌐 ${language}:`);
        let totalKeys = 0;
        
        for (const [namespace, namespaceData] of Object.entries(languageData.namespaces)) {
          if (namespaceData.error) {
            console.log(`   ❌ ${namespace}: ${namespaceData.error}`);
            continue;
          }

          const keys = Array.isArray(namespaceData.keys) ? namespaceData.keys :
                       Array.isArray(namespaceData) ? namespaceData : [];
          const leafKeys = Array.isArray(keys) ? keys.filter(key => key.isLeaf).length : 0;
          totalKeys += leafKeys;
          
          console.log(`   📄 ${namespace}: ${leafKeys} 个翻译键`);
        }
        
        console.log(`   📈 总计: ${totalKeys} 个翻译键`);
      }
    } catch (error) {
      console.error(`❌ 获取统计信息失败: ${error.message}`);
      process.exit(1);
    }
  });

// 默认命令（如果没有指定子命令，执行检查）
program
  .argument('[command]', '要执行的命令')
  .option('-c, --config <path>', '指定配置文件路径')
  .option('-f, --format <format>', '报告格式 (console|json|html)', 'console')
  .option('-o, --output <path>', '输出文件路径')
  .option('-v, --verbose', '显示详细信息')
  .option('--fail-on <severity>', '指定失败的严重级别', 'high')
  .action(async (command, options) => {
    // 如果没有指定命令或命令不存在，执行默认检查
    if (!command || !program.commands.find(cmd => cmd.name() === command)) {
      try {
        const checker = createChecker({
          configPath: options.config,
          format: options.format,
          output: options.output,
          verbose: options.verbose
        });

        const result = await checker.run();
        
        const shouldFail = shouldFailOnSeverity(result.issues, options.failOn);
        process.exit(shouldFail ? 1 : 0);
      } catch (error) {
        console.error(`❌ 检查失败: ${error.message}`);
        process.exit(1);
      }
    }
  });

/**
 * 根据严重级别判断是否应该失败
 * @param {Array} issues - 问题列表
 * @param {string} failOnSeverity - 失败的严重级别阈值
 * @returns {boolean} 是否应该失败
 */
function shouldFailOnSeverity(issues, failOnSeverity) {
  const severityLevels = {
    'low': 1,
    'medium': 2,
    'high': 3,
    'critical': 4
  };

  const threshold = severityLevels[failOnSeverity.toLowerCase()] || 3;
  
  return issues.some(issue => {
    const issueSeverity = severityLevels[issue.severity.toLowerCase()] || 1;
    return issueSeverity >= threshold;
  });
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
  process.exit(1);
});

// 解析命令行参数
program.parse();
