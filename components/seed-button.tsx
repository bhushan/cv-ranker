"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { request } from "@/lib/client-api";
export function SeedButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await request("/api/demo/seed", "POST", {});
            router.refresh();
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Could not add sample candidates.",
            );
            setBusy(false);
          }
        }}
      >
        {busy ? "Adding sample candidates…" : "Add 12 sample candidates"}
      </Button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
