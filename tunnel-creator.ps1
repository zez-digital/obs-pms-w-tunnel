# create-tunnel.ps1

# Ayarlar
$tunnelName = "tunnel-name"
$hostname = "yourdomain.com"

$cloudflaredPath = ".\cloudflared.exe"

$configDir = "$env:USERPROFILE\.cloudflared"
$configPath = Join-Path $configDir "config.yaml"

# Tunnel oluştur
Write-Host "Tunnel oluşturuluyor..."
$output = & $cloudflaredPath tunnel create $tunnelName 2>&1

# Tunnel ID çek
$tunnelId = ($output | Select-String -Pattern '[a-f0-9\-]{36}').Matches.Value | Select-Object -First 1

if (-not $tunnelId) {
    Write-Host "Tunnel ID alınamadı!"
    Write-Host $output
    exit 1
}

Write-Host "Tunnel oluşturuldu: $tunnelId"

# credentials-file yolu
$credentialsFile = "$configDir\$tunnelId.json"

# Config içeriği
$configContent = @"
tunnel: $tunnelId
credentials-file: $credentialsFile

ingress:
  - hostname: $hostname
    service: http://localhost:3000
  - service: http_status:404
"@

# Config klasörü yoksa oluştur
if (!(Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir | Out-Null
}

# config.yaml yaz
$configContent | Set-Content -Path $configPath -Encoding UTF8

Write-Host "config.yaml oluşturuldu:"
Write-Host $configPath

# Domaini tunnel'a bağla
Write-Host "DNS route oluşturuluyor..."
& $cloudflaredPath tunnel route dns --overwrite-dns $tunnelName $hostname

Write-Host ""
Write-Host "Tamamlandı!"
Write-Host "Başlatmak için:"
Write-Host "$cloudflaredPath tunnel run $tunnelName"