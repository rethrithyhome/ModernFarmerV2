import { useEffect, useState } from "react";
import { useDb } from "./lib/useDb";
import { applyContrast, readPrefs, writePrefs } from "./lib/prefs";
import type { Prefs } from "./lib/prefs";
import { FirstRun } from "./ui/FirstRun";
import { Login } from "./ui/Login";
import { clearData, hasNoDataset, resetSeed } from "./lib/store";
import { GROUP_LABEL, PAGE_TITLES, groupNav, mobilePrimary, navForRole } from "./lib/nav";
import type { Go, Section, View } from "./lib/nav";
import { NavIcon } from "./ui/icons";
import { activeLots, alertsFor } from "./lib/engine";
import { setOperator } from "./lib/store";
import { readCloudConfig } from "./lib/cloud";
import { validSession, signOut, fetchMyRole, type Session, type Role } from "./lib/auth";
import { Dashboard } from "./ui/Dashboard";
import { Materials } from "./ui/Materials";
import { Recipes } from "./ui/Recipes";
import { Lots } from "./ui/Lots";
import { Labels } from "./ui/Labels";
import { Plan } from "./ui/Plan";
import { Customers } from "./ui/Customers";
import { Qc } from "./ui/Qc";
import { Finished } from "./ui/Finished";
import { Reports } from "./ui/Reports";
import { CloudBadge } from "./ui/CloudPanel";
import { Settings } from "./ui/Settings";

