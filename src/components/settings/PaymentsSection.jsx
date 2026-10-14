import PayoutSetup from "@/components/PayoutSetup";
import SavedPaymentMethods from "@/components/settings/SavedPaymentMethods";

export default function PaymentsSection({ user }) {
  return <div className="space-y-4">
    <SavedPaymentMethods />
    <PayoutSetup user={user} onRefresh={() => window.location.reload()} />
  </div>;
}
