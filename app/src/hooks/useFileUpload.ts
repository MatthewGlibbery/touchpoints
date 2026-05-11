import { useCallback } from 'react';

export function useFileUpload(onText: (text: string, fileName: string) => void) {
  const handleFile = useCallback(
    async (file: File) => {
      if (file.type === 'text/plain') {
        const text = await file.text();
        onText(text, file.name);
        return;
      }

      if (file.type === 'application/pdf') {
        // Read PDF as text via FileReader — basic extraction for MVP
        const arrayBuffer = await file.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        // Extract readable ASCII text from the PDF binary
        let text = '';
        for (let i = 0; i < uint8.length; i++) {
          const c = uint8[i];
          if (c >= 32 && c <= 126) text += String.fromCharCode(c);
          else if (c === 10 || c === 13) text += '\n';
        }
        // Clean up runs of whitespace
        text = text.replace(/\s{3,}/g, '\n').trim();
        onText(text || 'PDF content could not be fully extracted.', file.name);
        return;
      }

      // For .docx and other formats, fall back to reading as text
      const text = await file.text();
      onText(text, file.name);
    },
    [onText]
  );

  const openPicker = useCallback(
    (accept = '.txt,.pdf,.md,.docx') => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) handleFile(file);
      };
      input.click();
    },
    [handleFile]
  );

  return { openPicker, handleFile };
}
