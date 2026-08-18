"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { BooleanChoice, TextField } from "@/components/commercial-planner/PlannerFields";
import { FormatStep } from "@/components/commercial-planner/FormatStep";
import { PLANNER_STEPS, PlannerSteps, type PlannerStep } from "@/components/commercial-planner/PlannerSteps";
import { ReviewStep } from "@/components/commercial-planner/ReviewStep";
import { Button } from "@/components/ui/Button";
import { clearDraft, readDraft, writeDraft } from "@/lib/commercial-planner/draft";
import type { PlannerFormat } from "@/lib/commercial-planner/pricing";
import type { PublicCommercialPlan } from "@/lib/commercial-planner/types";
import { applyWithdrawal } from "@/lib/commercial-planner/withdrawal";

interface Analise {
  plano: PublicCommercialPlan;
  token: string;
}

const PLANO_VAZIO = {
  incluidos: [],
  retirados: [],
  documentos: [],
  totalProcedimentos: 0,
  totalDocumentos: 0,
};

export function CommercialPlanner() {
  const [etapa, setEtapa] = useState<PlannerStep>(0);
  const [cliente, setCliente] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [uf, setUf] = useState("");
  const [procedimentos, setProcedimentos] = useState("");
  const [equipamentos, setEquipamentos] = useState("");
  const [reutilizaMateriais, setReutilizaMateriais] = useState<boolean | null>(null);
  const [possuiAutoclave, setPossuiAutoclave] = useState<boolean | null>(null);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [retirados, setRetirados] = useState<string[]>([]);
  const [formato, setFormato] = useState<PlannerFormat>("digital");
  const [erro, setErro] = useState("");
  const [analisando, setAnalisando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [restaurado, setRestaurado] = useState(false);
  const temRascunho = Boolean(cliente.trim() || procedimentos.trim() || analise);
  // O rascunho só passa a ser gravado depois da leitura inicial; sem isso o primeiro
  // render, ainda vazio, apagaria o que a pessoa tinha deixado na aba anterior.
  const lido = useRef(false);

  useEffect(() => {
    const rascunho = readDraft();
    lido.current = true;
    if (!rascunho) return;

    setEtapa(rascunho.etapa as PlannerStep);
    setCliente(rascunho.cliente);
    setMunicipio(rascunho.municipio);
    setUf(rascunho.uf);
    setProcedimentos(rascunho.procedimentos);
    setEquipamentos(rascunho.equipamentos);
    setReutilizaMateriais(rascunho.reutilizaMateriais);
    setPossuiAutoclave(rascunho.possuiAutoclave);
    setAnalise(rascunho.analise);
    setRetirados(rascunho.retirados);
    setFormato(rascunho.formato);
    setRestaurado(true);
  }, []);

  useEffect(() => {
    if (!lido.current) return;
    // Formulário vazio não deixa rascunho para trás: sem isto, recomeçar do zero
    // apagaria e logo em seguida gravaria de volta um rascunho em branco.
    if (!temRascunho) {
      clearDraft();
      return;
    }
    writeDraft({
      etapa,
      cliente,
      municipio,
      uf,
      procedimentos,
      equipamentos,
      reutilizaMateriais,
      possuiAutoclave,
      analise,
      retirados,
      formato,
    });
  }, [
    etapa,
    cliente,
    municipio,
    uf,
    procedimentos,
    equipamentos,
    reutilizaMateriais,
    possuiAutoclave,
    analise,
    retirados,
    formato,
    temRascunho,
  ]);

  // A retirada é recalculada aqui e refeita no servidor: o navegador só antecipa o resultado.
  const retirada = useMemo(
    () => (analise ? applyWithdrawal(analise.plano, retirados) : PLANO_VAZIO),
    [analise, retirados]
  );

  function equipamentosDeclarados(): string[] {
    return equipamentos
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async function analisar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    setAnalisando(true);

    try {
      const response = await fetch("/api/planejamento-comercial/analisar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente,
          municipio,
          uf,
          procedimentos,
          reutilizaMateriais,
          possuiAutoclave,
          equipamentos: equipamentosDeclarados(),
          formato,
        }),
      });
      const dados = await response.json();

      if (!response.ok) {
        setErro(typeof dados?.error === "string" ? dados.error : "Não foi possível analisar agora. Tente novamente.");
        return;
      }

      // Preço e prazo da resposta ficam de fora do estado: quem manda neles é o
      // servidor, no momento do PDF.
      setAnalise({ plano: dados as PublicCommercialPlan, token: dados.token });
      setRetirados([]);
      setEtapa(2);
    } catch {
      setErro("Não foi possível analisar agora. Verifique a conexão e tente novamente.");
    } finally {
      setAnalisando(false);
    }
  }

  async function baixarPdf() {
    if (!analise) return;
    setErro("");
    setBaixando(true);

    try {
      const response = await fetch("/api/planejamento-comercial/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: analise.token, formato, retirados }),
      });

      if (!response.ok) {
        const dados = await response.json().catch(() => null);
        setErro(typeof dados?.error === "string" ? dados.error : "Não foi possível preparar o PDF agora.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "pre-planejamento.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErro("Não foi possível preparar o PDF agora. Verifique a conexão e tente novamente.");
    } finally {
      setBaixando(false);
    }
  }

  function alternarProcedimento(procedimento: string, incluir: boolean) {
    setRetirados((atuais) =>
      incluir ? atuais.filter((item) => item !== procedimento) : [...atuais, procedimento]
    );
  }

  function recomecar() {
    setAnalise(null);
    setRetirados([]);
    setErro("");
    setEtapa(1);
  }

  function recomecarDoZero() {
    clearDraft();
    setEtapa(0);
    setCliente("");
    setMunicipio("");
    setUf("");
    setProcedimentos("");
    setEquipamentos("");
    setReutilizaMateriais(null);
    setPossuiAutoclave(null);
    setAnalise(null);
    setRetirados([]);
    setFormato("digital");
    setErro("");
    setRestaurado(false);
  }

  return (
    <div className="w-full">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-accent">Pasta Sanitária</p>
          <h1 className="mt-2 font-display text-3xl leading-tight text-ink">Pré-planejamento comercial</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-ink-muted">
            Monte a proposta com o cliente na linha: informe a operação, ajuste o que entra, compare os formatos e
            baixe o PDF. O preenchimento fica guardado neste navegador por duas horas, então recarregar a página não
            perde o atendimento.
          </p>
        </div>
        {temRascunho && (
          <Button type="button" variant="secondary" onClick={recomecarDoZero}>
            Recomeçar do zero
          </Button>
        )}
      </div>

      {restaurado && (
        <p role="status" className="mb-6 rounded-md border border-gray-200 bg-surface-subtle px-4 py-3 text-base leading-6 text-ink-muted">
          Retomamos o preenchimento que estava em andamento neste navegador. Use “Recomeçar do zero” para começar
          outro atendimento.
        </p>
      )}

      <PlannerSteps atual={etapa} />

      {erro && (
        <p role="alert" className="mb-6 rounded-md border border-status-danger bg-status-danger-soft px-4 py-3 text-base font-medium text-status-danger">
          {erro}
        </p>
      )}

      <form onSubmit={analisar} noValidate={false}>
        {etapa === 0 && (
          <section aria-labelledby="etapa-cliente" className="space-y-6">
            <div>
              <h2 id="etapa-cliente" className="font-display text-xl text-ink">
                Cliente e local
              </h2>
              <p className="mt-2 text-base leading-6 text-ink-muted">
                O nome entra no PDF exatamente como for digitado aqui.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <TextField
                id="cliente"
                label="Nome do cliente"
                required
                value={cliente}
                onChange={setCliente}
                maxLength={160}
                autoComplete="organization"
              />
              <TextField
                id="municipio"
                label="Município"
                value={municipio}
                onChange={setMunicipio}
                maxLength={120}
                autoComplete="address-level2"
              />
              <TextField
                id="uf"
                label="UF"
                hint="Duas letras, como MG."
                value={uf}
                onChange={(valor) => setUf(valor.toUpperCase().slice(0, 2))}
                maxLength={2}
                autoComplete="address-level1"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={() => setEtapa(1)} disabled={!cliente.trim()}>
                Continuar
              </Button>
            </div>
          </section>
        )}

        {etapa === 1 && (
          <section aria-labelledby="etapa-operacao" className="space-y-6">
            <div>
              <h2 id="etapa-operacao" className="font-display text-xl text-ink">
                Operação declarada
              </h2>
              <p className="mt-2 text-base leading-6 text-ink-muted">
                Escreva o que o cliente informou, com as palavras dele. Só o que estiver declarado é considerado.
              </p>
            </div>

            <TextField
              id="procedimentos"
              label="Procedimentos realizados"
              hint="Um por linha. Escreva o nome real de cada procedimento, e não o apelido ou o nome do protocolo da casa — quanto mais exato, mais certeiro o planejamento."
              required
              linhas={8}
              value={procedimentos}
              onChange={setProcedimentos}
              maxLength={8000}
            />

            <div className="grid gap-6 md:grid-cols-2">
              <BooleanChoice
                legend="Reutiliza materiais entre atendimentos?"
                name="reutiliza-materiais"
                value={reutilizaMateriais}
                onChange={setReutilizaMateriais}
              />
              <BooleanChoice
                legend="Possui autoclave em funcionamento?"
                name="possui-autoclave"
                value={possuiAutoclave}
                onChange={setPossuiAutoclave}
              />
            </div>

            <TextField
              id="equipamentos"
              label="Equipamentos declarados"
              hint="Opcional. Um equipamento por linha."
              linhas={4}
              value={equipamentos}
              onChange={setEquipamentos}
              maxLength={2000}
            />

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={analisando || !procedimentos.trim()}>
                {analisando ? "Analisando..." : "Analisar operação"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEtapa(0)}>
                Voltar
              </Button>
            </div>
            <p aria-live="polite" className="sr-only">
              {analisando ? "Analisando a operação declarada." : ""}
            </p>
          </section>
        )}

        {etapa === 2 && analise && (
          <section aria-labelledby="etapa-revisao" className="space-y-8">
            <h2 id="etapa-revisao" className="sr-only">
              {PLANNER_STEPS[2]}
            </h2>
            <ReviewStep
              plano={analise.plano}
              retirada={retirada}
              retirados={retirados}
              onToggle={alternarProcedimento}
            />
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={() => setEtapa(3)} disabled={retirada.totalProcedimentos === 0}>
                Continuar
              </Button>
              <Button type="button" variant="secondary" onClick={recomecar}>
                Refazer análise
              </Button>
            </div>
          </section>
        )}

        {etapa === 3 && analise && (
          <section aria-labelledby="etapa-formato" className="space-y-8">
            <h2 id="etapa-formato" className="sr-only">
              {PLANNER_STEPS[3]}
            </h2>
            <FormatStep retirada={retirada} formato={formato} onSelect={setFormato} />
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={baixarPdf} disabled={baixando}>
                {baixando ? "Preparando o PDF..." : "Baixar PDF"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEtapa(2)}>
                Voltar para a revisão
              </Button>
            </div>
            <p aria-live="polite" className="sr-only">
              {baixando ? "Preparando o PDF do pré-planejamento." : ""}
            </p>
          </section>
        )}
      </form>
    </div>
  );
}
