"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button, buttonClass } from "@/components/ui/Button";
import { fieldClass, SelectField, TextField } from "@/components/ui/Field";
import { FormSection, PageHeader } from "@/components/ui/Surface";
import { describeErrorOrigin, Feedback } from "@/components/ui/Status";

interface Equipamento { nome: string; marca: string; modelo: string; registro_anvisa: string }
interface ProdutoInsumo { nome: string; categoria: string; fabricante: string; registro_anvisa: string; uso: string }
interface Funcionario { nome: string; funcao: string; conselho: string }
interface ResponsavelTecnico { nome: string; profissao: string; conselho: string; setor: string }
interface Terceirizado { servico: string; razao_social: string; cnpj: string }

interface FormData {
  clienteNomeFantasia: string;
  clienteRazaoSocial: string;
  clienteCnpj: string;
  clienteEndereco: string;
  clienteCidade: string;
  clienteEstado: string;
  clienteEstadoExtenso: string;
  clienteTelefone: string;
  clienteEmail: string;
  clienteHorario: string;
  clienteProprietarioNome: string;
  clienteRtNome: string;
  clienteRtProfissao: string;
  clienteRtConselho: string;
  clienteResponsaveisTecnicos: ResponsavelTecnico[];
  clienteEstrutura: string;
  clienteMemorialDescritivoMbp: string;
  clienteServicos: string[];
  clienteFuncionarios: Funcionario[];
  clienteEquipamentos: Equipamento[];
  clienteProdutosInsumos: ProdutoInsumo[];
  clienteTerceirizados: Terceirizado[];
  clienteColetaRazao: string;
  clienteColetaCnpj: string;
  clienteResiduosA: string;
  clienteResiduosD: string;
  clienteResiduosE: string;
  clienteLogoBgHex: string;
  clienteInfoAdicionais: string;
  docElaborador: string;
  docMesExtenso: string;
  docAno: string;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/**
 * Editor de lista com colunas fixas. Todas as listas do cadastro têm a mesma
 * forma — registros planos de texto — e antes cada uma repetia o mesmo bloco de
 * input, handler e botão de remover, sem rótulo acessível em nenhum campo.
 */
function ListaEditavel<T extends object>({
  itens,
  campos,
  onChange,
  novoItem,
  rotuloAdicionar,
  rotuloItem,
  vazio,
  colunas = "sm:grid-cols-3",
}: {
  itens: T[];
  campos: Array<{ key: keyof T & string; label: string }>;
  onChange: (itens: T[]) => void;
  novoItem: () => T;
  rotuloAdicionar: string;
  rotuloItem: string;
  vazio?: string;
  colunas?: string;
}) {
  return (
    <div className="space-y-3">
      {itens.length === 0 && vazio && <p className="text-sm text-ink-muted">{vazio}</p>}
      {itens.map((item, index) => (
        <div key={index} className={`grid gap-2 ${colunas}`}>
          {campos.map((campo) => (
            <input
              key={campo.key}
              type="text"
              value={(item[campo.key] as string) ?? ""}
              aria-label={`${campo.label} — ${rotuloItem} ${index + 1}`}
              placeholder={campo.label}
              onChange={(event) => {
                const atualizados = [...itens];
                atualizados[index] = { ...atualizados[index], [campo.key]: event.target.value };
                onChange(atualizados);
              }}
              className={fieldClass}
            />
          ))}
          <Button
            variant="danger"
            onClick={() => onChange(itens.filter((_, outro) => outro !== index))}
          >
            Remover
            <span className="sr-only">{` ${rotuloItem} ${index + 1}`}</span>
          </Button>
        </div>
      ))}
      <Button variant="secondary" onClick={() => onChange([...itens, novoItem()])}>
        {rotuloAdicionar}
      </Button>
    </div>
  );
}

function Variavel({ children }: { children: string }) {
  return (
    <p className="text-sm text-ink-muted">
      Variável no template: <span className="font-semibold text-ink">{children}</span>
    </p>
  );
}

function buildPatchPayload(form: FormData) {
  return {
    ...form,
    clienteServicos: JSON.stringify(form.clienteServicos),
    clienteResponsaveisTecnicos: JSON.stringify(form.clienteResponsaveisTecnicos),
    clienteFuncionarios: JSON.stringify(form.clienteFuncionarios),
    clienteEquipamentos: JSON.stringify(form.clienteEquipamentos),
    clienteProdutosInsumos: JSON.stringify(form.clienteProdutosInsumos),
    clienteTerceirizados: JSON.stringify(form.clienteTerceirizados),
  };
}

export default function EditarPasta() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState<FormData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [novoServico, setNovoServico] = useState("");
  const [initialPayload, setInitialPayload] = useState("");

