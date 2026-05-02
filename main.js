import { app, BrowserWindow, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import log from 'electron-log';

// Logger yapılandırması
log.transports.file.level = 'info';
log.info('Uygulama başlatılıyor...');

// index.js'i import ederek Express sunucusunu başlatıyoruz
// Not: Hata durumunda yakalamak için importu fonksiyon içine alabiliriz
// Ama şimdilik en üstte kalsın, hata yakalamayı aşağıda yapacağız.

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow;

function createWindow() {
  try {
    mainWindow = new BrowserWindow({
      width: 500,
      height: 750,
      minWidth: 400,
      minHeight: 600,
      title: 'OBS Remote Control',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
      backgroundColor: '#09090b'
    });

    log.info('Pencere oluşturuldu.');

    // Sunucunun ayağa kalkması için küçük bir bekleme
    setTimeout(() => {
      mainWindow.loadURL('http://localhost:3000').catch(err => {
        log.error('URL yüklenemedi:', err);
        dialog.showErrorBox('Sunucu Hatası', 'Yerel sunucuya bağlanılamadı (Port 3000). Lütfen portun boş olduğundan emin olun.');
      });
    }, 1500);

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  } catch (err) {
    log.error('createWindow hatası:', err);
  }
}

// Global hata yakalama
process.on('uncaughtException', (error) => {
  log.error('Beklenmeyen Hata (Uncaught):', error);
  dialog.showErrorBox('Kritik Hata', error.message || 'Bilinmeyen bir hata oluştu.');
  app.quit();
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Beklenmeyen Reddedilme (Unhandled Rejection):', reason);
});

app.whenReady().then(async () => {
  try {
    log.info('App ready, sunucu başlatılıyor...');
    await import('./index.js');
    createWindow();
  } catch (err) {
    log.error('Başlatma hatası:', err);
    dialog.showErrorBox('Başlatma Hatası', err.message);
    app.quit();
  }
});

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
