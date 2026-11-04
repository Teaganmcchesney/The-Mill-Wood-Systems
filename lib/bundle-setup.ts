export const bundleSetupMessage =
  "Bundle uploads are not ready yet. An administrator needs to complete the bundle-tracking database setup before both PDFs can be imported.";
export function missingBundleSetup(
  error: { code?: string; message?: string } | null | undefined,
) {
  return (
    !!error &&
    (["PGRST202", "PGRST205", "42P01", "42883"].includes(error.code ?? "") ||
      /(?:bundles|bundle_import_ready|import_joint_package).*schema cache/i.test(
        error.message ?? "",
      ))
  );
}
