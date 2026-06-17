import type { ClienteData } from "@/lib/ai";

const ESTADOS: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

function splitDeclarativeItems(text: string): string[] {
  return text
    .replace(/[•▪◦]/g, "\n")
    .split(/\r?\n/)
    .flatMap((line) => line.split(/(?=\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç\s/]+:\s*)/g))
    .map((item) => item.trim())
    .filter(Boolean);
}

function readLabeledValue(items: string[], labels: string[]): string | undefined {
  const labelPattern = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(`^(?:${labelPattern})\\s*:\\s*(.+)$`, "i");

  for (const item of items) {
    const match = item.match(regex);
    if (!match) continue;

    const value = match[1]
      .replace(/\s+/g, " ")
      .replace(/[.;]+$/, "")
      .trim();
    if (value) return value;
  }

  return undefined;
}

function valueOrFallback(current: string | undefined, fallback: string | undefined): string | undefined {
  const cleaned = (current || "").trim();
  if (cleaned && !/^(sim|não|nao|yes|no)$/i.test(cleaned)) return cleaned;
  return fallback || undefined;
}

function parseAddress(address: string | undefined): { cidade?: string; uf?: string; estadoExtenso?: string } {
  if (!address) return {};

  const match = address.match(/,\s*([^,/\n]+)\/([A-Z]{2})(?:\s|$|[—-])/);
  if (!match) return {};

  const uf = match[2].toUpperCase();
  return {
    cidade: match[1].trim(),
    uf,
    estadoExtenso: ESTADOS[uf],
  };
}

function normalizeCouncil(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/\s+/g, " ").trim();
}

export function complementarClienteComTextoElaboracao(data: ClienteData, elaboracaoText: string): ClienteData {
  const items = splitDeclarativeItems(elaboracaoText);
  const endereco = readLabeledValue(items, ["Endereço", "Endereco"]);
  const local = parseAddress(endereco);
  const rtNome = readLabeledValue(items, ["Responsável Técnica", "Responsável Técnico", "Responsavel Tecnica", "Responsavel Tecnico"]);
  const rtProfissao = readLabeledValue(items, ["Profissão", "Profissao"]);
  const rtConselho = normalizeCouncil(readLabeledValue(items, ["Conselho Profissional", "Conselho", "Registro Profissional"]));
  const proprietario = readLabeledValue(items, ["Proprietário", "Proprietaria", "Proprietário/Responsável Legal", "Representante Legal"]);

  const next: ClienteData = {
    ...data,
    clienteNomeFantasia: valueOrFallback(data.clienteNomeFantasia, readLabeledValue(items, ["Nome Fantasia"])),
    clienteRazaoSocial: valueOrFallback(data.clienteRazaoSocial, readLabeledValue(items, ["Razão Social", "Razao Social"])),
    clienteCnpj: valueOrFallback(data.clienteCnpj, readLabeledValue(items, ["CNPJ"])),
    clienteEndereco: valueOrFallback(data.clienteEndereco, endereco),
    clienteCidade: valueOrFallback(data.clienteCidade, local.cidade),
    clienteEstado: valueOrFallback(data.clienteEstado, local.uf),
    clienteEstadoExtenso: valueOrFallback(data.clienteEstadoExtenso, local.estadoExtenso),
    clienteTelefone: valueOrFallback(data.clienteTelefone, readLabeledValue(items, ["Telefone"])),
    clienteEmail: valueOrFallback(data.clienteEmail, readLabeledValue(items, ["E-mail", "Email"])),
    clienteHorario: valueOrFallback(data.clienteHorario, readLabeledValue(items, ["Horário de Funcionamento", "Horario de Funcionamento"])),
    clienteRtNome: valueOrFallback(data.clienteRtNome, rtNome),
    clienteRtProfissao: valueOrFallback(data.clienteRtProfissao, rtProfissao),
    clienteRtConselho: valueOrFallback(data.clienteRtConselho, rtConselho),
  };

  const proprietarioAtual = (data.clienteProprietarioNome || "").trim();
  if (/^(sim|yes)$/i.test(proprietarioAtual)) {
    next.clienteProprietarioNome = proprietario || next.clienteRtNome || undefined;
  } else {
    next.clienteProprietarioNome = valueOrFallback(data.clienteProprietarioNome, proprietario);
  }

  if ((!next.clienteResponsaveisTecnicos || next.clienteResponsaveisTecnicos.length === 0) && next.clienteRtNome) {
    next.clienteResponsaveisTecnicos = [
      {
        nome: next.clienteRtNome,
        profissao: next.clienteRtProfissao || "",
        conselho: next.clienteRtConselho || "",
        setor: "Responsabilidade técnica",
      },
    ];
  }

  return next;
}