  useEffect(() => {
    fetch(`/api/pastas/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`O banco não devolveu esta pasta (HTTP ${r.status}).`);
        return r.json();
      })
      .then((pasta) => {
        const nextForm = {
          clienteNomeFantasia: pasta.clienteNomeFantasia || "",
          clienteRazaoSocial: pasta.clienteRazaoSocial || "",
          clienteCnpj: pasta.clienteCnpj || "",
          clienteEndereco: pasta.clienteEndereco || "",
          clienteCidade: pasta.clienteCidade || "",
          clienteEstado: pasta.clienteEstado || "",
          clienteEstadoExtenso: pasta.clienteEstadoExtenso || "",
          clienteTelefone: pasta.clienteTelefone || "",
          clienteEmail: pasta.clienteEmail || "",
          clienteHorario: pasta.clienteHorario || "",
          clienteProprietarioNome: pasta.clienteProprietarioNome || "",
          clienteRtNome: pasta.clienteRtNome || "",
          clienteRtProfissao: pasta.clienteRtProfissao || "",
          clienteRtConselho: pasta.clienteRtConselho || "",
          clienteResponsaveisTecnicos: pasta.clienteResponsaveisTecnicos ? JSON.parse(pasta.clienteResponsaveisTecnicos) : [],
          clienteEstrutura: pasta.clienteEstrutura || "",
          clienteMemorialDescritivoMbp: pasta.clienteMemorialDescritivoMbp || "",
          clienteServicos: pasta.clienteServicos ? JSON.parse(pasta.clienteServicos) : [],
          clienteFuncionarios: pasta.clienteFuncionarios ? JSON.parse(pasta.clienteFuncionarios) : [],
          clienteEquipamentos: pasta.clienteEquipamentos ? JSON.parse(pasta.clienteEquipamentos) : [],
          clienteProdutosInsumos: pasta.clienteProdutosInsumos ? JSON.parse(pasta.clienteProdutosInsumos) : [],
          clienteTerceirizados: pasta.clienteTerceirizados ? JSON.parse(pasta.clienteTerceirizados) : [],
          clienteColetaRazao: pasta.clienteColetaRazao || "",
          clienteColetaCnpj: pasta.clienteColetaCnpj || "",
          clienteResiduosA: pasta.clienteResiduosA || "",
          clienteResiduosD: pasta.clienteResiduosD || "",
          clienteResiduosE: pasta.clienteResiduosE || "",
          clienteLogoBgHex: pasta.clienteLogoBgHex || "",
          clienteInfoAdicionais: pasta.clienteInfoAdicionais || "",
          docElaborador: pasta.docElaborador || "",
          docMesExtenso: pasta.docMesExtenso || "",
          docAno: pasta.docAno || "",
        };
        setForm(nextForm);
        setInitialPayload(JSON.stringify(buildPatchPayload(nextForm)));
      })
      .catch((error: unknown) => {
        setLoadError(
          error instanceof Error ? error.message : "Não foi possível carregar a pasta do banco."
        );
      });
  }, [id]);

  function set(key: keyof FormData, value: unknown) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setSaveError("");

    const payload = buildPatchPayload(form);
    const dadosAlterados = JSON.stringify(payload) !== initialPayload || !!logoFile;
    const response = await fetch(`/api/pastas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setSaveError(data.error || "O banco recusou os dados da pasta.");
      setSaving(false);
      return;
    }

    if (logoFile) {
      const fd = new FormData();
      fd.append("logo", logoFile);
      const logoResponse = await fetch(`/api/pastas/${id}/logo`, { method: "POST", body: fd });
      if (!logoResponse.ok) {
        const data = await logoResponse.json().catch(() => ({}));
        setSaveError(data.error || "Dados salvos, mas a logo não foi gravada.");
        setSaving(false);
        return;
      }
    }

    const confirmResponse = await fetch(`/api/pastas/${id}`);
    if (confirmResponse.ok) {
      const updated = await confirmResponse.json();
      const memorialSalvo = updated.clienteMemorialDescritivoMbp || "";
      if ((form.clienteMemorialDescritivoMbp || "") !== memorialSalvo) {
        setSaveError("O memorial não confirmou persistência no banco. Verifique a migração da coluna clienteMemorialDescritivoMbp.");
        setSaving(false);
        return;
      }
      if (logoFile && !updated.clienteLogoPath) {
        setSaveError("A logo foi enviada, mas o caminho não ficou salvo na pasta.");
        setSaving(false);
        return;
      }
    }

    if (!confirmResponse.ok) {
      setSaveError("Dados salvos, mas o banco não confirmou a persistência.");
      setSaving(false);
      return;
    }

    setSaving(false);
    router.push(`/pasta/${id}/processar${dadosAlterados ? "?regenerar=dados" : ""}`);
  }

  if (loadError) {
    return (
      <Feedback tone="erro" title={describeErrorOrigin(loadError).rotulo} live>
        {loadError} Atualize a página para tentar novamente.
      </Feedback>
    );
  }

  if (!form) return <p className="text-sm text-ink-muted">Carregando cadastro...</p>;

  const hexValido = /^#?[0-9a-fA-F]{6}$/.test(form.clienteLogoBgHex.trim());
  const hexNormalizado = form.clienteLogoBgHex.trim().startsWith("#")
    ? form.clienteLogoBgHex.trim()
    : `#${form.clienteLogoBgHex.trim()}`;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Editar dados do cliente"
        description="Estes campos alimentam as variáveis dos templates na geração."
        actions={
          <Link href={`/pasta/${id}`} className={buttonClass("secondary")}>
            Voltar para a pasta
          </Link>
        }
      />

      <div aria-live="polite">
        {saveError && (
          <Feedback tone="erro" title={describeErrorOrigin(saveError).rotulo} className="mb-6">
            {saveError}
          </Feedback>
        )}
      </div>

      <div className="space-y-6">
        <FormSection title="Estabelecimento">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Nome fantasia" value={form.clienteNomeFantasia} onChange={(v) => set("clienteNomeFantasia", v)} />
            <TextField label="Razão social" value={form.clienteRazaoSocial} onChange={(v) => set("clienteRazaoSocial", v)} />
            <TextField label="CNPJ" value={form.clienteCnpj} onChange={(v) => set("clienteCnpj", v)} />
            <TextField label="Telefone" value={form.clienteTelefone} onChange={(v) => set("clienteTelefone", v)} />
            <TextField label="E-mail" value={form.clienteEmail} onChange={(v) => set("clienteEmail", v)} />
            <TextField label="Horário de funcionamento" value={form.clienteHorario} onChange={(v) => set("clienteHorario", v)} />
          </div>
          <TextField label="Endereço completo" value={form.clienteEndereco} onChange={(v) => set("clienteEndereco", v)} />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Cidade" value={form.clienteCidade} onChange={(v) => set("clienteCidade", v)} />
            <TextField label="UF" value={form.clienteEstado} onChange={(v) => set("clienteEstado", v)} />
            <TextField label="Estado por extenso" value={form.clienteEstadoExtenso} onChange={(v) => set("clienteEstadoExtenso", v)} />
          </div>
        </FormSection>

        <FormSection title="Responsável técnico">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Proprietário" value={form.clienteProprietarioNome} onChange={(v) => set("clienteProprietarioNome", v)} />
            <TextField label="Nome" value={form.clienteRtNome} onChange={(v) => set("clienteRtNome", v)} />
            <TextField label="Profissão" value={form.clienteRtProfissao} onChange={(v) => set("clienteRtProfissao", v)} />
            <TextField label="Conselho" hint="Exemplo: COREN-PA 920468." value={form.clienteRtConselho} onChange={(v) => set("clienteRtConselho", v)} />
          </div>
        </FormSection>

        <FormSection
          title="Responsáveis técnicos por setor"
          description="Use quando houver responsáveis diferentes por área, como enfermagem, nutrição, estética ou farmácia."
        >
          <ListaEditavel<ResponsavelTecnico>
            itens={form.clienteResponsaveisTecnicos}
            campos={[
              { key: "setor", label: "Setor ou área" },
              { key: "nome", label: "Nome" },
              { key: "profissao", label: "Profissão" },
              { key: "conselho", label: "Conselho ou registro" },
            ]}
            colunas="sm:grid-cols-2 lg:grid-cols-4"
            onChange={(itens) => set("clienteResponsaveisTecnicos", itens)}
            novoItem={() => ({ nome: "", profissao: "", conselho: "", setor: "" })}
            rotuloAdicionar="Adicionar responsável por setor"
            rotuloItem="responsável por setor"
            vazio="Nenhum responsável por setor cadastrado."
          />
          <Variavel>{"{cliente_rts_lista} e {cliente_rts_assinaturas}"}</Variavel>
        </FormSection>

        <FormSection title="Estrutura física">
          <TextField
            label="Descrição da estrutura física"
            value={form.clienteEstrutura}
            onChange={(v) => set("clienteEstrutura", v)}
            multiline
          />
        </FormSection>

        <FormSection
          title="Memorial descritivo do MBP"
          description="Texto completo pronto para inserir no Manual de Boas Práticas."
        >
          <TextField
            label="Memorial descritivo"
            value={form.clienteMemorialDescritivoMbp}
            onChange={(v) => set("clienteMemorialDescritivoMbp", v)}
            multiline
            rows={12}
            className="min-h-[18rem]"
          />
          <Variavel>{"{cliente_memorial_descritivo_mbp}"}</Variavel>
        </FormSection>

        <FormSection title="Serviços">
          <ul className="space-y-2">
            {form.clienteServicos.map((servico, index) => (
              <li key={index} className="flex gap-2">
                <input
                  type="text"
                  value={servico}
                  aria-label={`Serviço ${index + 1}`}
                  onChange={(event) => {
                    const atualizados = [...form.clienteServicos];
                    atualizados[index] = event.target.value;
                    set("clienteServicos", atualizados);
                  }}
                  className={fieldClass}
                />
                <Button
                  variant="danger"
                  onClick={() => set("clienteServicos", form.clienteServicos.filter((_, outro) => outro !== index))}
                >
                  Remover
                  <span className="sr-only">{` serviço ${index + 1}`}</span>
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              type="text"
              value={novoServico}
              aria-label="Novo serviço"
              placeholder="Novo serviço..."
              onChange={(event) => setNovoServico(event.target.value)}
              className={fieldClass}
            />
            <Button
              variant="secondary"
              onClick={() => {
                if (novoServico.trim()) {
                  set("clienteServicos", [...form.clienteServicos, novoServico.trim()]);
                  setNovoServico("");
                }
              }}
            >
              Adicionar
            </Button>
          </div>
        </FormSection>

        <FormSection
          title="Funcionários"
          description="Adicione apenas se o estabelecimento tiver equipe além do responsável técnico."
        >
          <ListaEditavel<Funcionario>
            itens={form.clienteFuncionarios}
            campos={[
              { key: "nome", label: "Nome" },
              { key: "funcao", label: "Função" },
              { key: "conselho", label: "Conselho ou registro" },
            ]}
            colunas="sm:grid-cols-2 lg:grid-cols-3"
            onChange={(itens) => set("clienteFuncionarios", itens)}
            novoItem={() => ({ nome: "", funcao: "", conselho: "" })}
            rotuloAdicionar="Adicionar funcionário"
            rotuloItem="funcionário"
            vazio="Nenhum funcionário cadastrado."
          />
          <Variavel>{"{cliente_funcionarios_lista}"}</Variavel>
        </FormSection>

        <FormSection title="Equipamentos">
          <ListaEditavel<Equipamento>
            itens={form.clienteEquipamentos}
            campos={[
              { key: "nome", label: "Nome" },
              { key: "marca", label: "Marca" },
              { key: "modelo", label: "Modelo" },
              { key: "registro_anvisa", label: "Registro ANVISA" },
            ]}
            colunas="sm:grid-cols-2 lg:grid-cols-4"
            onChange={(itens) => set("clienteEquipamentos", itens)}
            novoItem={() => ({ nome: "", marca: "", modelo: "", registro_anvisa: "" })}
            rotuloAdicionar="Adicionar equipamento"
            rotuloItem="equipamento"
            vazio="Nenhum equipamento cadastrado."
          />
        </FormSection>

        <FormSection
          title="Produtos, insumos, medicamentos e cosméticos"
          description="Itens relevantes para POPs, MBP, PGRSS, protocolos e relação de serviços."
        >
          <ListaEditavel<ProdutoInsumo>
            itens={form.clienteProdutosInsumos}
            campos={[
              { key: "nome", label: "Nome" },
              { key: "categoria", label: "Tipo" },
              { key: "fabricante", label: "Fabricante" },
              { key: "registro_anvisa", label: "Registro ANVISA" },
              { key: "uso", label: "Uso ou procedimento" },
            ]}
            colunas="sm:grid-cols-2 lg:grid-cols-3"
            onChange={(itens) => set("clienteProdutosInsumos", itens)}
            novoItem={() => ({ nome: "", categoria: "", fabricante: "", registro_anvisa: "", uso: "" })}
            rotuloAdicionar="Adicionar produto ou insumo"
            rotuloItem="produto"
            vazio="Nenhum produto ou insumo cadastrado."
          />
          <Variavel>{"{cliente_produtos_insumos_lista}"}</Variavel>
        </FormSection>

        <FormSection title="Serviços terceirizados">
          <ListaEditavel<Terceirizado>
            itens={form.clienteTerceirizados}
            campos={[
              { key: "servico", label: "Serviço" },
              { key: "razao_social", label: "Razão social" },
              { key: "cnpj", label: "CNPJ" },
            ]}
            colunas="sm:grid-cols-2 lg:grid-cols-3"
            onChange={(itens) => set("clienteTerceirizados", itens)}
            novoItem={() => ({ servico: "", razao_social: "", cnpj: "" })}
            rotuloAdicionar="Adicionar terceirizado"
            rotuloItem="terceirizado"
            vazio="Nenhum serviço terceirizado cadastrado."
          />
        </FormSection>

        <FormSection title="Empresa de coleta de resíduos">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Razão social" value={form.clienteColetaRazao} onChange={(v) => set("clienteColetaRazao", v)} />
            <TextField label="CNPJ" value={form.clienteColetaCnpj} onChange={(v) => set("clienteColetaCnpj", v)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Resíduos Grupo A (kg/mês)" value={form.clienteResiduosA} onChange={(v) => set("clienteResiduosA", v)} />
            <TextField label="Resíduos Grupo D (kg/mês)" value={form.clienteResiduosD} onChange={(v) => set("clienteResiduosD", v)} />
            <TextField label="Resíduos Grupo E (kg/mês)" value={form.clienteResiduosE} onChange={(v) => set("clienteResiduosE", v)} />
          </div>
        </FormSection>

        <FormSection
          title="Dados do documento"
          description="Preenchidos pela data de criação da pasta, mas podem ser sobrescritos."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Elaborador" hint="doc_elaborador" value={form.docElaborador} onChange={(v) => set("docElaborador", v)} />
            <SelectField
              label="Mês por extenso"
              hint="doc_mes_extenso"
              value={form.docMesExtenso}
              onChange={(v) => set("docMesExtenso", v)}
              options={[{ value: "", label: "— automático —" }, ...MESES.map((mes) => ({ value: mes, label: mes }))]}
            />
            <TextField label="Ano" hint="doc_ano" value={form.docAno} onChange={(v) => set("docAno", v)} />
          </div>
        </FormSection>

        <FormSection
          title="Logo do cliente"
          description="A logo entra no cabeçalho de todos os documentos gerados."
        >
          <div>
            <label htmlFor="logo-cliente" className="mb-1 block text-sm font-semibold text-ink">
              Arquivo da logo (.png ou .jpg)
            </label>
            <input
              id="logo-cliente"
              type="file"
              accept=".png,.jpg,.jpeg"
              onChange={(event) => setLogoFile(event.target.files?.[0] || null)}
              className="block w-full rounded-md border border-gray-300 bg-surface-card p-1 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-surface-subtle file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-accent"
            />
            {logoFile && (
              <p className="mt-2 text-sm text-ink-muted">
                Nova logo selecionada: <span className="font-semibold text-ink">{logoFile.name}</span>. Será
                gravada junto com os dados.
              </p>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4">
            <label htmlFor="logo-bg-hex" className="mb-1 block text-sm font-semibold text-ink">
              Cor de fundo da logo no cabeçalho (opcional)
            </label>
            <p id="logo-bg-hex-hint" className="mb-2 text-sm text-ink-muted">
              Pinta o quadrado atrás da logo no cabeçalho de todos os documentos. Use o seletor ou
              informe o código hex. Deixe em branco para manter o fundo do template.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="color"
                value={hexValido ? hexNormalizado : "#1b4332"}
                onChange={(event) => set("clienteLogoBgHex", event.target.value)}
                className="h-11 w-14 cursor-pointer rounded-md border border-gray-300 bg-surface-card p-1"
                aria-label="Seletor de cor de fundo da logo"
              />
              <input
                id="logo-bg-hex"
                type="text"
                value={form.clienteLogoBgHex}
                aria-describedby="logo-bg-hex-hint"
                onChange={(event) => set("clienteLogoBgHex", event.target.value)}
                placeholder="#1B4332"
                className={`${fieldClass} w-44`}
              />
              {form.clienteLogoBgHex.trim() && (
                <Button variant="quiet" onClick={() => set("clienteLogoBgHex", "")}>
                  Limpar cor
                </Button>
              )}
            </div>
          </div>
        </FormSection>

        <FormSection title="Informações adicionais">
          <TextField
            label="Complementos não extraídos automaticamente"
            value={form.clienteInfoAdicionais}
            onChange={(v) => set("clienteInfoAdicionais", v)}
            multiline
          />
        </FormSection>

        <Button
          onClick={() => {
            void handleSave();
          }}
          disabled={saving}
          className="w-full"
        >
          {saving ? "Salvando..." : "Salvar e ir para a geração"}
        </Button>
      </div>
    </div>
  );
}
