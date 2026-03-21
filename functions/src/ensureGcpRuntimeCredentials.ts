/**
 * Firebase Admin uses Application Default Credentials. If `GOOGLE_APPLICATION_CREDENTIALS`
 * is set (often from a local `.env` used for development), that path/key is bundled into
 * deployed Cloud Functions and Admin SDK will use it — typically a dev key without
 * Firebase Auth Admin permissions → `auth/insufficient-permission` on Identity Toolkit.
 *
 * On Cloud Run / Cloud Functions (Gen2), strip it so the runtime uses the function's
 * service account from the metadata server instead.
 */
const isDeployedGcpRuntime =
  !!(process.env.K_SERVICE || process.env.FUNCTION_TARGET) &&
  !process.env.FUNCTIONS_EMULATOR;

if (isDeployedGcpRuntime && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.warn(
    "[functions] Removing GOOGLE_APPLICATION_CREDENTIALS in deployed runtime so Firebase Admin uses the Cloud Functions service account."
  );
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
}
