import mammoth from "mammoth";

export function sanitizeDocxPreviewHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

export async function convertDocxBufferToPreviewHtml(buffer: Buffer): Promise<{
  html: string;
  messages: Array<{ type: string; message: string }>;
}> {
  const result = await mammoth.convertToHtml({ buffer });
  return {
    html: sanitizeDocxPreviewHtml(result.value),
    messages: result.messages.map((message) => ({
      type: message.type,
      message: message.message,
    })),
  };
}
