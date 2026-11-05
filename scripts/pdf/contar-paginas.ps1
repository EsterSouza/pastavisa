<#
  Conta as páginas dos PDFs de uma cliente e guarda no histórico.

  Lê a pasta "PDF" da cliente (a que o "Gerar PDFs (Word)" preenche) e grava, na
  pasta que reúne as clientes (ex.: "Pasta Personalizada"), dois arquivos:
    Páginas por pasta.csv      uma linha por cliente: data, versão, documentos, páginas
    Páginas por documento.csv  uma linha por documento de cada cliente
  Rodar de novo para a mesma cliente substitui as linhas dela, não duplica.

  O "Gerar PDFs (Word)" chama este script no fim. Para contar uma pasta já pronta:
    powershell -ExecutionPolicy Bypass -File contar-paginas.ps1 -Pasta "<pasta da cliente>"
#>
param(
  [Parameter(Mandatory = $true)][string]$Pasta,
  # Onde ficam os dois CSVs. Padrão: a pasta acima da cliente.
  [string]$Historico
)

$ErrorActionPreference = "Stop"

function Longo([string]$caminho) {
  if ($caminho.StartsWith('\\?\')) { return $caminho }
  return '\\?\' + $caminho
}

# Cada página do PDF é um objeto "/Type /Page"; "/Pages" é o índice e não conta.
function Contar-Paginas([string]$arquivo) {
  $texto = [Text.Encoding]::GetEncoding(28591).GetString([IO.File]::ReadAllBytes((Longo $arquivo)))
  return ([regex]::Matches($texto, '/Type\s*/Page(?![a-zA-Z])')).Count
}

# "Versão da pasta" do planejamento ("Documentos em elaboração"), como o app lê
# em lib/elaboracao-prazos.ts. Diz se a pasta é digital, preto e branco ou colorida.
function Ler-Versao($cliente) {
  $docx = Get-ChildItem -LiteralPath $cliente.FullName -Filter "Documentos em elabora*.docx" -File |
    Where-Object { -not $_.Name.StartsWith('~$') } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $docx) { return "" }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  try {
    $zip = [IO.Compression.ZipFile]::OpenRead((Longo $docx.FullName))
    try {
      $leitor = New-Object IO.StreamReader($zip.GetEntry("word/document.xml").Open(), [Text.Encoding]::UTF8)
      $xml = $leitor.ReadToEnd()
      $leitor.Close()
    } finally { $zip.Dispose() }
  } catch { return "" }
  $texto = [regex]::Replace(($xml -replace '</w:p>', "`n"), '<[^>]+>', '')
  $texto = [Net.WebUtility]::HtmlDecode($texto)
  foreach ($linha in $texto -split "`n|•|▪") {
    if ($linha.Trim() -match '^vers[ãa]o da pasta[^:]{0,40}:\s*(.+)$') { return ($Matches[1].Trim() -replace '[.;]+$', '') }
  }
  return ""
}

function Gravar([string]$csv, [string]$cliente, $novas) {
  $linhas = @()
  if (Test-Path -LiteralPath $csv) {
    $linhas = @(Import-Csv -LiteralPath $csv -Delimiter ';' -Encoding UTF8 | Where-Object { $_.Cliente -ne $cliente })
  }
  # Ponto e vírgula para o Excel em português abrir em colunas.
  @($linhas) + @($novas) | Export-Csv -LiteralPath $csv -NoTypeInformation -Delimiter ';' -Encoding UTF8
}

$item = Get-Item -LiteralPath $Pasta
# Aceita a pasta da cliente ou a própria pasta "PDF".
if ($item.Name -match '^(pdfs?|em pdf)$') { $cliente = $item.Parent; $pdfs = $item }
else {
  $cliente = $item
  $pdfs = Get-ChildItem -LiteralPath $item.FullName -Directory | Where-Object { $_.Name -match '^(pdfs?|em pdf)$' } | Select-Object -First 1
}
if (-not $pdfs) {
  Write-Host "Não achei a pasta ""PDF"" dentro de: $($cliente.FullName)" -ForegroundColor Red
  exit 1
}
if (-not $Historico) { $Historico = $cliente.Parent.FullName }

$documentos = @()
$falhas = @()
foreach ($a in Get-ChildItem -LiteralPath $pdfs.FullName -Filter *.pdf -File | Sort-Object Name) {
  try {
    $documentos += [pscustomobject]@{ Data = $a.LastWriteTime.ToString('dd/MM/yyyy'); Cliente = $cliente.Name; Documento = $a.BaseName; Paginas = (Contar-Paginas $a.FullName) }
  } catch {
    $falhas += $a.Name
  }
}

if ($falhas.Count -gt 0) {
  Write-Host "Não consegui ler $($falhas.Count) PDF(s); o histórico não foi alterado:" -ForegroundColor Red
  $falhas | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  Write-Host "Se estiverem só na nuvem do OneDrive, marque a pasta como ""Sempre manter neste dispositivo"" e rode de novo."
  exit 2
}

$total = ($documentos | Measure-Object Paginas -Sum).Sum
# Data da pasta: a do PDF mais recente, que é quando ela ficou pronta.
$data = ($documentos | Sort-Object { [datetime]::ParseExact($_.Data, 'dd/MM/yyyy', $null) } | Select-Object -Last 1).Data
Gravar (Join-Path $Historico "Páginas por documento.csv") $cliente.Name $documentos
Gravar (Join-Path $Historico "Páginas por pasta.csv") $cliente.Name ([pscustomobject]@{
  Data = $data; Cliente = $cliente.Name; Versao = (Ler-Versao $cliente); Documentos = $documentos.Count; Paginas = $total
})

Write-Host "$($cliente.Name): $total páginas em $($documentos.Count) PDF(s). Guardado em ""Páginas por pasta.csv""." -ForegroundColor Cyan
exit 0
