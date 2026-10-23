import { useAuthRecovery } from "../../hooks/useAuthRecovery";
import { useLocale } from "../../hooks/useLocale";
import { basePath } from "../../lib/basePath";

export default function AuthRecoveryNotice() {
  const { status } = useAuthRecovery();
  const { t } = useLocale();
  if (status === "active") return null;
  return (
    <aside role={status === "expired" ? "alert" : "status"} className="auth-recovery-notice mb-6 rounded-xl border p-4">
      <h2 className="font-semibold mb-2">{status === "expired" ? t.authRecovery.expiredTitle : t.authRecovery.restoredTitle}</h2>
      <p className="text-sm leading-relaxed">{status === "expired" ? t.authRecovery.expired : t.authRecovery.restored}</p>
      {status === "expired" && <a className="inline-block mt-3 font-semibold underline underline-offset-4" target="_blank" rel="noopener noreferrer" href={`${basePath}/admin/login?reauth=1`}>{t.authRecovery.signIn}</a>}
    </aside>
  );
}
