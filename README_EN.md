<div align="center">
    <h1>QuickStart</h1>
    <p>A PyQt5-based desktop application for quick file launching</p>
    <p>
        <img src="https://img.shields.io/badge/Python-3.7+-blue.svg" alt="Python">
        <img src="https://img.shields.io/badge/Windows-10+-green.svg" alt="Windows">
        <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License">
    </p>
    <p>
        <a href="README.md">
            <img src="https://img.shields.io/badge/中文-阅读中文版-red" alt="Read in Chinese">
        </a>
    </p>
</div>

> For files or software that you don't use frequently but don't want to search through directories each time, while keeping your desktop clean, try this software!
>
> Keep your desktop organized while quickly accessing your favorite files!

---

## ✨ Features

- 🚀 **Quick Launch**: Add files to the list through drag-and-drop or selection, double-click to launch.
- 📝 **File Remarks**: Add custom remarks to files for easy identification.
- ⚙️ **Launch Parameters**: Add custom launch parameters for programs or scripts.
- 🌐 **Multi-language Support**: Support for multiple languages with dynamic interface refresh.
- 🛡️ **Admin Rights**: Launch files with administrator privileges.
- 📂 **Context Menu**: Support for opening file location, deleting files, and more.
- 🖼️ **File Icon Support**: Smart parsing of file types with corresponding icons (supports `.lnk` and `.url`).
- 🔄 **Auto Save**: All changes are automatically saved to the configuration file.
- 🎨 **System Tray**: Minimize to system tray for quick access.

---

<div align="center">
    <h2>📸 Screenshots</h2>
</div>

![Main Interface](https://github.com/user-attachments/assets/971d5aae-d738-439b-9e49-72c60c6c392b)

---

## 📋 Configuration

The application's file information is saved in the `config.json` file with the following structure:

```json
{
    "language": "English",
    "show_extensions": true,
    "remove_arrow": true,
    "minimize_to_tray": true,
    "tray_items": [
        {
            "name": "example.exe",
            "path": "C:/path/to/example.exe",
            "is_dir": false,
            "remark": "Example file",
            "admin": false,
            "params": ""
        }
    ]
}
```

### Configuration Details

- `language`: Interface language
- `show_extensions`: Show file extensions
- `remove_arrow`: Remove shortcut arrows
- `minimize_to_tray`: Minimize to system tray
- `tray_items`: List of files
  - `name`: Display name
  - `path`: File path
  - `is_dir`: Is folder
  - `remark`: Remark information
  - `admin`: Run as administrator
  - `params`: Launch parameters

---

## 💻 Installation and Running

### Regular Users

1. Download the latest version of `QuickStart.exe` from [Releases](https://github.com/AstraSolis/QuickStart/releases/)
2. Save the file to any directory
3. Double-click to run

> Note: `config.json` will be automatically generated on first run

### Developers

#### Requirements

- **Python 3.7+**
- **Windows OS** (supports administrator privileges)
- Required Python packages:
  - `PyQt5`
  - `pywin32`

#### Installing Dependencies

```bash
# Clone the repository
git clone https://github.com/AstraSolis/QuickStart.git

# Enter project directory
cd QuickStart

# Install dependencies
pip install -r requirements.txt
```

#### Running from Source

```bash
python QuickStart.py
```

---

## 🤝 Contributing

Issues and Pull Requests are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/AstraSolis/QuickStart/blob/master/LICENSE) file for details

---

<div align="center">
    <p>⭐ If you like this project, please give it a Star!</p>
    <p>Suggestions and feedback are welcome!</p>
</div> 