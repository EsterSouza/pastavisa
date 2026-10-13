"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, buttonClass } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { fieldClass, SelectField, TextField } from "@/components/ui/Field";
import { Feedback } from "@/components/ui/Status";
import { Card } from "@/components/ui/Surface";
import {
  assuntoInicial,
  definicaoEmail,
  entregaDaVersao,
  montarEmail,
  problemasDoEmail,
  type PastaParaEmail,
  type TipoEmail,
  valoresIniciais,
} from "@/lib/emails/pasta-emails";

type Enviado = { id: string; tipo: string; para: string; assunto: string; enviadoEm: string };
type Situacao = { smtpConfigurado: boolean; remetente: string; enviados: Enviado[] };

type Etapa = { chave: "boas-vindas" | "apreciacao" | "entrega"; titulo: string; tipos: TipoEmail[] };

const ETAPAS: Etapa[] = [
  { chave: "boas-vindas", titulo: "Boas-vindas", tipos: ["boas-vindas"] },
  { chave: "apreciacao", titulo: "Período de apreciação", tipos: ["apreciacao"] },
  { chave: "entrega", titulo: "Entrega final", tipos: ["entrega-fisica", "entrega-digital"] },
];

/** Mesmo limite de app/api/pastas/[id]/emails: o corpo da requisição na Vercel vai até 4,5 MB. */
const ANEXO_MAXIMO = 3 * 1024 * 1024;

function paraBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).replace(/^data:[^,]*,/, ""));
    leitor.onerror = () => reject(new Error("Não deu para ler o PDF."));
    leitor.readAsDataURL(arquivo);
  });
}

function quando(value: string): string {
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function LinkExterno({ href, children }: { href: string | null | undefined; children: string }) {
  if (!href) return <span className="text-ink-subtle">{children}: sem link</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="font-semibold text-brand-accent underline-offset-4 hover:underline">
      {children} ↗
    </a>
  );
}

/**
 * Os e-mails da pasta para a cliente (modelos da Ester), com prévia ao lado e envio
 * pela Hostinger. O "Entrega final" já abre no modelo da versão da pasta.
 */
