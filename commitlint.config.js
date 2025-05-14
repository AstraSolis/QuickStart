module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 新功能
        'fix',      // 修复Bug
        'docs',     // 文档变更
        'style',    // 代码风格变更（不影响功能）
        'refactor', // 重构代码
        'perf',     // 性能优化
        'test',     // 添加或修改测试
        'chore',    // 构建过程或辅助工具变动
        'revert',   // 回退提交
        'wip',      // 开发中的工作
        'build',    // 构建系统变动
        'ci'        // CI配置变动
      ]
    ],
    'type-case': [0],
    'type-empty': [2, 'never'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [0, 'never'],
    'subject-case': [0, 'never']
  },
  prompt: {
    questions: {
      type: {
        description: '选择您要提交的更改类型',
        enum: {
          feat: {
            description: '新功能',
            title: 'Features',
            emoji: '✨'
          },
          fix: {
            description: '修复Bug',
            title: 'Bug Fixes',
            emoji: '🐛'
          },
          docs: {
            description: '文档变更',
            title: 'Documentation',
            emoji: '📚'
          },
          style: {
            description: '代码风格变更（不影响功能）',
            title: 'Styles',
            emoji: '💎'
          },
          refactor: {
            description: '重构代码',
            title: 'Code Refactoring',
            emoji: '📦'
          },
          perf: {
            description: '性能优化',
            title: 'Performance Improvements',
            emoji: '🚀'
          },
          test: {
            description: '添加或修改测试',
            title: 'Tests',
            emoji: '🚨'
          },
          chore: {
            description: '构建过程或辅助工具变动',
            title: 'Chores',
            emoji: '♻️'
          },
          revert: {
            description: '回退提交',
            title: 'Reverts',
            emoji: '🗑'
          },
          wip: {
            description: '开发中的工作',
            title: 'Work in Progress',
            emoji: '🚧'
          },
          build: {
            description: '构建系统变动',
            title: 'Builds',
            emoji: '🛠'
          },
          ci: {
            description: 'CI配置变动',
            title: 'Continuous Integration',
            emoji: '⚙️'
          }
        }
      },
      scope: {
        description: '更改的范围（例如组件或文件名）'
      },
      subject: {
        description: '写一个简短的更改描述'
      },
      body: {
        description: '提供更改的详细说明'
      },
      isBreaking: {
        description: '是否有破坏性变更?'
      },
      breakingBody: {
        description: '破坏性变更的详细描述'
      },
      breaking: {
        description: '破坏性变更的简短描述'
      },
      isIssueAffected: {
        description: '此更改是否影响未解决的问题?'
      },
      issuesBody: {
        description: '问题引用的说明'
      },
      issues: {
        description: '添加问题引用（例如："fix #123", "re #123"）'
      }
    }
  }
}; 