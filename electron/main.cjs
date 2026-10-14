// electron/main.cjs
const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Elektroplan CAE Suite (EPLAN Electric P8 Edition)',
    backgroundColor: '#12161f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const isDev = !app.isPackaged;
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (isDev && !process.env.ELECTRON_PROD_TEST) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  createMenu();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu() {
  const template = [
    {
      label: 'Datei',
      submenu: [
        {
          label: 'Neues Projekt',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu:new')
        },
        {
          label: 'Projekt öffnen...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
              title: 'EPLAN / Elektroplan Projekt öffnen',
              filters: [
                { name: 'EPLAN & Elektroplan Dateien', extensions: ['zw1', 'edz', 'xml', 'json', 'elk'] },
                { name: 'EPLAN Backup (*.zw1)', extensions: ['zw1'] },
                { name: 'EPLAN Data Portal Makro (*.edz)', extensions: ['edz'] },
                { name: 'EPLAN XML (*.xml)', extensions: ['xml'] },
                { name: 'Elektroplan Projekt (*.json)', extensions: ['json'] },
                { name: 'Alle Dateien', extensions: ['*'] }
              ],
              properties: ['openFile']
            });
            if (!canceled && filePaths.length > 0) {
              const filePath = filePaths[0];
              const fileBuffer = fs.readFileSync(filePath);
              mainWindow?.webContents.send('menu:fileOpened', {
                path: filePath,
                name: path.basename(filePath),
                data: Array.from(fileBuffer)
              });
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Projekt speichern',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:save')
        },
        {
          label: 'Exportieren als EPLAN .zw1...',
          click: () => mainWindow?.webContents.send('menu:exportZw1')
        },
        {
          label: 'Exportieren als EPLAN XML...',
          click: () => mainWindow?.webContents.send('menu:exportXml')
        },
        { type: 'separator' },
        {
          label: 'Drucken / PDF...',
          accelerator: 'CmdOrCtrl+P',
          click: () => mainWindow?.webContents.print()
        },
        { type: 'separator' },
        {
          label: 'Beenden',
          accelerator: 'Alt+F4',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Bearbeiten',
      submenu: [
        { label: 'Rückgängig', role: 'undo' },
        { label: 'Wiederholen', role: 'redo' },
        { type: 'separator' },
        { label: 'Ausschneiden', role: 'cut' },
        { label: 'Kopieren', role: 'copy' },
        { label: 'Einfügen', role: 'paste' },
        { label: 'Löschen', role: 'delete' },
        { type: 'separator' },
        {
          label: 'Bauteil um 90° drehen',
          accelerator: 'R',
          click: () => mainWindow?.webContents.send('menu:rotate')
        }
      ]
    },
    {
      label: 'Ansicht',
      submenu: [
        { label: 'Neu laden', role: 'reload' },
        { label: 'Entwicklertools', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Vergrößern', role: 'zoomIn' },
        { label: 'Verkleinern', role: 'zoomOut' },
        { label: 'Normalgröße', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Vollbild', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Hilfe',
      submenu: [
        {
          label: 'Über Elektroplan Suite',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Über Elektroplan Suite',
              message: 'Elektroplan CAE Suite 1.0 (Windows Edition)',
              detail: 'Professionelle Elektroplan-Software mit nativer Kompatibilität für EPLAN Electric P8 (.zw1, .edz, .xml) und normgerechter Schaltungsplanung nach DIN EN 81346 / IEC 60617.'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers for native Windows file operations
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'EPLAN Datei auswählen',
    filters: [
      { name: 'EPLAN & Elektroplan Dateien', extensions: ['zw1', 'edz', 'xml', 'json', 'elk'] },
      { name: 'Alle Dateien', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  if (canceled || filePaths.length === 0) return null;
  const filePath = filePaths[0];
  const data = fs.readFileSync(filePath);
  return {
    path: filePath,
    name: path.basename(filePath),
    buffer: Array.from(data)
  };
});

ipcMain.handle('dialog:saveFile', async (_event, { defaultName, filters, data }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: filters || [{ name: 'Dateien', extensions: ['*'] }]
  });
  if (canceled || !filePath) return false;
  fs.writeFileSync(filePath, Buffer.from(data));
  return true;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
