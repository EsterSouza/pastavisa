<#
  Gera os PDFs de uma cliente com o próprio Word: cada .docx da pasta "Editáveis"
  vira um PDF com o mesmo nome na pasta "PDF" ao lado. É o mesmo "Salvar como PDF"
  do Word, só que para a pasta inteira.

  Não altera nada na "Editáveis". Na "PDF", só cria ou substitui os PDFs.
  Um PDF mais novo que o .docx não é refeito (use -Forcar para refazer todos).

  Uso: botão direito na pasta da cliente > "Gerar PDFs (Word)".
  Ou:  powershell -ExecutionPolicy Bypass -File gerar-pdfs.ps1 -Pasta "<pasta da cliente>"
#>
param(
  [Parameter(Mandatory = $true)][string]$Pasta,
  # Outra pasta de saída, para testar sem mexer na "PDF" da cliente.
  [string]$Destino,
  [switch]$Forcar,
  [switch]$SemPausa
)

$ErrorActionPreference = "Stop"

# Um documento que leve mais que isso para virar PDF é considerado travado.
$LIMITE_POR_DOCUMENTO_SEGUNDOS = 180

# Nome comprido dentro da pasta do OneDrive passa dos 260 caracteres do Windows;
# com este prefixo o caminho vale mesmo assim.
function Longo([string]$caminho) {
  if ($caminho.StartsWith('\\?\')) { return $caminho }
  return '\\?\' + $caminho
}

function Fim([int]$codigo) {
  if (-not $SemPausa) {
    Write-Host ""
    Read-Host "Pressione Enter para fechar" | Out-Null
  }
  exit $codigo
}

function Achar-Editaveis([string]$raiz) {
  $item = Get-Item -LiteralPath $raiz
  if ($item.Name -match '^edit.veis$') { return @($item) }
  return @(Get-ChildItem -LiteralPath $raiz -Directory -Recurse -Depth 2 |
    Where-Object { $_.Name -match '^edit.veis$' })
}

if (-not (Test-Path -LiteralPath $Pasta -PathType Container)) {
  Write-Host "A pasta não existe: $Pasta" -ForegroundColor Red
  Fim 1
}

$editaveis = Achar-Editaveis $Pasta
if ($editaveis.Count -eq 0) {
  Write-Host "Não achei a pasta ""Editáveis"" dentro de: $Pasta" -ForegroundColor Red
  Fim 1
}
if ($editaveis.Count -gt 1) {
  Write-Host "Achei mais de uma pasta ""Editáveis"". Clique direto na que deve ser convertida:" -ForegroundColor Red
  $editaveis | ForEach-Object { Write-Host "  $($_.FullName)" }
  Fim 1
}
$editaveis = $editaveis[0]

if ($Destino) {
  $saida = $Destino
} else {
  $existente = Get-ChildItem -LiteralPath $editaveis.Parent.FullName -Directory |
    Where-Object { $_.Name -match '^pdfs?$' } | Select-Object -First 1
  $saida = if ($existente) { $existente.FullName } else { Join-Path $editaveis.Parent.FullName "PDF" }
}
if (-not (Test-Path -LiteralPath $saida)) { New-Item -ItemType Directory -Path $saida | Out-Null }

$arquivos = @(Get-ChildItem -LiteralPath $editaveis.FullName -File |
  Where-Object { $_.Extension -match '^\.(docx|docm|doc)$' -and -not $_.Name.StartsWith('~$') } |
  Sort-Object Name)

Write-Host "Editáveis: $($editaveis.FullName)"
Write-Host "PDFs em:   $saida"
Write-Host "$($arquivos.Count) documento(s)"
Write-Host ""

$fila = @()
$pulados = 0
foreach ($arquivo in $arquivos) {
  $pdf = Join-Path $saida ([IO.Path]::GetFileNameWithoutExtension($arquivo.Name) + ".pdf")
  if (-not $Forcar -and (Test-Path -LiteralPath (Longo $pdf)) -and
      (Get-Item -LiteralPath (Longo $pdf)).LastWriteTime -ge $arquivo.LastWriteTime) {
    Write-Host "$($arquivo.Name) - já estava em dia" -ForegroundColor DarkGray
    $pulados++
  } else {
    $fila += [pscustomobject]@{ Origem = $arquivo.FullName; Nome = $arquivo.Name; Pdf = $pdf }
  }
}

$convertidos = 0
$falhas = @()

if ($fila.Count -gt 0) {
  # O Word trava no "Salvar como PDF" quando é chamado direto deste PowerShell,
  # e funciona quando chamado de um job; por isso a conversão roda num job.
  # Também não deixamos o Word abrir nem salvar na pasta do OneDrive (ele tenta
  # gravar na nuvem por conta própria e trava): trabalha numa cópia local e o PDF
  # pronto é movido para lá, e o OneDrive sincroniza.
  $converter = {
    param($fila)
    $ErrorActionPreference = "Stop"
    function Longo([string]$caminho) { if ($caminho.StartsWith('\\?\')) { $caminho } else { '\\?\' + $caminho } }
    $temporaria = Join-Path $env:TEMP ("pastavisa-pdf-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $temporaria | Out-Null
    $word = $null
    try {
      $word = New-Object -ComObject Word.Application
      $word.Visible = $false
      $word.DisplayAlerts = 0          # wdAlertsNone
      $word.AutomationSecurity = 3     # macros desligadas nos documentos abertos aqui
      foreach ($item in $fila) {
        # Texto puro: o PSObject que o Join-Path devolve faz o Word girar sem fim no SaveAs2.
        [string]$copia = Join-Path $temporaria $item.Nome
        [string]$pdfLocal = Join-Path $temporaria ([IO.Path]::GetFileNameWithoutExtension($item.Nome) + ".pdf")
        $doc = $null
        try {
          [IO.File]::Copy((Longo $item.Origem), $copia, $true)
          # Open(FileName, ConfirmConversions, ReadOnly, AddToRecentFiles)
          $doc = $word.Documents.Open($copia, $false, $true, $false)
          $doc.SaveAs2($pdfLocal, 17)  # 17 = wdFormatPDF, o "Salvar como PDF"
          $doc.Close([ref]0)           # wdDoNotSaveChanges
          $doc = $null
          [IO.File]::Copy($pdfLocal, (Longo $item.Pdf), $true)
          [pscustomobject]@{ Nome = $item.Nome; Ok = $true; Motivo = "" }
        } catch {
          [pscustomobject]@{ Nome = $item.Nome; Ok = $false; Motivo = $_.Exception.Message }
        } finally {
          if ($doc) { try { $doc.Close([ref]0) } catch {} }
          Remove-Item -LiteralPath $copia, $pdfLocal -Force -ErrorAction SilentlyContinue
        }
      }
    } finally {
      if ($word) { try { $word.Quit([ref]0) } catch {} }
      Remove-Item -LiteralPath $temporaria -Recurse -Force -ErrorAction SilentlyContinue
    }
  }

  # Para encerrar só o Word deste script se ele travar, nunca o que já estava aberto.
  $wordsAntes = @(Get-Process WINWORD -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
  $job = Start-Job -ScriptBlock $converter -ArgumentList (, $fila)
  $feitos = 0
  $ultimoAvanco = Get-Date
  $travou = $false

  while ($true) {
    # Olha o estado antes de ler, para não perder o que chegou no fim.
    $rodando = $job.State -in @("NotStarted", "Running")
    foreach ($r in @(Receive-Job $job 2>$null)) {
      $feitos++
      $ultimoAvanco = Get-Date
      $rotulo = "[$feitos/$($fila.Count)] $($r.Nome)"
      if ($r.Ok) {
        Write-Host "$rotulo - ok" -ForegroundColor Green
        $convertidos++
      } else {
        $motivo = $r.Motivo
        if ($motivo -match 'used by another process|being used|em uso') {
          $motivo = "o PDF está aberto em outro programa; feche e rode de novo"
        }
        Write-Host "$rotulo - ERRO: $motivo" -ForegroundColor Red
        $falhas += "$($r.Nome): $motivo"
      }
    }
    if (-not $rodando) { break }
    if (((Get-Date) - $ultimoAvanco).TotalSeconds -gt $LIMITE_POR_DOCUMENTO_SEGUNDOS) {
      $travou = $true
      break
    }
    Start-Sleep -Milliseconds 500
  }

  if ($job.State -eq "Failed") {
    Write-Host "Não consegui usar o Word: $($job.ChildJobs[0].JobStateInfo.Reason.Message)" -ForegroundColor Red
  }
  if ($travou) {
    $proximo = $fila[$feitos].Nome
    Write-Host "O Word parou de responder em ""$proximo"" e foi fechado." -ForegroundColor Red
    $falhas += "$($proximo): o Word parou de responder"
    Stop-Job $job
    Get-Process WINWORD -ErrorAction SilentlyContinue |
      Where-Object { $wordsAntes -notcontains $_.Id } |
      Stop-Process -Force -ErrorAction SilentlyContinue
  }
  Remove-Job $job -Force
}

Write-Host ""
Write-Host "$convertidos convertido(s), $pulados já em dia, $($falhas.Count) com problema." -ForegroundColor Cyan
if ($falhas.Count -gt 0 -or $convertidos + $pulados -lt $arquivos.Count) {
  if ($falhas.Count -gt 0) {
    Write-Host "Com problema:" -ForegroundColor Red
    $falhas | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  }
  Fim 2
}
Fim 0
