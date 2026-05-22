import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCS_TESTE = [
  "Plano de Gerenciamento de Resíduos de Serviços de Saúde (PGRSS)",
  "Plano de Controle de Infecção (PCI)",
  "Manual de Limpeza e Desinfecção",
];

export async function POST() {
  const pasta = await prisma.pasta.create({
    data: {
      status: "rascunho",
      clienteNomeFantasia: "Clínica Teste",
      clienteRazaoSocial: "Clínica Teste Serviços de Saúde LTDA",
      clienteCnpj: "00.000.000/0001-00",
      clienteEndereco: "Rua das Acácias, 123, Sala 45, Centro",
      clienteCidade: "São Paulo",
      clienteEstado: "SP",
      clienteEstadoExtenso: "São Paulo",
      clienteTelefone: "(11) 99999-0000",
      clienteEmail: "contato@clinicateste.com.br",
      clienteHorario: "Segunda a Sexta, 08h às 18h",
      clienteRtNome: "Dra. Maria da Silva",
      clienteRtProfissao: "Enfermeira",
      clienteRtConselho: "COREN-SP 123456",
      clienteEstrutura:
        "O estabelecimento possui recepção, sala de procedimentos, sala de esterilização, expurgo e banheiro para pacientes.",
      clienteMemorialDescritivoMbp:
        "O memorial descritivo do MBP deve detalhar a estrutura fisica e infraestrutural real do estabelecimento conforme vistoria, fotos e informacoes fornecidas pelo cliente.",
      clienteServicos: JSON.stringify([
        "Curativos",
        "Aplicação de injeções",
        "Coleta de exames",
        "Vacinação",
      ]),
      clienteFuncionarios: JSON.stringify([
        {
          nome: "Ana Paula Santos",
          funcao: "Auxiliar de enfermagem",
          conselho: "COREN-SP 654321",
        },
      ]),
      clienteEquipamentos: JSON.stringify([
        {
          nome: "Autoclave",
          marca: "Cristófoli",
          modelo: "Power Class 21L",
          registro_anvisa: "80201980016",
        },
        {
          nome: "Ultrassom",
          marca: "Medpej",
          modelo: "US-700",
          registro_anvisa: "80122870022",
        },
      ]),
      clienteTerceirizados: JSON.stringify([
        {
          servico: "Coleta de resíduos infectantes",
          razao_social: "BioResiduos Coleta LTDA",
          cnpj: "11.111.111/0001-11",
        },
      ]),
      clienteColetaRazao: "BioResiduos Coleta LTDA",
      clienteColetaCnpj: "11.111.111/0001-11",
      clienteResiduosA: "5",
      clienteResiduosD: "10",
      clienteResiduosE: "1",
      docElaborador: "TreinaVISA",
      docMesExtenso: "Abril",
      docAno: "2026",
    },
  });

  await prisma.documentoGerado.createMany({
    data: DOCS_TESTE.map((nome) => ({
      pastaId: pasta.id,
      nomeArquivo: nome,
      status: "pendente",
    })),
  });

  return NextResponse.json({ pastaId: pasta.id });
}
