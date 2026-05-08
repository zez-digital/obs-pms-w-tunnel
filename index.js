import { OBSWebSocket } from 'obs-websocket-js';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';
import log from 'electron-log/node.js';

// HTML dosyalarını string olarak al
const isPkg = typeof process.pkg !== 'undefined';

// Güvenli rootPath tespiti (ESM/CJS uyumlu)
let rootPath;
if (isPkg) {
    rootPath = join(__dirname, '..');
} else {
    try {
        rootPath = dirname(fileURLToPath(import.meta.url));
    } catch (e) {
        rootPath = __dirname;
    }
}

const CONFIG_PATH = join(os.homedir(), '.obs-pms-remote-config.json');

// HTML dosyalarını oku (Çoklu konum desteği)
function loadHtmlFile(filename) {
    const searchPaths = [
        join(rootPath, filename),                  // Snapshot root
        join(__dirname, filename),                 // Snapshot dist
        join(process.cwd(), filename),             // Mevcut dizin
        join(dirname(process.execPath), filename)  // EXE'nin yanı
    ];

    for (const p of searchPaths) {
        try {
            if (fs.existsSync(p)) {
                log.info(`${filename} bulundu: ${p}`);
                return fs.readFileSync(p, 'utf8');
            }
        } catch (e) {}
    }
    log.error(`${filename} hiçbir yerde bulunamadı!`);
    return `<h1>Hata: ${filename} bulunamadı</h1>`;
}

let indexHtml = loadHtmlFile('index.html');
let settingsHtml = loadHtmlFile('settings.html');

log.info('Uygulama başlatılıyor...');
log.info(`Çalışma Modu: ${isPkg ? 'Paketli (EXE)' : 'Geliştirme'}`);

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const obs = new OBSWebSocket();
let isConnected = false;
let config = { host: '127.0.0.1', port: '4455', password: '', apiKey: '' };

if (fs.existsSync(CONFIG_PATH)) {
    try {
        config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        log.info('Config yüklendi.');
    } catch (e) {
        log.error('Config okuma hatası:', e);
    }
}

let SPEAKER_NAME = 'Desktop Audio'; 
const REVERSE_LIST = true; 

async function connectToObs() {
    if (!config.host || !config.port) return;
    const address = `ws://${config.host}:${config.port}`;
    try {
        await obs.connect(address, config.password);
        log.info('✅ OBS Bağlantısı Aktif:', address);
        isConnected = true;
        const inputs = await obs.call('GetInputList');
        const desktopAudio = inputs.inputs.find(i => 
            i.inputName.toLowerCase().includes('desktop') || 
            i.inputName.toLowerCase().includes('masaüstü') ||
            i.inputKind === 'wasapi_output_capture'
        );
        if(desktopAudio) SPEAKER_NAME = desktopAudio.inputName;
    } catch (error) {
        log.warn('❌ OBS Bağlantı Hatası:', error.message);
        isConnected = false;
        setTimeout(connectToObs, 5000);
    }
}

async function getObsState() {
    if (!isConnected) return { error: 'OBS Bağlantısı Yok' };
    try {
        const sceneList = await obs.call('GetSceneList');
        const muteStatus = await obs.call('GetInputMute', { inputName: SPEAKER_NAME }).catch(() => ({ inputMuted: false }));
        let scenes = sceneList.scenes.map(s => s.sceneName);
        if (REVERSE_LIST) scenes = scenes.reverse();
        const current = sceneList.currentProgramSceneName;
        const currentIndex = scenes.indexOf(current);
        return {
            current,
            next: scenes[currentIndex + 1] || "SON",
            index: currentIndex + 1,
            total: scenes.length,
            isMuted: muteStatus.inputMuted,
            allScenes: scenes
        };
    } catch (err) { 
        isConnected = false;
        return { error: err.message }; 
    }
}

app.get('/', (req, res) => {
    if (!isConnected && !fs.existsSync(CONFIG_PATH)) {
        return res.send(settingsHtml);
    }
    res.send(indexHtml);
});

app.get('/settings', (req, res) => res.send(settingsHtml));
app.get('/api/config', (req, res) => res.json(config));
app.get('/api/state', async (req, res) => res.json(await getObsState()));

app.post('/api/config', async (req, res) => {
    const newConfig = req.body;
    try {
        if (newConfig.host && newConfig.port) {
            const testObs = new OBSWebSocket();
            await testObs.connect(`ws://${newConfig.host}:${newConfig.port}`, newConfig.password);
            await testObs.disconnect();
        }
        config = { ...config, ...newConfig };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        if (config.host && config.port) await connectToObs();
        res.json({ status: 'ok' });
    } catch (e) {
        res.status(400).json({ status: 'error', message: e.message });
    }
});

app.get('/control/:action', async (req, res) => {
    if (!isConnected) return res.status(503).json({ error: 'OBS Bağlantısı Yok' });
    const { action } = req.params;
    const { name } = req.query;
    try {
        const data = await obs.call('GetSceneList');
        let scenes = data.scenes.map(s => s.sceneName);
        if (REVERSE_LIST) scenes = scenes.reverse();
        let idx = scenes.indexOf(data.currentProgramSceneName);
        if (action === 'next') {
            await obs.call('SetCurrentProgramScene', { sceneName: scenes[(idx + 1) % scenes.length] });
        } else if (action === 'prev') {
            await obs.call('SetCurrentProgramScene', { sceneName: scenes[(idx - 1 + scenes.length) % scenes.length] });
        } else if (action === 'set') {
            await obs.call('SetCurrentProgramScene', { sceneName: name });
        } else if (action === 'mute') {
            const { inputMuted } = await obs.call('GetInputMute', { inputName: SPEAKER_NAME });
            await obs.call('SetInputMute', { inputName: SPEAKER_NAME, inputMuted: !inputMuted });
        }
        res.json({ status: 'ok' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

connectToObs();
const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
    log.info(`🚀 Sunucu Hazır: http://localhost:${PORT}`);
    if (process.platform === 'win32') {
        exec(`start http://localhost:${PORT}`);
    }
}).on('error', (err) => {
    log.error('Sunucu hatası:', err);
});
