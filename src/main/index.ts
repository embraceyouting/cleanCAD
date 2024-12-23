import { app, shell, BrowserWindow, ipcMain, Menu, webContents , dialog } from 'electron'
const path = require('path');
const fs = require('fs');
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

let mainWindow
let symbolEditorWindow
let diagramFilePath

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.maximize();

  let template = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建文件',
          accelerator: 'Ctrl+N',
          click: () => {
            createFile();
          }
        },
        {
          type: "separator",
        },
        {
          label: '打开文件',
          accelerator: 'Ctrl+O',
          click: () => {
            openFile();
          }
        },
        {
          type: "separator",
        },
        {
          label: '保存文件',
          accelerator: 'Ctrl+S',
          click: () => {
            mainWindow.webContents.send("saveFile");
          }
        },
      ]
    },
    {
      label: '添加符号',
      submenu: [
        {
          label: "符号编辑器",
          click: () => {
            if (symbolEditorWindow) {
              symbolEditorWindow.focus();
            } else {
              createSymbolEditorWindow()
            }
          }
        },
        {
          type: "separator",
        },
        {
          label: "符号库",
          click: () => {
            mainWindow.webContents.send('routechange');
          }
        }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '更多',
          click: async () => {
            await shell.openExternal('https://github.com/embraceyouting/cleanCAD');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  mainWindow.setMenu(menu);

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const userDataPath = app.getPath('userData');
  const diagramPath = path.join(userDataPath, 'diagram');

  mainWindow.webContents.send("getFilePath", path.join(userDataPath,diagramPath));

  async function createFile() {
    try {
      // 确保userData路径下的diagram目录存在
      const userDataPath = app.getPath('userData');
      const diagramPath = path.join(userDataPath, 'diagram');
      
      await fs.promises.mkdir(diagramPath, { recursive: true });
  
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Create File',
        defaultPath: path.join(diagramPath, 'untitled.json')
      });
  
      if (canceled || !filePath) {
        return;
      }
  
      // 在用户选择的路径创建一个空文件
      await fs.promises.writeFile(filePath, '{}', 'utf8'); // 写入空内容
  
      // 发送文件名到渲染进程
      diagramFilePath = filePath;
      mainWindow.webContents.send("createFile", filePath); // 传递文件路径给渲染进程
      mainWindow.webContents.send("getFilePath", filePath); //
  
      // 显示成功消息
      dialog.showMessageBox(mainWindow, { message: 'File created successfully.' });
    } catch (err) {
      console.error('Error:', err); // 打印错误信息到控制台
      dialog.showErrorBox('Error', `Failed to create file: ${err.message}`); // 显示错误信息
    }
  }


  // ipcMain.on("getDrawFn", async (event, name) => {
  //   try {
  //     // 获取用户数据路径
  //     const userDataPath = app.getPath('userData');
  //     const drawFnPath = path.join(userDataPath, 'drawFn');
  //     const fileName = `${name}.json`;
  //     const fullPath = path.join(drawFnPath, fileName);
  
  //     // 确保目录存在
  //     await fs.promises.mkdir(drawFnPath, { recursive: true });
  
  //     // 检查文件是否存在并读取文件内容
  //     if (fs.existsSync(fullPath)) {
  //       const fileContent = await fs.promises.readFile(fullPath, 'utf-8');
  //       event.reply("getDrawFnResponse", { success: true, data: JSON.parse(fileContent) });
  //     } else {
  //       event.reply("getDrawFnResponse", { success: false, error: "File not found" });
  //     }
  //   } catch (error:any) {
  //     // 发送错误信息
  //     event.reply("getDrawFnResponse", { success: false, error: error.message });
  //   }
  // });

  ipcMain.on("saveFile", async (_, data) => {
    const userDataPath = app.getPath('userData');
    const diagramPath = path.join(userDataPath, 'diagram');

    await fs.promises.mkdir(diagramPath, { recursive: true });
  
    if (!diagramFilePath) {
      // 如果diagramFilePath未定义，打开保存文件对话框让用户选择路径
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Save Diagram',
        defaultPath: path.join(diagramPath, 'untitled.json'), // 设置默认路径为diagram文件夹下的diagram.json
        filters: [
          { name: 'JSON Files', extensions: ['json'] }
        ]
      });
  
      if (canceled) {
        // 用户取消操作
        return;
      }
      if (filePath) {
        diagramFilePath = filePath; // 更新savePath为用户选择的路径
        mainWindow.webContents.send("getFilePath", filePath);
      }
    }
  
    if (diagramFilePath) {
      try {
        await fs.promises.writeFile(diagramFilePath, JSON.stringify(JSON.parse(data), null, 2), 'utf8');
        // 文件保存成功的处理...
        console.log('File saved successfully:', diagramFilePath);
      } catch (error) {
        // 文件保存失败的处理...
        console.error('Error saving file:', error);
      }
    }

    dialog.showMessageBox(mainWindow, { message: 'File saved successfully.' });

  });

   async function openFile() {
    // 获取默认路径
    const userDataPath = app.getPath('userData');
    const diagramPath = path.join(userDataPath, 'diagram');

    await fs.promises.mkdir(diagramPath, { recursive: true });
  
    dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'JSON Files', extensions: ['json'] }
      ],
      defaultPath: diagramPath
    }).then(result => {
      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        fs.readFile(filePath, 'utf8', (err, data) => {
          if (err) {
            console.error('Error reading file:', err);
            mainWindow.webContents.send('openFile', {success:false,error:err.message});
          } else {
            diagramFilePath = filePath
            mainWindow.webContents.send('openFile', {success:true,data:data});
            mainWindow.webContents.send("getFilePath", filePath);
            dialog.showMessageBox(mainWindow, { message: 'File open successfully.' });
          }
        });
      }
    }).catch(err => {
      console.error('Error opening file dialog:', err);
      mainWindow.webContents.send('file-dialog-error', err.message);
    });
  }


  ipcMain.on("getSymbolLibrary", async (event) => {
    try {
      const userDataPath = app.getPath('userData');
      const SymbolLibraryPath = path.join(userDataPath, 'SymbolLibrary');
  
      await fs.promises.mkdir(SymbolLibraryPath, { recursive: true });
  
      const buildDirectoryStructure = async (dirPath) => {
        const filesAndDirs = await fs.promises.readdir(dirPath, { withFileTypes: true });
        const children:any = [];
        
        for (const entry of filesAndDirs) {
          const entryPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            const subChildren = await buildDirectoryStructure(entryPath);
            children.push({
              label: entry.name,
              isOpen: false,
              children: subChildren
            });
          } else if (entry.isFile() && path.extname(entry.name) === '.json') {
            children.push({ label: path.basename(entry.name, '.json') });
          }
        }
        return children;
      };
  
      // 先获取所有的目录
      const dirs = await fs.promises.readdir(SymbolLibraryPath, { withFileTypes: true })
        .then(filesAndDirs => filesAndDirs.filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name));
  
      // 然后为每个目录构建children
      const libraries = await Promise.all(dirs.map(async (dirName) => {
        const dirPath = path.join(SymbolLibraryPath, dirName);
        const children = await buildDirectoryStructure(dirPath);
        return {
          label: `${dirName}`,
          isOpen: false,
          children
        };
      }));
  
      event.reply("getSymbolLibraryResponse", { success: true, data: JSON.stringify(libraries) });
    } catch (error:any) {
      console.log(error);
      event.reply("getSymbolLibraryResponse", { success: false, error: error.message });
    }
  });

  ipcMain.on("getSymbol", async (event, libraryLabel, symbolLabel) => {
    try {
      const userDataPath = app.getPath('userData');
      const SymbolLibraryPath = path.join(userDataPath, 'SymbolLibrary');
      const filePath = path.join(SymbolLibraryPath, String(libraryLabel), `${String(symbolLabel)}.json`);
  
      // 确保目录存在
      await fs.promises.mkdir(SymbolLibraryPath, { recursive: true });
      await fs.promises.mkdir(path.join(SymbolLibraryPath, String(libraryLabel)), { recursive: true });
  
      // 检查文件是否存在，如果不存在则创建空文件
      const fileExists = await fs.promises.stat(filePath).catch(() => false);
      if (!fileExists) {
        await fs.promises.writeFile(filePath, '{}', 'utf8');
        event.reply("getSymbolResponse", { success: true, data: "{}" });
        return;
      }
  
      const content = await fs.promises.readFile(filePath, 'utf8');
      event.reply("getSymbolResponse", { success: true, data: content.trim() === '' ? "{}" : content });
    } catch (error) {
      console.error('Error reading symbol file:', error);
      event.reply("getSymbolResponse", { success: false, error: "Failed to read symbol file." });
    }
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}




function createSymbolEditorWindow() {
  symbolEditorWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  });

  let template = [
    {
      label: '文件',
      submenu: [
        {
          label: '导入',
          click: () => {
            console.log('导入');
          }
        },
        {
          type: "separator",
        },
        {
          label: '添加库',
          click: () => {
            symbolEditorWindow.webContents.send('createLibrary');
          }
        },
        {
          type: "separator",
        },
        {
          label: '新建符号',
          click: () => {
            symbolEditorWindow.webContents.send('createSymbol');
          }
        },
        {
          type: "separator",
        },
        {
          label: '保存',
          click: () => {
            symbolEditorWindow.webContents.send('saveLibrary');
          }
        },
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '更多',
          click: async () => {
            await shell.openExternal('https://github.com/embraceyouting/cleanCAD');
          }
        }
      ]
    }
  ];

  ipcMain.on("saveLibrary", async (_, libraryData, symbolDataJson) => {
    try {
      const userDataPath = app.getPath('userData');
      const SymbolLibraryPath = path.join(userDataPath, 'SymbolLibrary');
  
      // 确保SymbolLibraryPath存在
      await fs.promises.mkdir(SymbolLibraryPath, { recursive: true });
  
      // 解析传入的库数据
      const library = JSON.parse(libraryData);
  
      // 创建目录
      for (const lib of library) {
        const libPath = path.join(SymbolLibraryPath, lib.label);
        await fs.promises.mkdir(libPath, { recursive: true });
      }

      const symbolData = JSON.parse(symbolDataJson)
      const symbolPath = path.join(SymbolLibraryPath,symbolData.libraryName, `${symbolData.symbolName}.json`)
      await fs.promises.writeFile(symbolPath, JSON.stringify(symbolData.content, null, 2), 'utf8');

      dialog.showMessageBox(symbolEditorWindow, { message: 'Library saved successfully.' });
      console.log('Library saved successfully');
    } catch (error) {
      console.error('Error saving library:', error);
    }
  });


  ipcMain.on("getSymbol", async (event, libraryLabel, symbolLabel) => {
    try {
      const userDataPath = app.getPath('userData');
      const SymbolLibraryPath = path.join(userDataPath, 'SymbolLibrary');
      const filePath = path.join(SymbolLibraryPath, String(libraryLabel), `${String(symbolLabel)}.json`);
  
      // 确保目录存在
      await fs.promises.mkdir(SymbolLibraryPath, { recursive: true });
      await fs.promises.mkdir(path.join(SymbolLibraryPath, String(libraryLabel)), { recursive: true });
  
      // 检查文件是否存在，如果不存在则创建空文件
      const fileExists = await fs.promises.stat(filePath).catch(() => false);
      if (!fileExists) {
        await fs.promises.writeFile(filePath, '{}', 'utf8');
        event.reply("getSymbolResponse", { success: true, data: "{}" });
        return;
      }
  
      const content = await fs.promises.readFile(filePath, 'utf8');
      event.reply("getSymbolResponse", { success: true, data: content.trim() === '' ? "{}" : content });
    } catch (error) {
      console.error('Error reading symbol file:', error);
      event.reply("getSymbolResponse", { success: false, error: "Failed to read symbol file." });
    }
  });

  const menu = Menu.buildFromTemplate(template);
  symbolEditorWindow.setMenu(menu);

  // 加载路由路径 /symbol
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    symbolEditorWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/symbol`);
  } else {
    symbolEditorWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      hash: 'symbol'
    });
  }

  symbolEditorWindow.on('closed', () => {
    symbolEditorWindow = null;
  });

}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
