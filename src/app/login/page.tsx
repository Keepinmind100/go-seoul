// 로그인: 이메일·비밀번호(Supabase Auth). 계정은 Supabase 콘솔에서 직접 만든다(회원가입 없음).
"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { Button, ErrorText, Field, Input } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/env";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await supabase().auth.signInWithPassword({ email, password });
    setPending(false);
    if (error) return setError(new Error(error.message === "Invalid login credentials" ? "이메일 또는 비밀번호가 맞지 않습니다." : error.message));
    router.replace("/");
    router.refresh();
  };

  return (
    // 하루에 한 번 볼까 말까 한 화면이라 카드가 살짝 떠오르며 나타나도 된다. 위쪽에 남산초록 빛을 옅게 깐다
    <div className="grid flex-1 place-items-center bg-[radial-gradient(56rem_32rem_at_50%_-8%,var(--color-brand-100),transparent_70%)] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 shadow-pop transition-[opacity,transform] duration-500 ease-out-strong starting:translate-y-2 starting:opacity-0">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-brand-600 text-on-color">
            <Icon name="building" className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">고서울</h1>
            <p className="text-sm text-slate-500">둘이 함께 고르는 우리 집</p>
          </div>
        </div>
        {!supabaseConfigured() ? (
          <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            Supabase 접속 정보가 없습니다. <code>.env.local</code>에 <code>NEXT_PUBLIC_SUPABASE_URL</code>과 <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>를 넣고 다시
            실행하세요.
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="이메일">
              <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="비밀번호">
              <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <ErrorText error={error} />
            <Button type="submit" variant="primary" disabled={pending} className="mt-1">
              {pending ? "로그인 중…" : "로그인"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
