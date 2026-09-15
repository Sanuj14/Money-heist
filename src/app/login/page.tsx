import { Suspense } from "react";
import LoginForm from "./LoginForm";
import { ResumeBanner } from "@/components/ResumeBanner";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <>
      <ResumeBanner className="px-4 pt-6" />
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </>
  );
}
