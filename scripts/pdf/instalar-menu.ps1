<#
  Põe "Gerar PDFs (Word)" no botão direito das pastas (só para este usuário do
  Windows). No Windows 11 a opção fica em "Mostrar mais opções".

  Instalar: powershell -ExecutionPolicy Bypass -File instalar-menu.ps1
  Remover:  powershell -ExecutionPolicy Bypass -File instalar-menu.ps1 -Remover
#>
param([switch]$Remover)

$ErrorActionPreference = "Stop"

$script = Join-Path $PSScriptRoot "gerar-pdfs.ps1"
# Na pasta (botão direito sobre ela) e dentro dela (botão direito no espaço vazio).
$chaves = @(
  "HKCU:\Software\Classes\Directory\shell\PastaVISA.GerarPDFs",
  "HKCU:\Software\Classes\Directory\Background\shell\PastaVISA.GerarPDFs"
)

if ($Remover) {
  foreach ($chave in $chaves) {
    if (Test-Path $chave) { Remove-Item $chave -Recurse -Force }
  }
  Write-Host "Opção ""Gerar PDFs (Word)"" removida do botão direito."
  exit 0
}

if (-not (Test-Path $script)) { throw "Não achei o script: $script" }

$word = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\Winword.exe" -ErrorAction SilentlyContinue).'(default)'
$comando = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$script`" -Pasta `"%V`""

foreach ($chave in $chaves) {
  New-Item -Path "$chave\command" -Force | Out-Null
  Set-ItemProperty -Path $chave -Name "(default)" -Value "Gerar PDFs (Word)"
  if ($word) { Set-ItemProperty -Path $chave -Name "Icon" -Value "`"$word`",0" }
  Set-ItemProperty -Path "$chave\command" -Name "(default)" -Value $comando
}

Write-Host "Pronto: botão direito na pasta da cliente > ""Gerar PDFs (Word)""."
Write-Host "No Windows 11 a opção fica em ""Mostrar mais opções""."
