# QuickStart项目安装指南

本文档包含 QuickStart 项目在不同环境下可能遇到的安装问题和相应解决方案。

## 常见安装问题

### 1. 编码问题

在Windows环境中，特别是中文环境，可能会遇到编码问题。这些问题通常表现为：

```
UnicodeDecodeError: 'gbk' codec can't decode byte 0x80 in position 63: illegal multibyte sequence
```

**解决方案**：
- 使用我们提供的 `setup.py` 脚本，它会使用 UTF-8 编码来处理文件
- 手动安装时，确保控制台使用 UTF-8 编码：
  ```
  chcp 65001
  ```
- 手动逐个安装依赖而不是使用 requirements.txt 文件：
  ```
  pip install flask flask-cors pywin32 Pillow
  ```

### 2. Husky 安装问题

如果您在安装过程中看到以下错误：

```
'husky' is not recognized as an internal or external command,
operable program or batch file.
```

**解决方案**：
- 使用我们提供的 `setup.py` 脚本，它会正确安装所有依赖
- 或者手动安装husky和相关依赖：
  ```
  npm install --save-dev husky @commitlint/cli @commitlint/config-conventional
  npx husky install
  ```

### 3. 模块不存在问题

如果您看到以下错误：

```
ModuleNotFoundError: No module named 'flask'
```

**解决方案**：
- 确保您已安装所有Python依赖：
  ```
  pip install flask flask-cors pywin32 Pillow
  ```
- 确保您的虚拟环境已激活（如果使用）

## 首次安装步骤（推荐）

1. 克隆仓库
   ```
   git clone https://github.com/AstraSolis/QuickStart.git
   ```

2. 进入项目目录
   ```
   cd QuickStart
   ```

3. 使用安装脚本（自动解决编码问题和依赖安装）
   ```
   python setup.py
   ```

4. 启动项目
   ```
   npm run dev
   ```

## 手动安装步骤（高级用户）

1. 克隆仓库并进入项目目录
   ```
   git clone https://github.com/AstraSolis/QuickStart.git
   cd QuickStart
   ```

2. 设置控制台为UTF-8编码
   ```
   chcp 65001
   ```

3. 安装前端依赖
   ```
   npm install
   ```

4. 安装Husky（如果安装失败）
   ```
   npm install --save-dev husky @commitlint/cli @commitlint/config-conventional
   npx husky install
   ```

5. 安装后端依赖
   ```
   cd backend
   pip install flask flask-cors pywin32 Pillow
   cd ..
   ```

6. 启动项目
   ```
   npm run dev
   ```

## 项目启动后的常见问题

如果在启动项目后遇到问题，请检查：

1. 端口占用：确保5000端口未被其他应用占用
2. 路径问题：确保项目路径中没有特殊字符或非ASCII字符
3. 权限问题：某些功能可能需要管理员权限

## 联系支持

如果您遇到无法解决的问题，请通过以下方式联系我们：

1. 在GitHub上提交Issue：[Issues页面](https://github.com/AstraSolis/QuickStart/issues)
2. 发送邮件到：[开发者邮箱] 