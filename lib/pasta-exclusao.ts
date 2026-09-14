import { prisma } from "@/lib/prisma";
import { deleteGeneratedDocx, deleteLogoFile, deleteUploadedFile } from "@/lib/file-storage";

/**
 * Exclui a pasta e todo arquivo que é só dela. Usada pelo botão de excluir e
 * pela retenção automática. Devolve false quando a pasta não existe.
 */
export async function excluirPasta(id: string): Promise<boolean> {
  const pasta = await prisma.pasta.findUnique({
    where: { id },
    include: {
      documentos: { include: { versoes: true } },
      documentosUpload: { include: { versoes: true } },
    },
  });
  if (!pasta) return false;

  const outputPaths = new Set<string>();
  pasta.documentos.forEach((doc) => {
    if (doc.outputPath) outputPaths.add(doc.outputPath);
    doc.versoes.forEach((versao) => outputPaths.add(versao.outputPath));
  });
  pasta.documentosUpload.forEach((doc) => {
    if (doc.outputPath) outputPaths.add(doc.outputPath);
    doc.versoes.forEach((versao) => outputPaths.add(versao.outputPath));
  });
  // O que o cliente enviou sai junto com a pasta: o original de cada correção
  // e os dois arquivos da extração. Antes ficavam para trás, porque a remoção
  // só alcançava `storage/output` — arquivo sem dono, invisível na tela,
  // impossível de baixar e ocupando cota. Foi o que o PV-026 mediu em 19/08.
  const uploadPaths = new Set<string>();
  pasta.documentosUpload.forEach((doc) => {
    if (doc.uploadPath) uploadPaths.add(doc.uploadPath);
  });
  if (pasta.formsPdfPath) uploadPaths.add(pasta.formsPdfPath);
  if (pasta.documentosElaboracaoPath) uploadPaths.add(pasta.documentosElaboracaoPath);

  // A logo é o único arquivo com mais de um dono possível: `duplicar` copia o
  // `clienteLogoPath` para a pasta nova em vez de gerar cópia no Storage. Só
  // sai quando nenhuma outra pasta aponta para ela.
  const logoDeOutraPasta = pasta.clienteLogoPath
    ? await prisma.pasta.count({
        where: { clienteLogoPath: pasta.clienteLogoPath, id: { not: id } },
      })
    : 0;
  const logoParaRemover = pasta.clienteLogoPath && logoDeOutraPasta === 0 ? pasta.clienteLogoPath : null;

  // Falha ao apagar arquivo derruba a exclusão inteira, de propósito: melhor a
  // pasta continuar de pé do que a linha sumir e o arquivo ficar órfão.
  await Promise.all([
    ...Array.from(outputPaths).map((outputPath) => deleteGeneratedDocx(outputPath)),
    ...Array.from(uploadPaths).map((uploadPath) => deleteUploadedFile(uploadPath)),
    ...(logoParaRemover ? [deleteLogoFile(logoParaRemover)] : []),
  ]);
  await prisma.pasta.delete({ where: { id } });
  return true;
}