export function EmailsCliente({
  pastaId,
  pasta,
  documentosGerados,
}: {
  pastaId: string;
  pasta: PastaParaEmail & { versaoPasta?: string | null };
  documentosGerados: number;
}) {
  const [situacao, setSituacao] = useState<Situacao | null>(null);
  const [erroSituacao, setErroSituacao] = useState("");
  const [tipo, setTipo] = useState<TipoEmail | null>(null);

  async function carregar() {
    try {
      const r = await fetch(`/api/pastas/${pastaId}/emails`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setSituacao(await r.json());
      setErroSituacao("");
    } catch {
      setErroSituacao("Não deu para ler os e-mails já enviados.");
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pastaId]);

  const entregaIndicada = entregaDaVersao(pasta.versaoPasta);

  return (
    <Card className="p-4">
      <h2 className="font-display text-base text-ink">E-mails para a cliente</h2>
      <div className="mt-2 flex flex-col gap-1 text-sm">
        <LinkExterno href={pasta.linkDrive}>Pasta no Drive</LinkExterno>
        <LinkExterno href={pasta.linkOneDrive}>PDFs no OneDrive</LinkExterno>
      </div>

      <ul className="mt-3 divide-y divide-gray-200 border-t border-gray-200">
        {ETAPAS.map((etapa) => {
          const ultimo = situacao?.enviados.find((enviado) => etapa.tipos.includes(enviado.tipo as TipoEmail));
          const abrir = etapa.chave === "entrega" ? entregaIndicada : etapa.tipos[0];
          return (
            <li key={etapa.chave} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{etapa.titulo}</p>
                <p className={`text-xs ${ultimo ? "text-status-success" : "text-ink-muted"}`}>
                  {ultimo ? `Enviado em ${quando(ultimo.enviadoEm)}` : "Não enviado"}
                </p>
              </div>
              <Button variant="secondary" onClick={() => setTipo(abrir)}>
                {ultimo ? "Reenviar" : "Preparar"}
              </Button>
            </li>
          );
        })}
      </ul>
      {erroSituacao && <p className="mt-2 text-sm text-status-danger">{erroSituacao}</p>}

      {tipo && (
        <PrepararEmail
          key={tipo}
          pastaId={pastaId}
          pasta={pasta}
          documentosGerados={documentosGerados}
          tipo={tipo}
          onTrocarTipo={setTipo}
          situacao={situacao}
          onClose={() => setTipo(null)}
          onEnviado={() => void carregar()}
        />
      )}
    </Card>
  );
}

function PrepararEmail({
  pastaId,
  pasta,
  documentosGerados,
  tipo,
  onTrocarTipo,
  situacao,
  onClose,
  onEnviado,
}: {
  pastaId: string;
  pasta: PastaParaEmail;
  documentosGerados: number;
  tipo: TipoEmail;
  onTrocarTipo: (tipo: TipoEmail) => void;
  situacao: Situacao | null;
  onClose: () => void;
  onEnviado: () => void;
}) {
  const definicao = definicaoEmail(tipo)!;
  const [para, setPara] = useState((pasta.clienteEmail || "").trim());
  const [assunto, setAssunto] = useState(assuntoInicial(tipo, pasta));
  const [valores, setValores] = useState(() => valoresIniciais(tipo, pasta, documentosGerados));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [enviadoAgora, setEnviadoAgora] = useState("");
  const [copiado, setCopiado] = useState("");
  const [semCopia, setSemCopia] = useState(false);
  const [anexo, setAnexo] = useState<File | null>(null);

  const previa = useMemo(() => montarEmail(tipo, valores, "previa"), [tipo, valores]);
  const problemas = useMemo(() => {
    const lista = problemasDoEmail(tipo, valores);
    if (!para.trim()) lista.unshift('Preencha "Para".');
    if (!assunto.trim()) lista.unshift('Preencha "Assunto".');
    if (anexo && anexo.size > ANEXO_MAXIMO) lista.unshift("O PDF anexado passa de 3 MB.");
    return lista;
  }, [tipo, valores, para, assunto, anexo]);

  const anteriores = (situacao?.enviados || []).filter((enviado) => enviado.tipo === tipo);
  const podeEnviar = !!situacao?.smtpConfigurado && problemas.length === 0 && !enviando && !enviadoAgora;

  async function enviar() {
    setEnviando(true);
    setErro("");
    try {
      const corpo: Record<string, unknown> = { tipo, para, assunto, valores };
      if (anexo) corpo.anexo = { nome: anexo.name, base64: await paraBase64(anexo) };
      const r = await fetch(`/api/pastas/${pastaId}/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `O envio falhou (HTTP ${r.status}).`);
      setEnviadoAgora(para);
      setSemCopia(data.copiaEmEnviados === false);
      onEnviado();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "O envio falhou.");
    } finally {
      setEnviando(false);
    }
  }

  // Igual ao botão "Copiar" dos modelos: cola pronto no Gmail.
  async function copiar() {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([previa], { type: "text/html" }),
          "text/plain": new Blob([previa], { type: "text/plain" }),
        }),
      ]);
      setCopiado("Copiado. Abra o Gmail e cole com Ctrl+V.");
    } catch {
      setCopiado("O navegador bloqueou a cópia.");
    }
  }

  return (
    <Drawer
      aberto
      largura="xl"
      titulo={definicao.titulo}
      descricao={definicao.quando}
      onClose={onClose}
      rodape={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-muted" aria-live="polite">
            {enviadoAgora
              ? `Enviado para ${enviadoAgora}.${semCopia ? "" : " A cópia está em Enviados."}`
              : problemas[0] ||
                (situacao && !situacao.smtpConfigurado
                  ? "Envio pela Hostinger ainda não configurado."
                  : situacao?.remetente
                    ? `Sai de ${situacao.remetente}.`
                    : "")}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => void copiar()} disabled={problemas.length > 0}>
              Copiar para o Gmail
            </Button>
            <Button onClick={() => void enviar()} disabled={!podeEnviar}>
              {enviando ? "Enviando..." : enviadoAgora ? "Enviado" : "Enviar e-mail"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          {situacao && !situacao.smtpConfigurado && (
            <Feedback tone="atencao" title="Envio ainda não configurado">
              Falta colocar a senha da caixa da Hostinger no servidor (SMTP_USER e SMTP_PASS). Até lá, use{" "}
              <strong>Copiar para o Gmail</strong>.
            </Feedback>
          )}
          {erro && <Feedback tone="erro" title="Não enviou">{erro}</Feedback>}
          {copiado && <Feedback tone="info">{copiado}</Feedback>}
          {semCopia && (
            <Feedback tone="atencao" title="Enviado, mas sem cópia em Enviados">
              A cliente recebeu, mas a cópia não ficou na pasta Enviados da sua caixa. O registro do envio está
              aqui no app.
            </Feedback>
          )}
          {anteriores.length > 0 && !enviadoAgora && (
            <Feedback tone="atencao" title="Este e-mail já foi enviado">
              {anteriores.map((enviado) => `${quando(enviado.enviadoEm)} para ${enviado.para}`).join("; ")}.
            </Feedback>
          )}

          {definicao.tipo.startsWith("entrega") && (
            <SelectField
              label="Modelo"
              value={tipo}
              onChange={(v) => onTrocarTipo(v as TipoEmail)}
              options={[
                { value: "entrega-digital", label: "Só pasta digital" },
                { value: "entrega-fisica", label: "Digital + pasta física" },
              ]}
            />
          )}
          <TextField label="Para" hint="Mais de um: separe por vírgula." value={para} onChange={setPara} />
          {tipo === "boas-vindas" && (
            <div>
              <label htmlFor="anexo-planejamento" className="mb-1 block text-sm font-semibold text-ink">
                Anexar o planejamento em PDF (opcional)
              </label>
              <input
                id="anexo-planejamento"
                type="file"
                accept=".pdf,application/pdf"
                disabled={enviando || !!enviadoAgora}
                onChange={(e) => setAnexo(e.target.files?.[0] || null)}
                className="block w-full text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-surface-subtle file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-accent"
              />
              <p className="mt-1 text-sm text-ink-muted">
                {anexo
                  ? anexo.size > ANEXO_MAXIMO
                    ? "Passa de 3 MB: mande só pelo link do Drive."
                    : `Vai anexado: ${anexo.name}`
                  : "Sem anexo, o planejamento fica só na pasta do Drive."}
              </p>
            </div>
          )}
          <TextField label="Assunto" value={assunto} onChange={setAssunto} />
          {definicao.campos.map((campo) => (
            <TextField
              key={campo.chave}
              label={campo.rotulo}
              hint={campo.dica}
              value={valores[campo.chave] || ""}
              onChange={(v) => setValores((atual) => ({ ...atual, [campo.chave]: v }))}
            />
          ))}
          <Link href={`/pasta/${pastaId}/editar`} className={buttonClass("quiet", "-ml-2 self-start")}>
            Corrigir links e dados da pasta ›
          </Link>
        </div>

        <div className="min-w-0">
          <p className="mb-2 text-sm font-semibold text-ink">Prévia</p>
          <iframe
            title="Prévia do e-mail"
            srcDoc={previa}
            sandbox=""
            className={`${fieldClass} h-[calc(100vh-15rem)] w-full bg-white p-0`}
          />
        </div>
      </div>
    </Drawer>
  );
}
