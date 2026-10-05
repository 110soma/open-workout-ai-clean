import { useEffect, useState, type FormEvent } from "react";
import { CLOUD_STATE_EVENT, getCloudState, signIn, signOut, type CloudState } from "../sync/cloudSync";

export function CloudStatusCard() {
  const [state, setState] = useState<CloudState>(() => getCloudState());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const update = (event: Event) => setState((event as CustomEvent<CloudState>).detail);
    window.addEventListener(CLOUD_STATE_EVENT, update);
    return () => window.removeEventListener(CLOUD_STATE_EVENT, update);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      setPassword("");
    } catch {
      setError("ログインできませんでした。メールアドレスとパスワードを確認してください。");
    } finally {
      setBusy(false);
    }
  }

  if (!state.configured) {
    return <article className="cloud-card"><div><strong>クラウド同期</strong><span>Supabase未設定</span></div><p>端末内保存は通常どおり使用できます。</p></article>;
  }
  if (state.session) {
    return (
      <article className="cloud-card connected">
        <div><strong>クラウド同期</strong><span>{state.syncing ? "同期中" : state.lastError ? "同期エラー" : "接続済み"}</span></div>
        <p>{state.session.user.email}</p>
        <small>メニュー：{state.prescriptionRevision ? "クラウド取得済み" : "クラウド未取得"}</small>
        {state.lastError && <small>端末内データは保持されています。次回、自動で再試行します。</small>}
        <button onClick={() => void signOut()}>ログアウト</button>
      </article>
    );
  }
  return (
    <article className="cloud-card">
      <div><strong>クラウド同期</strong><span>ログインが必要</span></div>
      <form onSubmit={(event) => void submit(event)}>
        <label>メールアドレス<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>パスワード<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error && <small>{error}</small>}
        <button disabled={busy}>{busy ? "ログイン中…" : "ログイン"}</button>
      </form>
    </article>
  );
}
