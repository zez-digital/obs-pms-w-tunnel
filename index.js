import { OBSWebSocket } from 'obs-websocket-js';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());

const obs = new OBSWebSocket();
const OBS_ADDRESS = 'ws://127.0.0.1:4455';

let SPEAKER_NAME = 'Desktop Audio'; 

// --- KRİTİK AYAR: Sahneleri 1, 2, 3, 4, 5 yapmak için TRUE yaptık ---
const REVERSE_LIST = true; 

async function connectToObs() {
    try {
        await obs.connect(OBS_ADDRESS);
        console.log('✅ OBS Bağlantısı Aktif');
        const inputs = await obs.call('GetInputList');
        const desktopAudio = inputs.inputs.find(i => 
            i.inputName.toLowerCase().includes('desktop') || 
            i.inputName.toLowerCase().includes('masaüstü') ||
            i.inputKind === 'wasapi_output_capture'
        );
        if(desktopAudio) SPEAKER_NAME = desktopAudio.inputName;
    } catch (error) {
        setTimeout(connectToObs, 5000);
    }
}

async function getObsState() {
    try {
        const sceneList = await obs.call('GetSceneList');
        const muteStatus = await obs.call('GetInputMute', { inputName: SPEAKER_NAME }).catch(() => ({ inputMuted: false }));
        
        // Sahneleri al ve senin istediğin düzene sok
        let scenes = sceneList.scenes.map(s => s.sceneName);
        if (REVERSE_LIST) scenes = scenes.reverse();

        const current = sceneList.currentProgramSceneName;
        const currentIndex = scenes.indexOf(current);
        
        const nextScene = scenes[currentIndex + 1] || "SON";

        return {
            current,
            next: nextScene,
            index: currentIndex + 1,
            total: scenes.length,
            isMuted: muteStatus.inputMuted,
            allScenes: scenes
        };
    } catch (err) { return { error: err.message }; }
}

app.get('/', (req, res) => res.sendFile(join(__dirname, 'index.html')));
app.get('/api/state', async (req, res) => res.json(await getObsState()));

app.get('/control/:action', async (req, res) => {
    const { action } = req.params;
    const { name } = req.query;

    try {
        const data = await obs.call('GetSceneList');
        let scenes = data.scenes.map(s => s.sceneName);
        if (REVERSE_LIST) scenes = scenes.reverse();
        
        let idx = scenes.indexOf(data.currentProgramSceneName);

        if (action === 'next') {
            // İleri butonu şimdi listede sağa/aşağı doğru gidecek (1->2->3)
            let newIdx = (idx + 1) % scenes.length;
            await obs.call('SetCurrentProgramScene', { sceneName: scenes[newIdx] });
        } else if (action === 'prev') {
            // Geri butonu sola/yukarı gidecek
            let newIdx = (idx - 1 + scenes.length) % scenes.length;
            await obs.call('SetCurrentProgramScene', { sceneName: scenes[newIdx] });
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
app.listen(3000, '0.0.0.0', () => console.log('🚀 Dock Panel: http://localhost:3000'));
