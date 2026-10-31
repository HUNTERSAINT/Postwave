"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";

type Stats = {
  users: { total: number; verified: number; trialing: number; paid: number; granted: number; free: number; suspiciousTrials: number };
  conversion: { trialsStarted: number; converted: number; rate: number };
  revenue: { currency: string; amountMinor: number; payments: number }[];
  failedPostsLast7Days: number;
  exchangeRates: { currency: string; rate: number; source: string; fetchedAt: string }[];
};
type AdminUser = {
  id: string; email: string; name: string; role: string; emailVerified: boolean;
  plan: string; planStatus: string; planSource: string; paidPlan: string; hasPaidSubscription: boolean;
  trialEndsAt: string | null; trialSuspicious: boolean; grantExpiresAt: string | null; grantNote: string | null;
  grantBillingPaused: boolean; createdAt: string;
};
type AuditEntry = { id: string; action: string; plan: string | null; duration: string | null; note: string | null; createdAt: string; adminEmail: string; userEmail: string };
type Failure = { id: string; platform: string; errorMessage: string | null; attempts: number; updatedAt: string; content: string; userEmail: string };
type ApiPayload = { message?: string; requiresConfirmation?: boolean };

class ApiFailure extends Error {
  constructor(message: string, public status: number, public payload: ApiPayload) { super(message); }
}

async function call<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as ApiPayload;
  if (!response.ok) throw new ApiFailure(payload.message || `Request failed (${response.status})`, response.status, payload);
  return payload as T;
}

function when(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}
function money(minor: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(minor / 100); }
  catch { return `${currency} ${(minor / 100).toLocaleString()}`; }
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mt-6 rounded-2xl border border-[#dce8eb] bg-white p-5 shadow-sm">
    <h2 className="text-lg font-extrabold">{title}</h2>
    <div className="mt-4">{children}</div>
  </section>;
}
function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <div className="rounded-xl border border-[#e2edf0] bg-[#f9fcfc] p-4">
    <p className="text-[11px] font-bold uppercase tracking-wider text-[#8397a2]">{label}</p>
    <p className="mt-1 text-2xl font-extrabold">{value}</p>
    {hint && <p className="mt-0.5 text-xs text-[#8397a2]">{hint}</p>}
  </div>;
}

