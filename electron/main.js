const { app, BrowserWindow, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const isDev = process.env.NODE_ENV === 'development';

const FRONTEND_PORT = 3000;
const BACKEND_PORT = 3001;
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;

let mainWindow;
let frontendProcess;
let backendProcess;

// Configure logger
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...');

// In production, resources are at process.resourcesPath
// In dev, we point to the monorepo root
function getResourcePath(...parts) {
  if (isDev) {
    return path.join(__dirname, '..', ...parts);
  }
  return path.join(process.resourcesPath, ...parts);
}

// Poll until the server responds or timeout
function waitForServer(url, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      http.get(url, () => resolve())
        .on('error', () => {
          if (Date.now() > deadline) {
            reject(new Error(`Server at ${url} did not start in time`));
          } else {
            setTimeout(check, 500);
          }
        });
    };
    check();
  });
}

// ELECTRON_RUN_AS_NODE=1 makes the Electron binary run as plain Node.js
function spawnNode(scriptPath, env) {
  const proc = spawn(process.execPath, [scriptPath], {
    env: { ...process.env, ...env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'pipe',
  });
  proc.stdout.on('data', (d) => log.info(`[${path.basename(scriptPath)}]`, d.toString().trim()));
  proc.stderr.on('data', (d) => log.warn(`[${path.basename(scriptPath)}]`, d.toString().trim()));
  proc.on('exit', (code) => log.info(`[${path.basename(scriptPath)}] exited`, code));
  return proc;
}

async function startServers() {
  // Start NestJS backend
  backendProcess = spawnNode(
    getResourcePath('backend', 'dist', 'main.js'),
    {
      NODE_ENV: 'production',
      PORT: String(BACKEND_PORT),
      DATABASE_URL:
        process.env.DATABASE_URL ||
        'postgresql://postgres:postgres@localhost:5432/tangubcityhardware',
    }
  );

  // Start Next.js standalone frontend
  frontendProcess = spawnNode(
    getResourcePath('frontend', 'server.js'),
    {
      NODE_ENV: 'production',
      PORT: String(FRONTEND_PORT),
      HOSTNAME: '127.0.0.1',
      NEXT_PUBLIC_API_URL: `http://localhost:${BACKEND_PORT}/api`,
    }
  );

  // Wait for frontend to be ready before showing the window
  log.info('Waiting for frontend server...');
  await waitForServer(FRONTEND_URL);
  log.info('Frontend ready.');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'Tangub City Hardware - POS',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
    show: false,
  });

  mainWindow.loadURL(FRONTEND_URL);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (!isDev) {
      autoUpdater.checkForUpdatesAndNotify();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function killServers() {
  if (backendProcess) { backendProcess.kill(); backendProcess = null; }
  if (frontendProcess) { frontendProcess.kill(); frontendProcess = null; }
}

app.whenReady().then(async () => {
  if (!isDev) {
    try {
      await startServers();
    } catch (err) {
      log.error('Server startup failed:', err);
      dialog.showErrorBox(
        'Startup Error',
        `Could not start the application servers.\n\n${err.message}\n\nMake sure PostgreSQL is running.`
      );
      app.quit();
      return;
    }
  }
  createWindow();
});

app.on('before-quit', killServers);

app.on('window-all-closed', () => {
  killServers();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

// ── Auto-updater events ──────────────────────────────────────────────────────

autoUpdater.on('checking-for-update', () => log.info('Checking for update...'));
autoUpdater.on('update-available', (info) => {
  log.info('Update available:', info.version);
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: `Version ${info.version} is available and will download in the background.`,
    buttons: ['OK'],
  });
});
autoUpdater.on('update-not-available', () => log.info('No update available.'));
autoUpdater.on('error', (err) => log.error('Auto-updater error:', err));
autoUpdater.on('download-progress', (p) =>
  log.info(`Download: ${Math.round(p.percent)}%`)
);
autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded:', info.version);
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: `Version ${info.version} is ready to install. The app will restart.`,
    buttons: ['Restart Now', 'Later'],
  }).then(({ response }) => {
    if (response === 0) autoUpdater.quitAndInstall();
  });
});
