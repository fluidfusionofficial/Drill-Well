"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center bg-canvas p-6 text-center">
      <div className="max-w-md">
        <p className="text-xs font-semibold text-ink-3">NWIS · Decision support</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Opening command center…</h1>
        <p className="mt-2 text-sm text-ink-2">Nearby Wells Intelligence System for offset well operations</p>
        <Link
          href="/dashboard"
          className="mt-5 inline-block rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover"
        >
          Open command center
        </Link>
      </div>
    </main>
  );
}