function UserPanel({ user, onChanged, onMessage, onError }: { user: AdminUser; onChanged: () => void; onMessage: (text: string) => void; onError: (text: string) => void }) {
  const [plan, setPlan] = useState("pro");
  const [duration, setDuration] = useState("30d");
  const [note, setNote] = useState("");
  const [pauseBilling, setPauseBilling] = useState(true);
  const [days, setDays] = useState(7);
  const [warning, setWarning] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<string>) {
    setBusy(true);
    onError("");
    try { onMessage(await action()); onChanged(); }
    catch (error) { onError(error instanceof Error ? error.message : "Something went wrong."); }
    finally { setBusy(false); }
  }

  async function grant(confirm: boolean) {
    setBusy(true);
    onError("");
    try {
      await call(`/api/admin/users/${user.id}/grant`, { plan, duration, note: note || undefined, pauseBilling, confirmPaidOverride: confirm });
      setWarning("");
      onMessage(`Granted ${plan} to ${user.email}.`);
      onChanged();
    } catch (error) {
      if (error instanceof ApiFailure && error.payload.requiresConfirmation) setWarning(error.message);
      else onError(error instanceof Error ? error.message : "Could not grant the plan.");
    } finally { setBusy(false); }
  }

  const select = "h-10 rounded-xl border border-[#d8e6eb] bg-white px-3 text-sm";
  const button = "rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50";
  return <div className="mt-3 grid gap-5 rounded-xl border border-[#e2edf0] bg-[#f9fcfc] p-4 md:grid-cols-2">
    <div>
      <p className="text-sm font-bold">Grant a plan</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-xs font-semibold text-[#587285]">Plan
          <select className={select} value={plan} onChange={(event) => setPlan(event.target.value)}><option value="free">Free</option><option value="pro">Pro</option><option value="business">Business</option></select></label>
        <label className="grid gap-1 text-xs font-semibold text-[#587285]">Duration
          <select className={select} value={duration} onChange={(event) => setDuration(event.target.value)}><option value="7d">7 days</option><option value="30d">30 days</option><option value="90d">90 days</option><option value="1y">1 year</option><option value="none">No expiry</option></select></label>
      </div>
      <label className="mt-3 grid gap-1 text-xs font-semibold text-[#587285]">Internal note (optional)
        <input className={select} maxLength={500} placeholder="partner, giveaway, support compensation…" value={note} onChange={(event) => setNote(event.target.value)} /></label>
      {user.hasPaidSubscription && <label className="mt-3 flex items-start gap-2 text-xs text-[#587285]"><input type="checkbox" className="mt-0.5" checked={pauseBilling} onChange={(event) => setPauseBilling(event.target.checked)} /> Pause this user&apos;s billing during the grant (renewal date moves back by the grant length)</label>}
      {warning && <div role="alert" className="mt-3 rounded-xl border border-[#f0d9a8] bg-[#fff9ea] p-3 text-xs text-[#7a5a14]">{warning}<button disabled={busy} onClick={() => void grant(true)} className={`${button} mt-2 block bg-[#b7791f] text-white`}>Confirm and grant</button></div>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => void grant(false)} className={`${button} bg-[#176f98] text-white hover:bg-[#125c7d]`}>Grant plan</button>
        {user.planSource === "admin_grant" && <button disabled={busy} onClick={() => void run(async () => { await call(`/api/admin/users/${user.id}/revoke`, {}); return `Revoked the grant for ${user.email}.`; })} className={`${button} border border-[#d8e6eb] text-[#48677a]`}>Revoke grant</button>}
        {user.planSource === "trial" && <button disabled={busy} onClick={() => void run(async () => { await call(`/api/admin/users/${user.id}/end-trial`, {}); return `Ended the trial for ${user.email}. They are now on Free.`; })} className={`${button} border border-[#d8e6eb] text-[#48677a]`}>End trial now</button>}
        {user.planSource === "paid" && <p className="self-center text-xs text-[#718696]">This user pays for their plan. Cancel it from their billing, or grant a different plan.</p>}
      </div>
    </div>
    <div>
      <p className="text-sm font-bold">Extend trial</p>
      <p className="mt-1 text-xs text-[#718696]">Only for users on the Free plan or in a trial. Current trial end: {when(user.trialEndsAt)}</p>
      <div className="mt-3 flex items-end gap-3">
        <label className="grid gap-1 text-xs font-semibold text-[#587285]">Days
          <input className={`${select} w-24`} type="number" min={1} max={90} value={days} onChange={(event) => setDays(Number(event.target.value))} /></label>
        <button disabled={busy || !Number.isInteger(days) || days < 1 || days > 90} onClick={() => void run(async () => { await call(`/api/admin/users/${user.id}/trial`, { days }); return `Extended the trial for ${user.email} by ${days} days.`; })} className={`${button} border border-[#d8e6eb] text-[#48677a]`}>Extend trial</button>
      </div>
      {user.grantNote && <p className="mt-4 text-xs text-[#718696]">Grant note: {user.grantNote}</p>}
    </div>
  </div>;
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [query, setQuery] = useState("");
  const [openUser, setOpenUser] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [rateCurrency, setRateCurrency] = useState("NGN");
  const [rateValue, setRateValue] = useState("");

  const load = useCallback(async (search: string) => {
    try {
      const [s, u, a, f] = await Promise.all([
        call<Stats>("/api/admin/stats"),
        call<{ users: AdminUser[] }>(`/api/admin/users?q=${encodeURIComponent(search)}`),
        call<{ entries: AuditEntry[] }>("/api/admin/audit"),
        call<{ failures: Failure[] }>("/api/admin/failed-posts"),
      ]);
      setStats(s); setUsers(u.users); setAudit(a.entries); setFailures(f.failures);
    } catch (e) {
      if (e instanceof ApiFailure && (e.status === 401 || e.status === 403)) setForbidden(true);
      else setError(e instanceof Error ? e.message : "Could not load the dashboard.");
    }
  }, []);

  useEffect(() => { void load(""); }, [load]);

  async function setRate(event: FormEvent) {
    event.preventDefault();
    setError(""); setMessage("");
    try {
      await call("/api/admin/exchange-rate", { currency: rateCurrency, rate: Number(rateValue) });
      setMessage(`Set 1 USD = ${rateValue} ${rateCurrency}. The next daily refresh will not overwrite it today.`);
      setRateValue("");
      await load(query);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not set the rate."); }
  }

  if (forbidden) return <main className="min-h-screen bg-[#f5f9fa] px-4 py-16 text-center text-[#17364c]"><h1 className="text-2xl font-extrabold">Admin access required</h1><p className="mt-2 text-sm text-[#718696]">Sign in with an admin account to view this page.</p><a href="/login" className="mt-5 inline-block text-sm font-bold text-[#287c91]">Go to sign in</a></main>;

  const input = "h-10 rounded-xl border border-[#d8e6eb] bg-white px-3 text-sm";
  const th = "px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[#8397a2]";
  const td = "px-3 py-2 align-top text-xs text-[#33556a]";
  return <main className="min-h-screen bg-[#f5f9fa] px-4 py-10 text-[#17364c] sm:px-7">
    <div className="mx-auto max-w-6xl">
      <a href="/dashboard" className="text-sm font-semibold text-[#287c91] hover:underline">← Back to Postwave</a>
      <h1 className="mt-5 text-3xl font-extrabold tracking-tight">Admin dashboard</h1>
      {error && <div role="alert" className="mt-5 rounded-xl border border-[#f0c9c1] bg-[#fff5f2] p-3 text-sm text-[#a34c3d]">{error}</div>}
      {message && <div role="status" className="mt-5 rounded-xl border border-[#b9e4d9] bg-[#effaf6] p-3 text-sm text-[#246c5b]">{message}</div>}

      <Card title="Overview">
        {!stats ? <p className="text-sm text-[#718696]">Loading…</p> : <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Users" value={stats.users.total} hint={`${stats.users.verified} verified`} />
            <Stat label="In trial" value={stats.users.trialing} hint={`${stats.users.suspiciousTrials} flagged`} />
            <Stat label="Paying" value={stats.users.paid} />
            <Stat label="Complimentary" value={stats.users.granted} />
            <Stat label="Free" value={stats.users.free} />
            <Stat label="Trial → paid" value={`${stats.conversion.rate}%`} hint={`${stats.conversion.converted} of ${stats.conversion.trialsStarted} trials`} />
            <Stat label="Failed posts (7d)" value={stats.failedPostsLast7Days} />
            <Stat label="Revenue" value={stats.revenue.length ? stats.revenue.map((row) => money(row.amountMinor, row.currency)).join(" · ") : "—"} hint="Successful payments only" />
          </div>
          <p className="mt-3 text-xs text-[#8397a2]">Conversion and revenue exclude anyone who has ever received an admin grant.</p>
        </>}
      </Card>

      <Card title="Users and plans">
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void load(query); }}>
          <input className={`${input} flex-1`} placeholder="Search by email or name" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button className="rounded-xl bg-[#176f98] px-4 text-sm font-bold text-white hover:bg-[#125c7d]">Search</button>
        </form>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead><tr className="border-b border-[#e2edf0]"><th className={th}>User</th><th className={th}>Plan</th><th className={th}>Source</th><th className={th}>Ends</th><th className={th}></th></tr></thead>
            <tbody>{users.map((user) => <tr key={user.id} className="border-b border-[#eef4f6]"><td colSpan={5} className="p-0">
              <div className="grid grid-cols-[1.6fr_.8fr_.9fr_1fr_auto] items-center">
                <div className={td}><div className="font-bold text-[#17364c]">{user.name}{user.role === "admin" ? " (admin)" : ""}</div><div>{user.email}{user.emailVerified ? "" : " · unverified"}{user.trialSuspicious ? " · flagged trial" : ""}</div></div>
                <div className={`${td} capitalize`}>{user.plan}</div>
                <div className={td}>{user.planSource === "admin_grant" ? "Granted" : user.planSource}</div>
                <div className={td}>{user.planSource === "admin_grant" ? (user.grantExpiresAt ? when(user.grantExpiresAt) : "No expiry") : user.planSource === "trial" ? when(user.trialEndsAt) : "—"}</div>
                <div className={td}><button onClick={() => setOpenUser(openUser === user.id ? "" : user.id)} className="font-bold text-[#287c91]">{openUser === user.id ? "Close" : "Manage"}</button></div>
              </div>
              {openUser === user.id && <div className="px-3 pb-3"><UserPanel user={user} onChanged={() => void load(query)} onMessage={setMessage} onError={setError} /></div>}
            </td></tr>)}</tbody>
          </table>
          {!users.length && <p className="p-3 text-sm text-[#718696]">No users found.</p>}
        </div>
      </Card>

      <Card title="Exchange rate">
        {stats && <p className="text-xs text-[#718696]">{stats.exchangeRates.map((row) => `${row.currency} ${row.rate.toLocaleString()} (${row.source}, ${when(row.fetchedAt)})`).join(" · ") || "No rates saved yet."}</p>}
        <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(event) => void setRate(event)}>
          <label className="grid gap-1 text-xs font-semibold text-[#587285]">Currency
            <select className={input} value={rateCurrency} onChange={(event) => setRateCurrency(event.target.value)}>{["NGN", "GBP", "EUR", "GHS", "KES", "ZAR"].map((code) => <option key={code}>{code}</option>)}</select></label>
          <label className="grid gap-1 text-xs font-semibold text-[#587285]">1 USD =
            <input className={`${input} w-40`} type="number" step="any" min="0" value={rateValue} onChange={(event) => setRateValue(event.target.value)} required /></label>
          <button className="h-10 rounded-xl border border-[#d8e6eb] px-4 text-sm font-bold text-[#48677a]">Set manual rate</button>
        </form>
      </Card>

      <Card title="Failed posts">
        {!failures.length ? <p className="text-sm text-[#718696]">No failed posts.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[640px] border-collapse">
          <thead><tr className="border-b border-[#e2edf0]"><th className={th}>User</th><th className={th}>Platform</th><th className={th}>Error</th><th className={th}>When</th></tr></thead>
          <tbody>{failures.map((row) => <tr key={row.id} className="border-b border-[#eef4f6]"><td className={td}>{row.userEmail}</td><td className={td}>{row.platform}</td><td className={td}>{row.errorMessage || "No error message"}<div className="text-[#8397a2]">{row.content}</div></td><td className={td}>{when(row.updatedAt)}</td></tr>)}</tbody>
        </table></div>}
      </Card>

      <Card title="Audit log">
        {!audit.length ? <p className="text-sm text-[#718696]">Nothing logged yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[640px] border-collapse">
          <thead><tr className="border-b border-[#e2edf0]"><th className={th}>When</th><th className={th}>Admin</th><th className={th}>Action</th><th className={th}>User</th><th className={th}>Details</th></tr></thead>
          <tbody>{audit.map((row) => <tr key={row.id} className="border-b border-[#eef4f6]"><td className={td}>{when(row.createdAt)}</td><td className={td}>{row.adminEmail}</td><td className={td}>{row.action}</td><td className={td}>{row.userEmail}</td><td className={td}>{[row.plan, row.duration, row.note].filter(Boolean).join(" · ") || "—"}</td></tr>)}</tbody>
        </table></div>}
      </Card>
      <p className="mt-8 text-center text-xs text-[#8397a2]">Postwave by Mazi Saint Concepts</p>
    </div>
  </main>;
}
