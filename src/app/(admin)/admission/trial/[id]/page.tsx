"use client";

import Link from "next/link";
import { PageHead } from "@/components/chrome";
import FormulirTrial from "@/components/formulir-trial";

export default function FormulirTrialDetailPage({ params }: { params: { id: string } }) {
  return (
    <>
      <PageHead
        title="Formulir Trial"
        subtitle="Isian formulir, hasil Filter Arah & Filter SAM, ACC guru, dan catatan Discovery"
      />
      <p style={{ marginTop: 0 }}><Link href="/admission/trial">← Daftar Formulir Trial</Link></p>
      <FormulirTrial formId={params.id} />
    </>
  );
}
