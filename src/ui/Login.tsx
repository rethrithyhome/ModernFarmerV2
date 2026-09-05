import { useState } from "react";
import type { CloudConfig } from "../lib/cloud";
import { signIn, type Session } from "../lib/auth";
import { Button, Field, Text } from "./kit";

export function Login({ cfg, onSignedIn }: { cfg: CloudConfig; onSignedIn: (session: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("សូមបំពេញអ៊ីមែល និងលេខសម្ងាត់");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const session = await signIn(cfg, email.trim(), password);
      onSignedIn(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "អ៊ីមែល ឬលេខសម្ងាត់មិនត្រឹមត្រូវ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="firstrun">
      <div className="firstrun-card">
        <h1>ចូលប្រើប្រាស់</h1>
        <p className="panel-hint">ទិន្នន័យរបស់ Workspace នេះទាមទារគណនី — សូមចូលដើម្បីបន្ត។</p>

        <form onSubmit={submit} className="form-grid" style={{ marginTop: 16, textAlign: "left" }}>
          <Field label="អ៊ីមែល" wide>
            <Text value={email} onChange={setEmail} placeholder="name@modernfarmer.kh" type="email" />
          </Field>
          <Field label="លេខសម្ងាត់" wide>
            <Text value={password} onChange={setPassword} placeholder="••••••••" type="password" />
          </Field>
          {error && (
            <p className="panel-hint" style={{ color: "var(--clay)" }}>
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" full disabled={busy}>
            {busy ? "កំពុងចូល..." : "ចូលប្រើប្រាស់"}
          </Button>
        </form>
      </div>
    </div>
  );
}
