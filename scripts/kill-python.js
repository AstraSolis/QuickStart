/**
 * Python进程清理脚本
 * 这个脚本用于查找并终止Python进程，特别是在应用未正常退出时
 */

const { exec, spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

// 根据操作系统选择不同的命令
const isWindows = os.platform() === 'win32';

/**
 * 查找Python进程
 */
function findPythonProcesses() {
  return new Promise((resolve, reject) => {
    // 特定于应用的Python脚本识别模式
    const scriptName = 'app.py';
    
    if (isWindows) {
      // Windows: 首先尝试wmic (更精确)
      const wmicCmd = `wmic process where "commandline like '%${scriptName}%'" get processid, commandline`;
      
      exec(wmicCmd, (wmicError, wmicStdout) => {
        if (!wmicError) {
          try {
            const lines = wmicStdout.toString().split('\n');
            const pythonProcesses = [];
            
            // 跳过标题行
            for (let i = 1; i < lines.length; i++) {
              const line = lines[i].trim();
              if (line) {
                // 从行尾部提取PID
                const parts = line.trim().split(/\s+/);
                if (parts.length > 0) {
                  const pid = parts[parts.length - 1];
                  if (/^\d+$/.test(pid)) {
                    pythonProcesses.push(pid);
                    console.log(`通过WMIC找到Python进程: ${pid}, 命令: ${line}`);
                  }
                }
              }
            }
            
            if (pythonProcesses.length > 0) {
              return resolve(pythonProcesses);
            }
          } catch (parseError) {
            console.error(`解析WMIC输出失败: ${parseError}`);
            // 继续尝试tasklist
          }
        }
        
        // 如果wmic失败，回退到tasklist
        const tasklistCmd = 'tasklist /FO CSV';
        exec(tasklistCmd, (error, stdout) => {
          if (error) {
            console.error(`执行tasklist失败: ${error.message}`);
            return reject(error);
          }
          
          try {
            const lines = stdout.toString().split('\n');
            const pythonProcesses = [];
            
            // tasklist CSV格式: "Image Name","PID","Session Name","Session#","Mem Usage"
            lines.forEach(line => {
              if (line.includes('python')) {
                const match = line.match(/"([^"]+)","(\d+)"/);
                if (match && match[2]) {
                  const pid = match[2];
                  pythonProcesses.push(pid);
                  console.log(`通过tasklist找到Python进程: ${pid}`);
                }
              }
            });
            
            resolve(pythonProcesses);
          } catch (parseError) {
            console.error(`解析进程列表失败: ${parseError.message}`);
            reject(parseError);
          }
        });
      });
    } else {
      // Unix系统: 使用ps查找Python进程
      const cmd = `ps aux | grep ${scriptName}`;
      exec(cmd, (error, stdout) => {
        if (error) {
          console.error(`查找Python进程失败: ${error.message}`);
          return reject(error);
        }
        
        try {
          const lines = stdout.toString().split('\n');
          const pythonProcesses = [];
          
          lines.forEach(line => {
            if (line.includes('python') && line.includes(scriptName) && !line.includes('grep')) {
              const parts = line.trim().split(/\s+/);
              if (parts.length > 1) {
                pythonProcesses.push(parts[1]);
                console.log(`找到Python进程: ${parts[1]}, 命令: ${line}`);
              }
            }
          });
          
          resolve(pythonProcesses);
        } catch (parseError) {
          console.error(`解析进程列表失败: ${parseError.message}`);
          reject(parseError);
        }
      });
    }
  });
}

/**
 * 终止进程及其子进程
 */
