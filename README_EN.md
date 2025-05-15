<div align="center">
    <h1>QuickStart</h1>
    <p>An Electron and Python based quick launch tool to efficiently manage and access your files</p>
    <p>
        <img src="https://img.shields.io/badge/Electron-16.0+-blue.svg" alt="Electron">
        <img src="https://img.shields.io/badge/Python-3.7+-green.svg" alt="Python">
        <img src="https://img.shields.io/badge/Windows-10+-yellow.svg" alt="Windows">
        <img src="https://img.shields.io/badge/License-MIT-lightgrey.svg" alt="License">
    </p>
    <p>
        <a href="README.md">
            <img src="https://img.shields.io/badge/中文-查看中文文档-blue" alt="查看中文文档">
        </a>
    </p>
</div>

> Have files or applications you don't use often but don't want to search through directories each time?
>
> Keep your desktop clean while maintaining quick access to your important files!

---

## ✨ Features

- 🚀 **Quick Launch**: Open files or folders with a double-click, supports batch adding and drag-and-drop
- 📝 **File Notes**: Add custom notes to each file for easy identification and management
- ⚙️ **Launch Parameters**: Set custom launch parameters for executable files
- 🌐 **Multi-language**: Built-in Chinese and English interfaces, switch anytime
- 🛡️ **Admin Privileges**: Run programs with administrator privileges
- 📂 **Context Menu**: Rich right-click menu including opening file location, copying path, and more
- 🖼️ **File Icons**: Automatically fetches system file icons for intuitive file type display
- 🔄 **Sorting**: Drag and drop to rearrange file order
- 🔍 **File Extensions**: Option to show or hide file extensions
- 🖥️ **Tray Integration**: System tray icon for quick access even when the window is hidden
- 🔗 **Shortcut Optimization**: Option to remove shortcut arrow icons
- 📊 **Git Version Management**: Git-based version control with automatic changelog generation
- 📦 **Standardized Commits**: Support for Conventional Commits format

---

<div align="center">
    <h2>📸 Screenshots</h2>
    <p>The main interface shows the file list and operation buttons</p>
</div>

