const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const http = require("http");

const isDev = process.env.NODE_ENV === "development";

const FRONTEND_PORT = 3000;
const BACKEND_PORT = 3001;
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;

let mainWindow;
let setupWindow;
let frontendProcess;
let backendProcess;

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";

// ── Config (stored in userData so it survives app updates) ────────────────────

function getConfigPath() {
  return path.join(app.getPath("userData"), "config.json");
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(getConfigPath(), "utf8"));
  } catch {
    return null;
  }
}

function writeConfig(config) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

// ── Resource paths ─────────────────────────────────────────────────────────────

function getResourcePath(...parts) {
  if (isDev) return path.join(__dirname, "..", ...parts);
  return path.join(process.resourcesPath, ...parts);
}

// ── Server helpers ─────────────────────────────────────────────────────────────

function waitForServer(url, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      http
        .get(url, () => resolve())
        .on("error", () => {
          if (Date.now() > deadline)
            reject(new Error(`Server at ${url} did not start in time`));
          else setTimeout(check, 500);
        });
    };
    check();
  });
}

// ELECTRON_RUN_AS_NODE=1 makes the Electron binary behave as plain Node.js
function spawnNode(scriptPath, env) {
  const proc = spawn(process.execPath, [scriptPath], {
    env: { ...process.env, ...env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: "pipe",
  });
  const name = path.basename(scriptPath);
  proc.stdout.on("data", (d) => log.info(`[${name}]`, d.toString().trim()));
  proc.stderr.on("data", (d) => log.warn(`[${name}]`, d.toString().trim()));
  proc.on("exit", (code) => log.info(`[${name}] exited`, code));
  return proc;
}

function isLocalServer(serverIp) {
  return !serverIp || serverIp === "localhost" || serverIp === "127.0.0.1";
}

async function startServers(serverIp) {
  const backendUrl = isLocalServer(serverIp)
    ? `http://localhost:${BACKEND_PORT}`
    : `http://${serverIp}:${BACKEND_PORT}`;

  if (isLocalServer(serverIp)) {
    // This machine IS the server — spawn the backend locally
    log.info("Starting backend locally...");
    backendProcess = spawnNode(getResourcePath("backend", "dist", "main.js"), {
      NODE_ENV: "production",
      PORT: String(BACKEND_PORT),
      DATABASE_URL:
        process.env.DATABASE_URL ||
        "postgresql://postgres:postgres@localhost:5432/tangubcityhardware",
    });
  } else {
    log.info(`Connecting to remote backend at ${backendUrl}`);
  }

  // Always start the frontend locally — it proxies API calls to backendUrl
  log.info("Starting frontend...");
  frontendProcess = spawnNode(getResourcePath("frontend", "server.js"), {
    NODE_ENV: "production",
    PORT: String(FRONTEND_PORT),
    HOSTNAME: "127.0.0.1",
    BACKEND_URL: backendUrl,
  });

  log.info("Waiting for frontend to be ready...");
  await waitForServer(FRONTEND_URL);
  log.info("Frontend ready.");
}

// ── Setup window (first run) ───────────────────────────────────────────────────

function openSetupWindow() {
  return new Promise((resolve) => {
    setupWindow = new BrowserWindow({
      width: 520,
      height: 420,
      resizable: false,
      title: "Tangub City Hardware POS — Setup",
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    setupWindow.loadFile(path.join(__dirname, "setup.html"));

    ipcMain.once("setup-submit", (_event, serverIp) => {
      const config = { serverIp: serverIp || "localhost" };
      writeConfig(config);
      setupWindow.close();
      setupWindow = null;
      resolve(config);
    });

    setupWindow.on("closed", () => {
      // User closed without submitting — quit
      if (!setupWindow) return;
      setupWindow = null;
      app.quit();
    });
  });
}

// ── Main window ────────────────────────────────────────────────────────────────

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: "Tangub City Hardware - POS",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    autoHideMenuBar: true,
    show: false,
  });

  mainWindow.loadURL(FRONTEND_URL);

  if (isDev) mainWindow.webContents.openDevTools();

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (!isDev) autoUpdater.checkForUpdatesAndNotify();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── Receipt printing ──────────────────────────────────────────────────────

ipcMain.handle("get-printers", () => {
  if (!mainWindow) return [];
  const printers = mainWindow.webContents.getPrinters();
  return printers.map((p) => ({ name: p.name, isDefault: p.isDefault }));
});

ipcMain.handle("print-receipt", async (_event, saleData) => {
  return new Promise((resolve, reject) => {
    const printWindow = new BrowserWindow({
      show: false,
      width: 226,
      height: 900,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const templatePath = path.join(__dirname, "receipt.html");
    printWindow.loadFile(templatePath);

    const timeout = setTimeout(() => {
      if (!printWindow.isDestroyed()) printWindow.close();
      reject(new Error("Print timed out"));
    }, 10000);

    printWindow.webContents.on("did-finish-load", () => {
      printWindow.webContents
        .executeJavaScript(`renderReceipt(${JSON.stringify(saleData)})`)
        .then(() =>
          // Measure actual content height so we don't feed blank paper
          printWindow.webContents.executeJavaScript(
            "document.documentElement.scrollHeight"
          )
        )
        .then((contentHeightPx) => {
          // 96 DPI → 1 px ≈ 264.58 µm; add 10 mm bottom buffer for paper cutter
          const heightMicrons =
            Math.ceil(contentHeightPx * 264.58) + 10000;
          setTimeout(() => {
            printWindow.webContents.print(
              {
                silent: true,
                deviceName: saleData.printerName || "",
                printBackground: true,
                margins: { marginType: "none" },
                pageSize: {
                  width: 58000,
                  height: Math.max(heightMicrons, 50000),
                },
              },
              (success, failureReason) => {
                clearTimeout(timeout);
                if (!printWindow.isDestroyed()) printWindow.close();
                if (success) resolve({ success: true });
                else reject(new Error(failureReason || "Print failed"));
              }
            );
          }, 300);
        })
        .catch((err) => {
          clearTimeout(timeout);
          if (!printWindow.isDestroyed()) printWindow.close();
          reject(err);
        });
    });
  });
});

// ── Lifecycle ─────────────────────────────────────────────────────────────────

function killServers() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  if (frontendProcess) {
    frontendProcess.kill();
    frontendProcess = null;
  }
}

app.whenReady().then(async () => {
  // In dev: always show setup window so IP config can be tested
  // In prod: read saved config, show setup only on first run
  let config;
  if (isDev) {
    log.info("Dev mode — skipping server spawn. Config:", config);
    createMainWindow();
    return;
  }

  config = readConfig();
  if (!config) {
    config = await openSetupWindow();
  }

  log.info("Config:", config);

  try {
    await startServers(config.serverIp);
  } catch (err) {
    log.error("Startup failed:", err);
    const { response } = await dialog.showMessageBox({
      type: "error",
      title: "Connection Failed",
      message: `Could not connect to server at "${config.serverIp}".\n\n${err.message}`,
      buttons: ["Change Server IP", "Quit"],
    });
    if (response === 0) {
      // Clear config so setup runs again on next launch
      try {
        fs.unlinkSync(getConfigPath());
      } catch {}
    }
    app.quit();
    return;
  }

  createMainWindow();
});

app.on("before-quit", killServers);

app.on("window-all-closed", () => {
  killServers();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createMainWindow();
});

// ── Auto-updater ──────────────────────────────────────────────────────────────

autoUpdater.on("update-available", (info) => {
  log.info("Update available:", info.version);
  dialog.showMessageBox({
    type: "info",
    title: "Update Available",
    message: `Version ${info.version} will download in the background.`,
    buttons: ["OK"],
  });
});

autoUpdater.on("update-downloaded", (info) => {
  log.info("Update downloaded:", info.version);
  dialog
    .showMessageBox({
      type: "info",
      title: "Update Ready",
      message: `Version ${info.version} is ready. The app will restart to install it.`,
      buttons: ["Restart Now", "Later"],
    })
    .then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
});

autoUpdater.on("error", (err) => log.error("Updater error:", err));
