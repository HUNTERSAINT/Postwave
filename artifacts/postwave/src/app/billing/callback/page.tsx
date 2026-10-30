import { BillingCallback } from "@/components/billing-callback";

export default async function BillingCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const params = await searchParams;
  return <BillingCallback reference={params.reference ?? params.trxref ?? ""} />;
}
