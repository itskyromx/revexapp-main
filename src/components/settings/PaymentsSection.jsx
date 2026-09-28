import PayoutSetup from "@/components/PayoutSetup";

export default function PaymentsSection({ user }) {
  return <PayoutSetup user={user} onRefresh={() => window.location.reload()} />;
}