function killProcessTree(pid) {
  return new Promise((resolve) => {
    console.log(`尝试终止进程树 (PID: ${pid})...`);
    
    try {
      if (isWindows) {
        // Windows: 使用taskkill /T选项终止进程树
        const killer = spawn('taskkill', ['/F', '/T', '/PID', pid], {
          detached: true,
          stdio: 'pipe'
        });
        
        let output = '';
        let errorOutput = '';
        
        killer.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        killer.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        killer.on('close', (code) => {
          if (code === 0) {
            console.log(`进程 ${pid} 终止成功: ${output.trim()}`);
          } else {
            console.error(`进程 ${pid} 终止失败 (返回码: ${code}): ${errorOutput.trim()}`);
          }
          resolve();
        });
      } else {
        // 非Windows: 先找子进程然后逐个终止
        exec(`pgrep -P ${pid}`, (err, stdout) => {
          const childPids = stdout.toString().trim().split('\n').filter(Boolean);
          
          // 递归终止子进程
          const killChildPromises = childPids.map(childPid => killProcessTree(childPid));
          
          Promise.all(killChildPromises).then(() => {
            // 终止父进程
            exec(`kill -9 ${pid}`, () => {
              console.log(`进程 ${pid} 已终止`);
              resolve();
            });
          });
        });
      }
    } catch (error) {
      console.error(`终止进程 ${pid} 失败: ${error.message}`);
      resolve();
    }
  });
}

/**
 * 创建并写入PID文件以支持直接终止
 */
function createPidFile(pid) {
  try {
    const appDir = path.join(os.tmpdir(), 'quickstart');
    if (!fs.existsSync(appDir)) {
      fs.mkdirSync(appDir, { recursive: true });
    }
    
    const pidFile = path.join(appDir, 'app.pid');
    fs.writeFileSync(pidFile, pid.toString(), 'utf8');
    console.log(`已创建PID文件: ${pidFile}, PID: ${pid}`);
    return true;
  } catch (error) {
    console.error(`创建PID文件失败: ${error.message}`);
    return false;
  }
}

/**
 * 从PID文件读取进程ID
 */
function readPidFile() {
  try {
    const pidFile = path.join(os.tmpdir(), 'quickstart', 'app.pid');
    if (fs.existsSync(pidFile)) {
      const pid = fs.readFileSync(pidFile, 'utf8').trim();
      console.log(`从PID文件读取PID: ${pid}`);
      return pid;
    }
  } catch (error) {
    console.error(`读取PID文件失败: ${error.message}`);
  }
  return null;
}

/**
 * 强制终止所有相关进程
 */
async function forceKillAll() {
  // 首先尝试从PID文件终止
  const pidFromFile = readPidFile();
  if (pidFromFile) {
    await killProcessTree(pidFromFile);
  }
  
  // 然后搜索并终止所有Python进程
  try {
    const pythonProcesses = await findPythonProcesses();
    
    if (pythonProcesses.length === 0) {
      console.log('未找到Python进程');
      return true;
    }
    
    console.log(`找到 ${pythonProcesses.length} 个Python进程`);
    
    // 并发终止所有进程
    const killPromises = pythonProcesses.map(pid => killProcessTree(pid));
    await Promise.all(killPromises);
    
    console.log('所有Python进程已处理完毕');
    return true;
  } catch (error) {
    console.error(`强制终止进程失败: ${error.message}`);
    return false;
  }
}

/**
 * 直接终止特定进程
 */
async function terminateProcess(pid) {
  if (!pid) return false;
  
  try {
    console.log(`直接终止进程 ${pid}`);
    await killProcessTree(pid);
    
    // 创建PID文件以便后续清理
    createPidFile(pid);
    
    return true;
  } catch (error) {
    console.error(`终止特定进程失败: ${error.message}`);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  // 检查是否提供了特定PID作为命令行参数
  const args = process.argv.slice(2);
  const specificPid = args[0] && /^\d+$/.test(args[0]) ? args[0] : null;
  
  if (specificPid) {
    // 如果指定了PID，只终止该进程
    await terminateProcess(specificPid);
  } else {
    // 否则强制终止所有相关进程
    await forceKillAll();
  }
}

// 执行主函数
main().then(() => {
  console.log('进程清理完成');
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}).catch(error => {
  console.error(`进程清理失败: ${error.message}`);
  process.exit(1);
}); 