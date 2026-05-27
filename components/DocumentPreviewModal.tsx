"use client";

export interface DocumentPreviewState {
  title: string;
  html: string;
  loading: boolean;
  error?: string;
}

interface DocumentPreviewModalProps {
  preview: DocumentPreviewState | null;
  onClose: () => void;
}

export function DocumentPreviewModal({ preview, onClose }: DocumentPreviewModalProps) {
  if (!preview) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Visualizar documento</h2>
            <p className="mt-0.5 text-sm text-gray-500">{preview.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Fechar
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-gray-100 p-4 sm:p-6">
          <div className="mx-auto min-h-[70vh] max-w-[860px] rounded-lg bg-white px-8 py-10 shadow">
            {preview.loading && (
              <p className="text-sm text-gray-500">Carregando preview...</p>
            )}
            {!preview.loading && preview.error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {preview.error}
              </p>
            )}
            {!preview.loading && !preview.error && (
              <div
                className="docx-preview-content"
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
