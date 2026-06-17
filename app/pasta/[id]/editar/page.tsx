"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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
  clienteInfoAdicionais: string;
  docElaborador: string;
  docMesExtenso: string;
  docAno: string;
}

function Input({ label, value, onChange, multiline }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean
}) {
  const cls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300";
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {multiline ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </div>
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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [novoServico, setNovoServico] = useState("");
  const [initialPayload, setInitialPayload] = useState("");

  useEffect(() => {
    fetch(`/api/pastas/${id}`)
      .then((r) => r.json())
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
          clienteInfoAdicionais: pasta.clienteInfoAdicionais || "",
          docElaborador: pasta.docElaborador || "",
          docMesExtenso: pasta.docMesExtenso || "",
          docAno: pasta.docAno || "",
        };
        setForm(nextForm);
        setInitialPayload(JSON.stringify(buildPatchPayload(nextForm)));
      });
  }, [id]);

  function set(key: keyof FormData, value: unknown) {
    setForm((f) => f ? { ...f, [key]: value } : f);
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
      setSaveError(data.error || "Erro ao salvar dados da pasta.");
      setSaving(false);
      return;
    }

    if (logoFile) {
      const fd = new FormData();
      fd.append("logo", logoFile);
      const logoResponse = await fetch(`/api/pastas/${id}/logo`, { method: "POST", body: fd });
      if (!logoResponse.ok) {
        const data = await logoResponse.json().catch(() => ({}));
        setSaveError(data.error || "Dados salvos, mas a logo nao foi salva.");
        setSaving(false);
        return;
      }
    }

    const confirmResponse = await fetch(`/api/pastas/${id}`);
    if (confirmResponse.ok) {
      const updated = await confirmResponse.json();
      const memorialSalvo = updated.clienteMemorialDescritivoMbp || "";
      if ((form.clienteMemorialDescritivoMbp || "") !== memorialSalvo) {
        setSaveError("O memorial nao confirmou persistencia no banco. Verifique a migracao da coluna clienteMemorialDescritivoMbp.");
        setSaving(false);
        return;
      }
      if (logoFile && !updated.clienteLogoPath) {
        setSaveError("A logo foi enviada, mas o caminho nao ficou salvo na pasta.");
        setSaving(false);
        return;
      }
    }

    if (!confirmResponse.ok) {
      setSaveError("Dados salvos, mas nao foi possivel confirmar a persistencia.");
      setSaving(false);
      return;
    }

    setSaving(false);
    router.push(`/pasta/${id}/processar${dadosAlterados ? "?regenerar=dados" : ""}`);
  }

  if (!form) return <p className="text-gray-500">Carregando...</p>;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar dados do cliente</h1>
      {saveError && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {saveError}
        </p>
      )}

      <div className="space-y-6">
        {/* Estabelecimento */}
        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Estabelecimento</h2>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nome fantasia" value={form.clienteNomeFantasia} onChange={(v) => set("clienteNomeFantasia", v)} />
            <Input label="Razão social" value={form.clienteRazaoSocial} onChange={(v) => set("clienteRazaoSocial", v)} />
            <Input label="CNPJ" value={form.clienteCnpj} onChange={(v) => set("clienteCnpj", v)} />
            <Input label="Telefone" value={form.clienteTelefone} onChange={(v) => set("clienteTelefone", v)} />
            <Input label="Email" value={form.clienteEmail} onChange={(v) => set("clienteEmail", v)} />
            <Input label="Horário de funcionamento" value={form.clienteHorario} onChange={(v) => set("clienteHorario", v)} />
          </div>
          <Input label="Endereço completo" value={form.clienteEndereco} onChange={(v) => set("clienteEndereco", v)} />
          <div className="grid grid-cols-3 gap-4">
            <Input label="Cidade" value={form.clienteCidade} onChange={(v) => set("clienteCidade", v)} />
            <Input label="UF" value={form.clienteEstado} onChange={(v) => set("clienteEstado", v)} />
            <Input label="Estado por extenso" value={form.clienteEstadoExtenso} onChange={(v) => set("clienteEstadoExtenso", v)} />
          </div>
        </section>

        {/* Responsável Técnico */}
        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Responsável Técnico</h2>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Proprietário" value={form.clienteProprietarioNome} onChange={(v) => set("clienteProprietarioNome", v)} />
            <Input label="Nome" value={form.clienteRtNome} onChange={(v) => set("clienteRtNome", v)} />
            <Input label="Profissão" value={form.clienteRtProfissao} onChange={(v) => set("clienteRtProfissao", v)} />
            <Input label="Conselho (ex: COREN-PA 920468)" value={form.clienteRtConselho} onChange={(v) => set("clienteRtConselho", v)} />
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-800 mb-3">RTs por setor</h2>
          {form.clienteResponsaveisTecnicos.length === 0 && (
            <p className="text-xs text-gray-500 mb-3">Use quando houver responsáveis diferentes por área, como enfermagem, nutrição, estética ou farmácia.</p>
          )}
          {form.clienteResponsaveisTecnicos.map((rt, i) => (
            <div key={i} className="grid grid-cols-4 gap-3 mb-2">
              <input
                type="text"
                placeholder="Setor/área"
                value={rt.setor}
                onChange={(e) => {
                  const updated = [...form.clienteResponsaveisTecnicos];
                  updated[i] = { ...updated[i], setor: e.target.value };
                  set("clienteResponsaveisTecnicos", updated);
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
              />
              <input
                type="text"
                placeholder="Nome"
                value={rt.nome}
                onChange={(e) => {
                  const updated = [...form.clienteResponsaveisTecnicos];
                  updated[i] = { ...updated[i], nome: e.target.value };
                  set("clienteResponsaveisTecnicos", updated);
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
              />
              <input
                type="text"
                placeholder="Profissão"
                value={rt.profissao}
                onChange={(e) => {
                  const updated = [...form.clienteResponsaveisTecnicos];
                  updated[i] = { ...updated[i], profissao: e.target.value };
                  set("clienteResponsaveisTecnicos", updated);
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Conselho/registro"
                  value={rt.conselho}
                  onChange={(e) => {
                    const updated = [...form.clienteResponsaveisTecnicos];
                    updated[i] = { ...updated[i], conselho: e.target.value };
                    set("clienteResponsaveisTecnicos", updated);
                  }}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
                />
                <button
                  onClick={() => set("clienteResponsaveisTecnicos", form.clienteResponsaveisTecnicos.filter((_, j) => j !== i))}
                  className="text-red-400 hover:text-red-600 text-xs"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() => set("clienteResponsaveisTecnicos", [...form.clienteResponsaveisTecnicos, { nome: "", profissao: "", conselho: "", setor: "" }])}
            className="text-xs text-blue-600 hover:underline"
          >
            + Adicionar RT por setor
          </button>
          <p className="text-xs text-gray-500 mt-2">
            Variáveis: {"{cliente_rts_lista}"} e {"{cliente_rts_assinaturas}"}
          </p>
        </section>

        {/* Estrutura */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Estrutura física</h2>
          <Input label="Descrição da estrutura física" value={form.clienteEstrutura} onChange={(v) => set("clienteEstrutura", v)} multiline />
        </section>

        {/* Memorial MBP */}
        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div>
            <h2 className="font-semibold text-gray-800">Memorial descritivo do MBP</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Texto completo pronto para inserir no Manual de Boas Praticas.
            </p>
          </div>
          <textarea
            rows={12}
            value={form.clienteMemorialDescritivoMbp}
            onChange={(e) => set("clienteMemorialDescritivoMbp", e.target.value)}
            placeholder="Cole aqui o memorial descritivo completo do MBP..."
            className="w-full min-h-[280px] border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <p className="text-xs text-gray-500">
            Variavel para usar no template: {"{cliente_memorial_descritivo_mbp}"}
          </p>
        </section>

        {/* Serviços */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Serviços</h2>
          <ul className="space-y-1 mb-3">
            {form.clienteServicos.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <input
                  type="text"
                  value={s}
                  onChange={(e) => {
                    const updated = [...form.clienteServicos];
                    updated[i] = e.target.value;
                    set("clienteServicos", updated);
                  }}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 bg-white"
                />
                <button onClick={() => set("clienteServicos", form.clienteServicos.filter((_, j) => j !== i))}
                  className="text-red-400 hover:text-red-600 text-xs">✕</button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input type="text" value={novoServico} onChange={(e) => setNovoServico(e.target.value)}
              placeholder="Novo serviço..." className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" />
            <button onClick={() => { if (novoServico.trim()) { set("clienteServicos", [...form.clienteServicos, novoServico.trim()]); setNovoServico(""); } }}
              className="bg-gray-100 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-200">Adicionar</button>
          </div>
        </section>

        {/* Funcionários */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Funcionários</h2>
          {form.clienteFuncionarios.length === 0 && (
            <p className="text-xs text-gray-500 mb-3">Adicione apenas se o estabelecimento tiver equipe além do responsável técnico.</p>
          )}
          {form.clienteFuncionarios.map((funcionario, i) => (
            <div key={i} className="grid grid-cols-3 gap-3 mb-2">
              <input
                type="text"
                placeholder="Nome"
                value={funcionario.nome}
                onChange={(e) => {
                  const updated = [...form.clienteFuncionarios];
                  updated[i] = { ...updated[i], nome: e.target.value };
                  set("clienteFuncionarios", updated);
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
              />
              <input
                type="text"
                placeholder="Função"
                value={funcionario.funcao}
                onChange={(e) => {
                  const updated = [...form.clienteFuncionarios];
                  updated[i] = { ...updated[i], funcao: e.target.value };
                  set("clienteFuncionarios", updated);
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Conselho/registro, se houver"
                  value={funcionario.conselho}
                  onChange={(e) => {
                    const updated = [...form.clienteFuncionarios];
                    updated[i] = { ...updated[i], conselho: e.target.value };
                    set("clienteFuncionarios", updated);
                  }}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
                />
                <button
                  onClick={() => set("clienteFuncionarios", form.clienteFuncionarios.filter((_, j) => j !== i))}
                  className="text-red-400 hover:text-red-600 text-xs"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() => set("clienteFuncionarios", [...form.clienteFuncionarios, { nome: "", funcao: "", conselho: "" }])}
            className="text-xs text-blue-600 hover:underline"
          >
            + Adicionar funcionário
          </button>
          <p className="text-xs text-gray-500 mt-2">
            Variável para usar no template: {"{cliente_funcionarios_lista}"}
          </p>
        </section>

        {/* Equipamentos */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Equipamentos</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-700 border-b">
                  <th className="pb-2 text-left font-medium">Nome</th>
                  <th className="pb-2 text-left font-medium">Marca</th>
                  <th className="pb-2 text-left font-medium">Modelo</th>
                  <th className="pb-2 text-left font-medium">ANVISA</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="space-y-1">
                {form.clienteEquipamentos.map((eq, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {(["nome", "marca", "modelo", "registro_anvisa"] as const).map((field) => (
                      <td key={field} className="py-1 pr-2">
                        <input type="text" value={eq[field]}
                          onChange={(e) => {
                            const updated = [...form.clienteEquipamentos];
                            updated[i] = { ...updated[i], [field]: e.target.value };
                            set("clienteEquipamentos", updated);
                          }}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-gray-900 bg-white" />
                      </td>
                    ))}
                    <td className="py-1">
                      <button onClick={() => set("clienteEquipamentos", form.clienteEquipamentos.filter((_, j) => j !== i))}
                        className="text-red-400 hover:text-red-600 text-xs">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={() => set("clienteEquipamentos", [...form.clienteEquipamentos, { nome: "", marca: "", modelo: "", registro_anvisa: "" }])}
            className="mt-2 text-xs text-blue-600 hover:underline">+ Adicionar equipamento</button>
        </section>

        {/* Produtos, insumos e ativos */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Produtos, insumos, medicamentos e cosméticos</h2>
          <p className="text-xs text-gray-500 mb-3">Cadastre itens relevantes para POPs, MBP, PGRSS, protocolos e relação de serviços.</p>
          <div className="space-y-2">
            {form.clienteProdutosInsumos.map((item, i) => (
              <div key={i} className="grid grid-cols-5 gap-2">
                {(["nome", "categoria", "fabricante", "registro_anvisa", "uso"] as const).map((field) => (
                  <input
                    key={field}
                    type="text"
                    placeholder={{ nome: "Nome", categoria: "Tipo", fabricante: "Fabricante", registro_anvisa: "ANVISA", uso: "Uso/procedimento" }[field]}
                    value={item[field]}
                    onChange={(e) => {
                      const updated = [...form.clienteProdutosInsumos];
                      updated[i] = { ...updated[i], [field]: e.target.value };
                      set("clienteProdutosInsumos", updated);
                    }}
                    className="border border-gray-300 rounded-lg px-2 py-2 text-xs text-gray-900 bg-white"
                  />
                ))}
                <button
                  onClick={() => set("clienteProdutosInsumos", form.clienteProdutosInsumos.filter((_, j) => j !== i))}
                  className="col-span-5 text-left text-xs text-red-500 hover:text-red-600"
                >
                  Remover item
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => set("clienteProdutosInsumos", [...form.clienteProdutosInsumos, { nome: "", categoria: "", fabricante: "", registro_anvisa: "", uso: "" }])}
            className="mt-3 text-xs text-blue-600 hover:underline"
          >
            + Adicionar produto/insumo
          </button>
          <p className="text-xs text-gray-500 mt-2">
            Variável para usar no template: {"{cliente_produtos_insumos_lista}"}
          </p>
        </section>

        {/* Terceirizados */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Serviços terceirizados</h2>
          {form.clienteTerceirizados.map((t, i) => (
            <div key={i} className="grid grid-cols-3 gap-3 mb-2">
              <input type="text" placeholder="Serviço" value={t.servico}
                onChange={(e) => { const u = [...form.clienteTerceirizados]; u[i] = { ...u[i], servico: e.target.value }; set("clienteTerceirizados", u); }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" />
              <input type="text" placeholder="Razão social" value={t.razao_social}
                onChange={(e) => { const u = [...form.clienteTerceirizados]; u[i] = { ...u[i], razao_social: e.target.value }; set("clienteTerceirizados", u); }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" />
              <div className="flex gap-2">
                <input type="text" placeholder="CNPJ" value={t.cnpj}
                  onChange={(e) => { const u = [...form.clienteTerceirizados]; u[i] = { ...u[i], cnpj: e.target.value }; set("clienteTerceirizados", u); }}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" />
                <button onClick={() => set("clienteTerceirizados", form.clienteTerceirizados.filter((_, j) => j !== i))}
                  className="text-red-400 hover:text-red-600 text-xs">✕</button>
              </div>
            </div>
          ))}
          <button onClick={() => set("clienteTerceirizados", [...form.clienteTerceirizados, { servico: "", razao_social: "", cnpj: "" }])}
            className="text-xs text-blue-600 hover:underline">+ Adicionar terceirizado</button>
        </section>

        {/* Coleta de resíduos */}
        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Empresa de coleta de resíduos</h2>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Razão social" value={form.clienteColetaRazao} onChange={(v) => set("clienteColetaRazao", v)} />
            <Input label="CNPJ" value={form.clienteColetaCnpj} onChange={(v) => set("clienteColetaCnpj", v)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Resíduos Grupo A (kg/mês)" value={form.clienteResiduosA} onChange={(v) => set("clienteResiduosA", v)} />
            <Input label="Resíduos Grupo D (kg/mês)" value={form.clienteResiduosD} onChange={(v) => set("clienteResiduosD", v)} />
            <Input label="Resíduos Grupo E (kg/mês)" value={form.clienteResiduosE} onChange={(v) => set("clienteResiduosE", v)} />
          </div>
        </section>

        {/* Documento */}
        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-800">Dados do documento</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Preenchidos automaticamente pela data de criação da pasta, mas você pode sobrescrever.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Elaborador (doc_elaborador)" value={form.docElaborador} onChange={(v) => set("docElaborador", v)} />
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Mês por extenso (doc_mes_extenso)</label>
              <select value={form.docMesExtenso} onChange={(e) => set("docMesExtenso", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">— automático —</option>
                {["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <Input label="Ano (doc_ano)" value={form.docAno} onChange={(v) => set("docAno", v)} />
          </div>
        </section>

        {/* Logo */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Logo do cliente</h2>
          {logoFile && (
            <p className="mb-2 text-xs text-blue-700">
              Nova logo selecionada: {logoFile.name}. Ela sera salva junto com os dados.
            </p>
          )}
          <input type="file" accept=".png,.jpg,.jpeg"
            onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
            className="block text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
        </section>

        {/* Informações adicionais */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Informações adicionais</h2>
          <Input label="Complementos não extraídos automaticamente" value={form.clienteInfoAdicionais}
            onChange={(v) => set("clienteInfoAdicionais", v)} multiline />
        </section>

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Salvando..." : "Salvar e ir para processamento →"}
        </button>
      </div>
    </div>
  );
}
