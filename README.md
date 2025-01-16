<div align="center">
    <h1>QuickStart</h1>
    <p>一个基于 PyQt5 的桌面应用程序，用于快速启动文件</p>
</div>

> 一些不常用的文件或软件，不想每次使用时翻找目录，又希望保持桌面的整洁，可以试试这个软件
>
> 
---

## ✨ 功能特色

- 🚀 **快速启动**：通过拖拽或选择文件快速添加到列表中，双击即可启动。
- 📝 **文件备注**：为文件添加自定义备注，方便识别。
- ⚙️ **启动参数**：为程序或脚本添加自定义启动参数。
- 🌐 **多语言支持**：支持中文和英文切换，界面动态刷新。
- 🛡️ **管理员权限**：指定文件以管理员权限启动。
- 📂 **右键菜单**：支持打开文件位置、删除文件等操作。
- 🖼️ **文件图标支持**：智能解析文件类型并显示对应图标（支持 `.lnk` 和 `.url`）。

---

<div align="center">
    <h2>📸 使用截图</h2>
</div>

![主界面](https://github.com/user-attachments/assets/529e50af-fefc-4f06-bd1c-33559979d1b8)

---
## 文件配置

应用的文件信息保存在 `config.json` 文件中，结构如下：

```json
{
    "files": [
        {
            "name": "example.exe",
            "path": "C:/path/to/example.exe",
            "is_dir": false,
            "remark": "示例文件",
            "admin": false,
            "params": ""
        }
    ],
    "show_extensions": true,
    "language": "中文",
    "remove_arrow": false
}
```
---

## 💻 安装与运行
普通用户在[Releases](https://github.com/AstraSolis/QuickStart/releases/)下载最新QuickStart.exe到文件夹，双击运行即可

注意软件运行时会生成config.json，应用的文件信息都保存在这里

### 环境要求(Python Source Code)

- **Python 3.7+**
- **Windows 操作系统**（支持管理员权限运行）
- 以下 Python 库：
  - `PyQt5`
  - `pywin32`

### 安装依赖

使用 `pip` 安装所需依赖：

```bash
pip install PyQt5 pywin32
```
---

<div>
⭐ 如果你喜欢这个项目，请给它一个 Star！
</div>

