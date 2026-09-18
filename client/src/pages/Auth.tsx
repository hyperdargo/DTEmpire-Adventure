import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Button } from "../components/ui.tsx";
import { api, errorMessage } from "../lib/api.ts";
import { meKey } from "../state/game.ts";

const OAUTH_ERRORS: Record<string, string> = {
  discord: "Discord sign-in didn't complete. Try again.",
  discord_taken: "That Discord account is already linked to another hero.",
};

export function AuthPage({ mode }: { mode: "login" | "register" | "reset" }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const providers = useQuery({ queryKey: ["providers"], queryFn: () => api.get<{ discord: boolean; email: boolean }>("/api/auth/providers") });
  const [error, setError] = useState<string | null>(OAUTH_ERRORS[params.get("error") ?? ""] ?? null);
  const [busy, setBusy] = useState(false);
  const [resetStage, setResetStage] = useState<"request" | "confirm">("request");
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const v = (k: string) => String(form.get(k) ?? "");
    setError(null);
    if (mode === "register" && v("password") !== v("confirm")) {
      setError("The passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") await api.post("/api/auth/login", { username: v("username"), password: v("password") });
      else if (mode === "register") await api.post("/api/auth/register", { username: v("username"), password: v("password"), email: v("email") });
      else if (resetStage === "request") {
        await api.post("/api/auth/reset/request", { email: v("email") });
        setResetStage("confirm");
        setNotice("If that email belongs to a hero, a 6-digit code is on its way.");
        setBusy(false);
        return;
      } else {
        await api.post("/api/auth/reset/confirm", { email: v("email"), code: v("code"), password: v("password") });
        setNotice("Password updated. Sign in with your new password.");
        navigate("/login");
        setBusy(false);
        return;
      }
      await qc.invalidateQueries({ queryKey: meKey });
      navigate("/");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const title = mode === "login" ? "Welcome back" : mode === "register" ? "Join the realm" : "Reset your password";

  return (
    <div className="auth">
      <Link to="/" className="auth__crest" aria-label="DTEmpire Adventure home">
        <img src="/logo.png" alt="" width={120} height={120} />
      </Link>
      <form className="auth__card panel" onSubmit={(e) => void submit(e)} noValidate={false}>
        <h1>{title}</h1>
        {notice && <p className="banner banner--info" role="status">{notice}</p>}
        {error && <p className="banner" role="alert">{error}</p>}

        {mode !== "reset" && (
          <label className="field">
            <span>Username</span>
            <input className="input" name="username" autoComplete="username" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" title="3-20 letters, numbers or underscores" />
          </label>
        )}
        {(mode === "register" || mode === "reset") && (
          <label className="field">
            <span>Email {mode === "register" && <em className="faint">(optional, lets you reset your password)</em>}</span>
            <input className="input" name="email" type="email" autoComplete="email" required={mode === "reset"} maxLength={200} />
          </label>
        )}
        {mode === "reset" && resetStage === "confirm" && (
          <label className="field">
            <span>6-digit code</span>
            <input className="input" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" required />
          </label>
        )}
        {(mode !== "reset" || resetStage === "confirm") && (
          <label className="field">
            <span>{mode === "reset" ? "New password" : "Password"}</span>
            <input className="input" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "login" ? 1 : 8} maxLength={200} />
            {mode !== "login" && <span className="field-hint">At least 8 characters.</span>}
          </label>
        )}
        {mode === "register" && (
          <label className="field">
            <span>Confirm password</span>
            <input className="input" name="confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={200} />
          </label>
        )}

        <Button type="submit" variant="primary" size="lg" block loading={busy}>
          {mode === "login" ? "Sign in" : mode === "register" ? "Create account" : resetStage === "request" ? "Send code" : "Set new password"}
        </Button>

        {providers.data?.discord && mode !== "reset" && (
          <a className="btn btn--block btn--discord" href="/api/auth/discord/start">Continue with Discord</a>
        )}

        <div className="auth__links">
          {mode === "login" && <><Link to="/register">Create an account</Link>{providers.data?.email && <Link to="/reset">Forgot password?</Link>}</>}
          {mode === "register" && <Link to="/login">I already have an account</Link>}
          {mode === "reset" && <Link to="/login">Back to sign in</Link>}
        </div>
      </form>
    </div>
  );
}
