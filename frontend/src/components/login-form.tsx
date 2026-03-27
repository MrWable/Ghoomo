"use client";

import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { login, loginWithGoogle, type AuthSession } from "@/lib/api";
import { getPostLoginPath, storeSession } from "@/lib/auth";

const ADMIN_DEMO = {
  email: "admin@ghoomo.dev",
  password: "demo12345",
};

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";

type LoginFormProps = {
  nextPath?: string;
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(ADMIN_DEMO.email);
  const [password, setPassword] = useState(ADMIN_DEMO.password);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleHandlerRef = useRef<(response: GoogleCredentialResponse) => void>(
    () => undefined,
  );
  const googleEnabled = GOOGLE_CLIENT_ID.length > 0;

  async function finishLogin(session: AuthSession) {
    storeSession(session);

    const safeNextPath = nextPath && nextPath.startsWith("/") ? nextPath : null;
    const redirectTo =
      session.user.role === "ADMIN" && safeNextPath
        ? safeNextPath
        : getPostLoginPath(session.user.role);

    router.replace(redirectTo);
    router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const session = await login({ email, password });
      await finishLogin(session);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to log in.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  googleHandlerRef.current = (response) => {
    void (async () => {
      if (!response.credential) {
        setError("Google did not return a sign-in credential.");
        return;
      }

      setIsGoogleSubmitting(true);
      setError(null);

      try {
        const session = await loginWithGoogle(response.credential);
        await finishLogin(session);
      } catch (submissionError) {
        setError(
          submissionError instanceof Error
            ? submissionError.message
            : "Unable to log in with Google.",
        );
      } finally {
        setIsGoogleSubmitting(false);
      }
    })();
  };

  useEffect(() => {
    if (
      !googleEnabled ||
      !isGoogleReady ||
      !googleButtonRef.current ||
      !window.google?.accounts.id
    ) {
      return;
    }

    googleButtonRef.current.innerHTML = "";
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      use_fedcm_for_button: true,
      button_auto_select: true,
      callback: (response) => {
        googleHandlerRef.current(response);
      },
    });
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: "outline",
      size: "medium",
      text: "continue_with",
      shape: "pill",
      width: 220,
    });
  }, [googleEnabled, isGoogleReady]);

  return (
    <div className="glass-panel rounded-[36px] p-8 md:p-10">
      {googleEnabled ? (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onLoad={() => setIsGoogleReady(true)}
        />
      ) : null}

      <p className="eyebrow">Account access</p>
      <h1 className="section-title mt-4 text-[2.5rem]">Login to Ghoomo</h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-[var(--muted)]">
        Admin login is available now. Use the seeded demo credentials below or
        sign in with any existing backend account.
      </p>

      <div className="panel-tint mt-6 rounded-[24px] p-5">
        <p className="text-sm font-semibold">Seeded admin credentials</p>
        <p className="mt-2 font-mono text-sm text-[var(--muted)]">
          {ADMIN_DEMO.email}
        </p>
        <p className="font-mono text-sm text-[var(--muted)]">
          {ADMIN_DEMO.password}
        </p>
      </div>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="field-control w-full rounded-2xl px-4 py-3 outline-none"
            placeholder="admin@ghoomo.dev"
            autoComplete="email"
            required
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field-control w-full rounded-2xl px-4 py-3 outline-none"
            placeholder="demo12345"
            autoComplete="current-password"
            required
          />
        </label>

        {error ? (
          <div className="message-error rounded-2xl px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || isGoogleSubmitting}
          className="button-primary rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Signing in..." : "Login"}
        </button>
      </form>

      {googleEnabled ? (
        <div className="mt-8">
          <div className="flex items-center gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-[var(--muted)]">
            <span className="h-px flex-1 bg-[var(--hairline)]" />
            <span>Or log in</span>
            <span className="h-px flex-1 bg-[var(--hairline)]" />
          </div>
          <div className="google-auth-button-slot mt-5">
            <div className="google-auth-button-shell">
              <div className="google-auth-button-visual" aria-hidden="true">
                <span className="google-auth-button-visual__mark" aria-hidden="true">
                  <span className="google-auth-button-visual__mark-g">G</span>
                </span>
                <span>Continue with Google</span>
              </div>
              <div
                ref={googleButtonRef}
                className="google-auth-button google-auth-button--overlay min-h-10"
              />
            </div>
          </div>
          {isGoogleSubmitting ? (
            <p className="mt-3 text-center text-sm text-[var(--muted)]">
              Signing in with Google...
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-8 text-sm text-[var(--muted)]">
          Add <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> to enable Google login.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-4 text-sm text-[var(--muted)]">
        <Link href="/">Back to home</Link>
        <Link href="/register">Register user</Link>
        <Link href="/guides/register">Register as guide</Link>
      </div>
    </div>
  );
}
