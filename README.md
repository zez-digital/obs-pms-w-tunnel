# OBS Presentation Management System with Tunnel (OBS-PMS-W-Tunnel)

![Version](https://img.shields.io/badge/version-2.0.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node.js](https://img.shields.io/badge/node.js-%3E%3D22-brightgreen)

## 📝 Proje Özeti
Bu proje; **Open Broadcaster Software (OBS)** tabanlı sunum süreçlerini fiziksel kablolama ve yerel ağ (LAN) bağımlılığından kurtaran, taşınabilir ve yüksek güvenlikli bir altyapı çözümüdür. 

Temel amacı, kurumsal ağlarda (Eduroam vb.) uygulanan cihaz izolasyonu ve katı firewall kurallarını aşarak, mobil cihazlar üzerinden gerçek zamanlı reji kontrolü sağlamaktır.

---

## 📦 Kurulum ve Çalıştırma

### Gereksinimler
- **Node.js** (v22+)
- **OBS Studio** (WebSocket eklentisi aktif olmalıdır)
- **Cloudflare cloudflared CLI** (Tünel otomasyonu için sistem yoluna eklenmiş olmalıdır)

### Adımlar
1. Projeyi klonlayın:
   ```bash
   git clone https://github.com/muozez/obs-pms-w-tunnel.git
   cd obs-pms-w-tunnel
   ```
2. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```
3. Uygulamayı başlatın:
   ```bash
   npm start
   ```
4. **Paketlenmiş Sürüm (EXE):**
   Taşınabilir bir executable oluşturmak isterseniz:
   ```bash
   npm run package
   ```

---

## 🛠 Problem ve Teknik Kısıtlamalar

Geniş çaplı etkinliklerde (EMSAZ vb.), sunum yapan kişi ile reji bilgisayarı arasındaki fiziksel mesafe büyük bir operasyonel darboğaz oluşturur. Geleneksel uzaktan kontrol mekanizmaları ise aşağıdaki engellere takılmaktadır:

- **AP İzolasyonu (Client Isolation):** Aynı ağdaki cihazların (mobil cihaz ve PC) birbirini görmesinin engellenmesi.
- **Kurumsal Firewall:** Inbound (gelen) bağlantıların kapalı olması nedeniyle port yönlendirmenin imkansızlığı.
- **Fiziksel Bağımlılık:** Teknik müdahale için bir personelin sürekli bilgisayar başında bulunma zorunluluğu.

---

## 🌐 Eduroam / AP Isolation ve Inbound-Zero Çözümümüz

Projemiz, Eduroam hiyerarşisindeki RADIUS federasyonu ve izole VLAN yapılarını fiziksel katmanda değil, **mantıksal katmanda (Layer 7)** bypass eder.

### Inbound-Zero Yaklaşımı
Trafik, yerel ağda yatay (**East-West**) ilerleyip izolasyon kurallarına takılmak yerine, güvenli bir Cloudflare tüneli aracılığıyla doğrudan dış dünyaya (**North-South**) çıkar. Kontrol paneli ve sunucu, trafiği yerel switchler yerine bulut tabanlı bir **Edge** noktasında birleştirir. Böylece yerel ağdaki kısıtlamalar teknik olarak anlamsızlaşır.

- **Düşük Gecikme:** Eski VPN çözümlerindeki DPI paket denetimi gecikmeleri ortadan kalkar.
- **Zero-Trust:** İçeriye port açılmadığı için saldırı yüzeyi minimize edilir.

---

## 🏗 Mimari Yapı

Sistem üç ana katmandan oluşmaktadır:

1. **Lokal Sunucu (Electron/Node.js):** OBS-WebSocket üzerinden ana motorla haberleşir.
2. **Cloudflare Tunnel Entegrasyonu:** Outbound HTTPS trafiği üzerinden global Anycast ağına bağlantı.
3. **IaC Otomasyonu:** PowerShell betiği (`tunnel-creator.ps1`) ile tünel provizyonlama ve DNS rotalamasının saniyeler içinde yapılması.

### Teknik Akış (Scene Switching Flow)
Operatörden gelen komutlar Cloudflare üzerinden Express.js sunucusuna akar ve OBS motoruna iletilir. İstemci, asenkron bir döngü ile saniyede bir güncel OBS durumunu çeker (**State Polling**).

```javascript
// Express.js - OBS Sahne Kontrol Mantığı
app.get('/control/:action', async (req, res) => {
    const { action } = req.params;
    try {
        const data = await obs.call('GetSceneList');
        let scenes = data.scenes.map(s => s.sceneName);
        let idx = scenes.indexOf(data.currentProgramSceneName);

        if (action === 'next') {
            await obs.call('SetCurrentProgramScene', {
                sceneName: scenes[(idx + 1) % scenes.length]
            });
        }
        res.json({ status: 'ok' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
```

---

## 📊 Kazanımlar ve Sonuçlar

| Kriter | Önceki Yöntem (VPN) | Yeni Nesil (Tunnel) |
| :--- | :--- | :--- |
| **Dağıtım Hızı** | 10 Dakika | 30 Saniye |
| **Gecikme** | Yüksek (DPI) | Çok Düşük (Anycast) |
| **Güvenlik** | Riskli (Port/Sertifika) | Güvenli (Zero-Trust) |
| **Ağ Uyumluluğu** | Sınırlı | Sınırsız (L7) |

---

## 🛡 Lisans
Bu proje **MIT** lisansı altında sunulmaktadır.

**Geliştiren:** [muozez](https://github.com/muozez)