export function App() {
  const db = useDb();
  const [view, setView] = useState<View>({ section: "dashboard" });
  const [pendingLabel, setPendingLabel] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("lot"),
  );
  const [prefs, setPrefs] = useState<Prefs>(() => readPrefs());
  const [needsChoice, setNeedsChoice] = useState(() => !readPrefs().started && hasNoDataset());

  const cloudCfg = useState(() => readCloudConfig())[0];
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(!cloudCfg);
  const [role, setRole] = useState<Role | null>(null);
  const [roleChecked, setRoleChecked] = useState(!cloudCfg);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!cloudCfg) return;
    validSession(cloudCfg).then((s) => {
      setSession(s);
      setAuthChecked(true);
    });
  }, [cloudCfg]);

  useEffect(() => {
    if (!cloudCfg || !session) return;
    setRoleChecked(false);
    fetchMyRole(cloudCfg, session).then((r) => {
      setRole(r);
      setRoleChecked(true);
    });
  }, [cloudCfg, session]);

  const visibleNav = navForRole(cloudCfg ? role : "admin");

  useEffect(() => applyContrast(prefs.contrast), [prefs.contrast]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const savePrefs = (next: Prefs) => {
    writePrefs(next);
    setPrefs(next);
  };

  const chooseDataset = (choice: "demo" | "blank") => {
    if (choice === "demo") resetSeed();
    else clearData();
    savePrefs({ ...readPrefs(), started: choice });
    setNeedsChoice(false);
  };

  // A scanned QR label carries ?lot=<id>. The dataset may still be loading (or the
  // first-run choice may still be pending), so retry after every data change and only
  // drop the token once it resolves; an unknown lot gets an explanation, not a blank page.
  useEffect(() => {
    if (!pendingLabel || needsChoice) return;
    const lot = db.lots.find((l) => l.id === pendingLabel || l.code === pendingLabel);
    if (lot) {
      setView({ section: "lots", lotId: lot.id });
      setPendingLabel(null);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [db, needsChoice, pendingLabel]);

  const go: Go = (section, opts) => {
    setView({ section, lotId: opts?.lotId });
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const page = PAGE_TITLES[view.section];
  const danger = alertsFor(db).filter((a) => a.level === "danger").length;
  const counts: Partial<Record<Section, number>> = {
    lots: activeLots(db).length,
    qc: db.qcTests.filter((t) => t.result === "fail").length,
    materials: db.materials.filter((m) => !m.archived).length,
    finished: db.products.length,
    recipes: db.recipes.filter((r) => r.status === "active").length,
    customers: db.customers.length,
    plan: db.plans.length,
  };

  if (cloudCfg && !authChecked) {
    return (
      <div className="firstrun">
        <div className="firstrun-card">
          <p className="panel-hint">កំពុងផ្ទៀងផ្ទាត់គណនី...</p>
        </div>
      </div>
    );
  }
  if (cloudCfg && !session) {
    return <Login cfg={cloudCfg} onSignedIn={setSession} />;
  }
  if (cloudCfg && session && !roleChecked) {
    return (
      <div className="firstrun">
        <div className="firstrun-card">
          <p className="panel-hint">កំពុងផ្ទុកសិទ្ធិគណនី...</p>
        </div>
      </div>
    );
  }
  if (cloudCfg && session && roleChecked && !role) {
    return (
      <div className="firstrun">
        <div className="firstrun-card">
          <h1>មិនទាន់មានសិទ្ធិកំណត់</h1>
          <p className="panel-hint">
            គណនី {session.user.email} ចូលបានហើយ ប៉ុន្តែ admin មិនទាន់កំណត់តួនាទី (role) ឲ្យទេ។
            សូមស្នើ admin បើក Supabase → Table Editor → profiles ដើម្បីកំណត់ role ។
          </p>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              signOut();
              setSession(null);
            }}
          >
            ចាកចេញ
          </button>
        </div>
      </div>
    );
  }

  if (needsChoice) return <FirstRun onChoose={chooseDataset} />;

  return (
    <div className="app">
      <aside className="rail">
        <div className="brand">
          <span className="brand-name">កសិករទំនើប</span>
          <span className="brand-sub">Modern Farmer · ប្រព័ន្ធគ្រប់គ្រងផលិតកម្មជីកំប៉ុស្តិ៍</span>
        </div>

        <nav className="nav" aria-label="ម៉ឺនុយសំខាន់">
          {groupNav(visibleNav).map((bucket, i) => (
            <div className="nav-group" key={bucket.group ?? `top-${i}`}>
              {bucket.group && <p className="nav-group-label">{GROUP_LABEL[bucket.group]}</p>}
              {bucket.items.map((item) => (
                <button
                  key={item.section}
                  type="button"
                  className="nav-link"
                  aria-current={view.section === item.section ? "page" : undefined}
                  title={item.full}
                  onClick={() => go(item.section)}
                >
                  <span className="nav-link-main">
                    <NavIcon id={item.section} />
                    {item.label}
                  </span>
                  {counts[item.section] !== undefined && counts[item.section]! > 0 && (
                    <span className="nav-count" aria-label={`${counts[item.section]} កត់ត្រា`}>
                      {counts[item.section]}
                    </span>
                  )}
                  {item.section === "dashboard" && danger > 0 && (
                    <span className="nav-count" aria-label="ការព្រមានសំខាន់">
                      !
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="rail-foot">
          <label className="operator">
            <span>អ្នកកត់ត្រាបច្ចុប្បន្ន</span>
            <input
              value={db.meta.operator}
              placeholder="បញ្ចូលឈ្មោះ"
              onChange={(e) => setOperator(e.target.value)}
            />
          </label>
          <span className="rail-status">
            <span>Lot សកម្ម {activeLots(db).length} · ការព្រមាន {alertsFor(db).length}</span>
            <CloudBadge />
          </span>
          {cloudCfg && session && (
            <button
              type="button"
              className="rail-toggle"
              title={session.user.email}
              onClick={() => {
                signOut();
                setSession(null);
              }}
            >
              <span>{session.user.email}</span>
              <span className="nav-count">ចាកចេញ</span>
            </button>
          )}
          <button
            type="button"
            className="rail-toggle"
            title="បង្កើនកម្រិតពណ៌ contrast ដើម្បីអានខាងក្រោមពន្លឺថ្ងៃ"
            onClick={() => savePrefs({ ...prefs, contrast: prefs.contrast === "high" ? "normal" : "high" })}
            aria-pressed={prefs.contrast === "high"}
          >
            <span>របបអានក្រៅផ្ទះ</span>
            <span className="nav-count">{prefs.contrast === "high" ? "បើក" : "បិទ"}</span>
          </button>
          <span className={backupNote(prefs).startsWith("!") ? "rail-warn" : ""}>{backupNotice(prefs)}</span>
        </div>
      </aside>

      <main className="main">
        {pendingLabel && !needsChoice && (
          <p className="alert alert--warn" style={{ marginBottom: "1rem" }}>
            <span className="alert-dot" />
            <span>
              <b>រកមិនឃើញLot {pendingLabel} លើឧបករណ៍នេះ</b>
              ទិន្នន័យត្រូវបានរក្សាក្នុងឧបករណ៍នីមួយៗ — នាំចូលឯកសារ JSON ពីកុំព្យូទ័រ រួចស្កេន QR ម្តងទៀត។{" "}
              <button className="btn btn--quiet" onClick={() => go("settings")}>
                ទៅបញ្ចូលទិន្នន័យ
              </button>
            </span>
          </p>
        )}

        <header className="page-head">
          <div>
            <h1>{page.title}</h1>
            <p>{page.sub}</p>
          </div>
          <span className="tag tag--info">
            {db.lots.length} Lot · {db.recipes.length} រូបមន្ត · {db.qcTests.length} តេស្ត
          </span>
        </header>

        {view.section === "dashboard" && <Dashboard db={db} go={go} />}
        {view.section === "materials" && <Materials db={db} go={go} />}
        {view.section === "recipes" && <Recipes db={db} go={go} />}
        {view.section === "lots" && <Lots db={db} go={go} lotId={view.lotId} />}
        {view.section === "labels" && <Labels db={db} go={go} lotId={view.lotId} />}
        {view.section === "plan" && <Plan db={db} go={go} />}
        {view.section === "customers" && <Customers db={db} go={go} />}
        {view.section === "qc" && <Qc db={db} go={go} />}
        {view.section === "finished" && <Finished db={db} go={go} />}
        {view.section === "reports" && <Reports db={db} />}
        {view.section === "settings" && <Settings db={db} />}
      </main>

      <nav className="tabs" aria-label="របារម៉ឺនុយ">
        {mobilePrimary(visibleNav).pinned.map((item) => (
          <button
            key={item.section}
            type="button"
            className="tab"
            aria-current={view.section === item.section ? "page" : undefined}
            onClick={() => go(item.section)}
          >
            <NavIcon id={item.section} size={20} />
            <span>{item.label}</span>
          </button>
        ))}
        {mobilePrimary(visibleNav).needsMore && (
          <button
            type="button"
            className="tab"
            aria-current={menuOpen ? "page" : undefined}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <NavIcon id="menu" size={20} />
            <span>ម៉ឺនុយ</span>
          </button>
        )}
      </nav>

      {menuOpen && (
        <div className="sheet-backdrop" onClick={() => setMenuOpen(false)}>
          <div className="sheet" role="dialog" aria-label="ម៉ឺនុយពេញ" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <span className="brand-name" style={{ fontSize: "1.3rem" }}>
                ម៉ឺនុយ
              </span>
              <button type="button" className="sheet-close" aria-label="បិទ" onClick={() => setMenuOpen(false)}>
                <NavIcon id="close" size={20} />
              </button>
            </div>
            <div className="sheet-body">
              {groupNav(visibleNav).map((bucket, i) => (
                <div className="nav-group" key={bucket.group ?? `top-${i}`}>
                  {bucket.group && <p className="nav-group-label">{GROUP_LABEL[bucket.group]}</p>}
                  {bucket.items.map((item) => (
                    <button
                      key={item.section}
                      type="button"
                      className="nav-link"
                      aria-current={view.section === item.section ? "page" : undefined}
                      onClick={() => go(item.section)}
                    >
                      <span className="nav-link-main">
                        <NavIcon id={item.section} />
                        {item.label}
                      </span>
                      {counts[item.section] ? <span className="nav-count">{counts[item.section]}</span> : null}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Keeps the “your data lives on this device” risk visible without nagging. */
function backupNote(prefs: Prefs) {
  if (!prefs.lastExportAt) return "!មិនទាន់បម្រុងទុក — ចុចទាញយក JSON";
  const days = Math.round((Date.now() - new Date(prefs.lastExportAt).getTime()) / 86_400_000);
  if (days >= 3) return `!បម្រុងទុក ${days} ថ្ងៃមុន — គួរទាញយកម្តងទៀត`;
  `បម្រុងទុក ${days <= 0 ? "ថ្មីៗ" : `${days} ថ្ងៃមុន`}`;
  return `បម្រុងទុក ${days <= 0 ? "ថ្មីៗ" : `${days} ថ្ងៃមុន`}`;
}

const backupNotice = (prefs: Prefs) => backupNote(prefs).replace("! ", "");
