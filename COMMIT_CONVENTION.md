# 提交规范

本项目采用 [Conventional Commits](https://www.conventionalcommits.org/) 规范进行版本管理。这有助于自动化版本控制、生成变更日志和追踪项目历史。

## 提交消息格式

每个提交消息由以下部分组成：

```
<类型>[可选的作用域]: <描述>

[可选的正文]

[可选的脚注]
```

### 类型

提交类型必须是以下之一：

- **feat**: 新功能
- **fix**: 修复Bug
- **docs**: 文档变更
- **style**: 代码风格变更（不影响功能）
- **refactor**: 重构代码
- **perf**: 性能优化
- **test**: 添加或修改测试
- **chore**: 构建过程或辅助工具变动
- **revert**: 回退提交
- **wip**: 开发中的工作
- **build**: 构建系统变动
- **ci**: CI配置变动

### 作用域

作用域是可选的，用于指定提交影响的部分，例如：

```
feat(frontend): 添加新的用户界面组件
fix(backend): 修复文件上传API的安全问题
```

### 描述

描述是对变更的简短总结：

- 使用动词开头，使用第一人称现在时
- 第一个字母不要大写
- 结尾不加句号

### 正文

正文是可选的，用于提供更详细的变更说明。应该包括更改的动机，并与以前的行为进行对比。

### 脚注

脚注是可选的，用于引用问题跟踪器ID和破坏性变更信息：

```
fix: 修复用户认证问题

修复了在某些情况下用户无法登录的问题

关闭 #123
```

## 破坏性变更

如果提交包含破坏性变更（不向后兼容），必须在类型/作用域后添加感叹号，并在正文或脚注中提供说明：

```
feat!: 移除用户API中的某功能

BREAKING CHANGE: 用户API已重构，不再支持X功能
```

## 示例

```
feat: 添加搜索功能
```

```
fix(auth): 修复登录失败问题

当用户名包含特殊字符时登录功能失败

修复 #234
```

```
docs: 更新README.md

添加安装和使用说明，修改项目描述
```

```
style: 修复代码格式问题

删除多余空行和调整缩进
```

```
refactor!: 完全重写文件管理模块

BREAKING CHANGE: 文件管理API已经完全改变，
请参考新文档进行迁移
```

## 使用方法

1. 安装依赖：
   ```bash
   npm install --save-dev @commitlint/cli @commitlint/config-conventional
   ```

2. 使用 husky 设置 git hooks：
   ```bash
   npm install --save-dev husky
   npx husky install
   npx husky add .husky/commit-msg 'npx --no -- commitlint --edit $1'
   ```

3. 提交代码时使用规范格式：
   ```bash
   git commit -m "feat: 添加新功能"
   ```

4. 或使用交互式工具：
   ```bash
   npx commit
   ```

5. 发布新版本：
   ```bash
   npm run release
   ```

## 自动版本管理

本项目使用 `standard-version` 进行版本管理：

- `npm run release` - 根据提交历史自动决定版本号
- `npm run release:patch` - 增加修订版本 (1.0.0 -> 1.0.1)
- `npm run release:minor` - 增加次版本 (1.0.0 -> 1.1.0)
- `npm run release:major` - 增加主版本 (1.0.0 -> 2.0.0)

每次发布会自动：

1. 更新版本号
2. 生成/更新 CHANGELOG.md
3. 创建 Git 标签
4. 创建版本提交

## 贡献

请确保您的所有提交都遵循此规范，这样我们才能自动化版本控制和变更日志生成。 