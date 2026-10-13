// Prazos do cabeçalho do planejamento, na regra da Ester (23/09/2026): contar 15 dias
// úteis a partir do dia útil seguinte à data do planejamento, e o 15º abre a apreciação;
// a apreciação vai até o 3º dia útil depois da abertura; a entrega final e gráfica é 2
// dias úteis depois do fim da apreciação. Fins de semana e feriados nacionais não contam.
// Exemplo dela: planejamento em 11/09/2026 dá apreciação de 02/10 a 07/10 e entrega em 09/10.

export interface PrazosPlanejamento {
  /** Datas ISO (AAAA-MM-DD). */
  dataPlanejamento: string;
  apreciacaoInicio: string;
  apreciacaoFim: string;
  entregaFinal: string;
}

function utc(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

function paraIso(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia, 12));
}

/**
 * Feriados nacionais de lei (Lei nº 662/1949 e alterações, Lei nº 14.759/2023 para o
 * 20 de novembro) e a Sexta-feira da Paixão. Carnaval e Corpus Christi são ponto
 * facultativo e contam como dia útil.
 */
export function feriadosNacionais(ano: number): Set<string> {
  const fixos = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];
  const datas = new Set(fixos.map((md) => `${ano}-${md}`));
  const paixao = pascoa(ano);
  paixao.setUTCDate(paixao.getUTCDate() - 2);
  datas.add(paraIso(paixao));
  return datas;
}

export function ehDiaUtil(iso: string): boolean {
  const data = utc(iso);
  const semana = data.getUTCDay();
  if (semana === 0 || semana === 6) return false;
  return !feriadosNacionais(data.getUTCFullYear()).has(iso);
}

/** O n-ésimo dia útil depois de `iso` (n = 1 é o próximo dia útil). */
export function somarDiasUteis(iso: string, n: number): string {
  const data = utc(iso);
  let contados = 0;
  while (contados < n) {
    data.setUTCDate(data.getUTCDate() + 1);
    if (ehDiaUtil(paraIso(data))) contados++;
  }
  return paraIso(data);
}

export function calcularPrazos(dataPlanejamento: string): PrazosPlanejamento {
  const apreciacaoInicio = somarDiasUteis(dataPlanejamento, 15);
  const apreciacaoFim = somarDiasUteis(apreciacaoInicio, 3);
  return {
    dataPlanejamento,
    apreciacaoInicio,
    apreciacaoFim,
    entregaFinal: somarDiasUteis(apreciacaoFim, 2),
  };
}

/** "2026-10-08" → "08/10/2026". */
export function dataBr(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}