![Main Interface Example](https://img.picui.cn/free/2025/05/15/6825828e6b7a7.png)

---

## 📚 User Guide

### Adding Files or Folders

- Click the "Add File" button to select files
- Drag and drop files directly into the program window

### Launching Files

- Double-click items in the list to open files/folders

### Right-click Menu Functions

- **Open** - Open the selected file or folder
- **Admin Privileges** - Enable/disable running with administrator privileges
- **Notes** - Add or edit file notes
- **Parameters** - Set launch parameters (applicable to executable files)
- **Tray** - Add to/remove from system tray
- **Location** - Open the folder containing the file
- **Path** - Copy file path to clipboard
- **Sort** - Move up/down to adjust file order
- **Delete** - Remove file from the list

### System Tray Operations

- Click the tray icon to show/hide the main window
- Right-click the tray icon to quickly access added items

### Settings Options

- **Language** - Switch interface language (Chinese/English)
- **File Extensions** - Choose whether to display file extensions
- **Shortcut Arrow** - Choose whether to remove arrow icons
- **Tray Minimization** - Enable/disable minimize to tray

---

## 📋 Configuration

Application settings and file information are stored in database in the user directory:

- Database file: `%APPDATA%\quickstart\quickstart.db`
- Version information: `version.json` and `version.txt`

---

## 💻 Installation and Usage

### Regular Users

1. Download the latest installer from the [Releases](https://github.com/AstraSolis/QuickStart/releases/) page
2. Run the installer and follow the wizard to complete installation
3. Launch the program from the Start menu or desktop shortcut

### Developers

#### Requirements

- **Node.js v14+**
- **Python 3.7+**
- **Windows operating system**
- **Git** (for version control)

#### Install Dependencies

```bash
# Clone repository
git clone https://github.com/AstraSolis/QuickStart.git

# Navigate to project directory
cd QuickStart

# Use setup script (recommended)
python setup.py

# Or manually install dependencies
# Frontend dependencies
npm install
# Backend dependencies (ensure UTF-8 encoding)
cd backend
pip install flask flask-cors pywin32 Pillow
cd ..
```

> **Note**: If you encounter installation issues, please refer to the [Setup Guide](./README_SETUP.md) for detailed solutions.

#### Start Development Environment

```bash
# Use fix_encoding.py to resolve Chinese encoding issues
python fix_encoding.py

# Or use npm script
npm run dev
```

#### Build Executable

```bash
# Update version information (optional)
npm run version

# Build application
npm run build
```

After building, you can find the installer in the `dist` directory.

#### Version Release

```bash
# Automatically determine version number based on commit history
npm run release

# Increase patch version (1.0.0 -> 1.0.1)
npm run release:patch

# Increase minor version (1.0.0 -> 1.1.0)
npm run release:minor

# Increase major version (1.0.0 -> 2.0.0)
npm run release:major
```

---

## 🔧 Architecture

- **Frontend**: Electron + HTML/CSS/JavaScript
- **Backend**: Python + Flask REST API
- **Data Storage**: SQLite database
- **Version Control**: Git + standard-version

---

## 📂 Directory Structure

```
quickstart/
│
├── backend/                # Python backend
│   ├── app.py              # Flask application main entry
│   ├── config_manager.py   # Configuration management
│   ├── file_manager.py     # File operations
│   ├── system_manager.py   # System integration
│   ├── languages.py        # Language management
│   ├── languages.json      # Language configuration file
│   └── requirements.txt    # Python dependencies
│
├── frontend/               # Electron frontend
│   ├── assets/             # Static resources
│   ├── index.html          # Main page
│   ├── main.js             # Electron main process
│   ├── renderer.js         # Rendering process
│   └── styles.css          # Stylesheet
│
├── scripts/                # Script tools
│   ├── update-version.js   # Version information update tool
│   ├── kill-python.js      # Python process management tool
│   └── test-version-display.js # Version display test tool
│
├── .husky/                 # Git hooks configuration
├── CHANGELOG.md            # Change log
├── COMMIT_CONVENTION.md    # Commit convention guide
├── commitlint.config.js    # Commit lint configuration
├── version.json            # Detailed version information
├── version.txt             # Simplified version number
├── package.json            # Project configuration
├── package-lock.json       # NPM dependencies lock
├── setup.py                # Setup script
├── fix_encoding.py         # Encoding fix tool
├── languages.json          # Global language configuration
├── .gitignore              # Git ignore configuration
├── LICENSE                 # License
├── README.md               # Chinese documentation
├── README_EN.md            # English documentation
└── README_SETUP.md         # Setup guide
```

---

## ❓ Common Issues

1. **Unable to Start Program**
   - Check if all dependencies are installed
   - Ensure port 5000 is not occupied by other programs
   - Check console error messages

2. **System Tray Icon Not Displaying**
   - Restart the program
   - Check if the system tray area is full
   - Verify that the icon file exists

3. **Files Cannot Be Opened**
   - Confirm if the file path exists
   - Check file permissions
   - For .url files, ensure the format is correct

4. **Chinese Display Garbled**
   - Use fix_encoding.py to start the program
   - Ensure the system supports UTF-8 encoding

5. **Version Management Issues**
   - Ensure Git is installed and properly configured
   - Check if commit format complies with conventions
   - Verify that version.json and CHANGELOG.md are correctly updated

---

## 🤝 Contribution Guidelines

Welcome to submit Issues and Pull Requests to improve this project together!

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (using the convention: `git commit -m 'feat: add some feature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

For more information on commit conventions, please refer to [COMMIT_CONVENTION.md](./COMMIT_CONVENTION.md).

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/AstraSolis/QuickStart/blob/master/LICENSE) file for details

---

<div align="center">
    <p>⭐ If you like this project, please give it a star!</p>
    <p>Suggestions and feedback are welcome!</p>
</div> 