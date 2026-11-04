import type * as PdfJs from "pdfjs-dist";
let promise: Promise<typeof PdfJs> | undefined;
export function loadPdfJs() {
  // Load the matching library and worker as static browser assets. Neither is parsed by Next's server bundler.
  const libraryPath = "/pdfjs/pdf.min.mjs";
  return (promise ??= (
    import(/* webpackIgnore: true */ libraryPath) as Promise<typeof PdfJs>
  )
    .then((pdf) => {
      pdf.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
      return pdf;
    })
    .catch((error) => {
      promise = undefined;
      throw error;
    }));
}
