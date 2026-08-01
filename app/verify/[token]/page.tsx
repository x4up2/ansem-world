import { notFound } from "next/navigation";

import { LandingPage } from "@/components/landing-page";

const TOKEN_RE = /^[0-9a-f]{64}$/i;

export default async function VerifyPage({
  params
}: {
  params: Promise<{
    token: string;
  }>;
}) {
  const { token } = await params;

  if (!TOKEN_RE.test(token)) {
    notFound();
  }

  return (
    <LandingPage
      initialVerificationToken={token}
    />
  );
}
