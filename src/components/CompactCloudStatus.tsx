import { useEffect, useState } from "react";
import { CLOUD_STATE_EVENT, getCloudState, type CloudState } from "../sync/cloudSync";
import { CloudStatusCard } from "./CloudStatusCard";

export function CompactCloudStatus() {
  const [state, setState] = useState<CloudState>(() => getCloudState());
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const update = (event: Event) => setState((event as CustomEvent<CloudState>).detail);
    const connectionChanged = () => setState({ ...getCloudState() });
    window.addEventListener(CLOUD_STATE_EVENT, update);
    window.addEventListener("online", connectionChanged);
    window.addEventListener("offline", connectionChanged);
    return () => {
      window.removeEventListener(CLOUD_STATE_EVENT, update);
      window.removeEventListener("online", connectionChanged);
      window.removeEventListener("offline", connectionChanged);
    };
  }, []);

  const problem = state.lastError || !navigator.onLine || (state.configured && !state.session);
  const label = !navigator.onLine
    ? "オフライン・端末保存"
    : state.lastError
      ? "同期エラー・端末保存済み"
      : state.syncing
        ? "同期中"
        : state.session
          ? "同期済み"
          : state.configured ? "ログインが必要" : "端末保存";
  return <div className="compact-sync-wrap">
    <button className={`compact-sync ${problem ? "problem" : ""}`} onClick={() => setOpen((value) => !value)} aria-expanded={open}><i />{label}</button>
    {open && <div className="cloud-popover"><button className="cloud-popover-close" onClick={() => setOpen(false)}>閉じる</button><CloudStatusCard /></div>}
  </div>;
}
