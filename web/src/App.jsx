import { createContext, useContext, useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { store, api, setCurrency } from './api';
import QueueBanner from './QueueBanner';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Stock from './pages/Stock';
import Purchases from './pages/Purchases';
import PurchaseNew from './pages/PurchaseNew';
import Production from './pages/Production';
import Orders from './pages/Orders';
import OrderNew from './pages/OrderNew';
import OrderDetail from './pages/OrderDetail';
import Customers from './pages/Customers';
import Finance from './pages/Finance';
import More from './pages/More';
import Settings from './pages/Settings';
import Users from './pages/Users';
import Profile from './pages/Profile';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

/** តើតួនាទីនេះមើលឃើញអ្វីខ្លះ — admin ឃើញគ្រប់កន្លែង */
export function can(role, area) {
  if (role === 'admin') return true;
  const map = {
    stock: ['dashboard', 'stock', 'production', 'purchases', 'settings'],
    sales: ['dashboard', 'orders', 'customers', 'stock', 'receivables'],
    accountant: ['dashboard', 'finance', 'orders', 'stock', 'receivables'],
  };
  return (map[role] || []).includes(area);
}

const ICON = {
  dashboard: 'M3 12h4l3 8 4-16 3 8h4',
  stock: 'M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10',
  orders: 'M4 4h13l3 5v11H4z M4 9h16 M9 13h6',
  production: 'M4 20V9l5 3V9l5 3V9l6 4v7z',
  purchases: 'M6 6h15l-2 9H8z M6 6L5 3H2 M9 20h.01 M18 20h.01',
  more: 'M5 12h.01 M12 12h.01 M19 12h.01',
};

function Icon({ d }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.split(' M').map((seg, i) => <path key={i} d={(i ? 'M' : '') + seg} />)}
    </svg>
  );
}

const TABS_BY_ROLE = {
  admin: ['dashboard', 'orders', 'stock', 'production', 'more'],
  stock: ['dashboard', 'stock', 'production', 'purchases', 'more'],
  sales: ['dashboard', 'orders', 'customers', 'stock', 'more'],
  accountant: ['dashboard', 'finance', 'orders', 'stock', 'more'],
};

const TAB_INFO = {
  dashboard: { to: '/', label: 'ផ្ទាំង', icon: ICON.dashboard },
  stock: { to: '/stock', label: 'ស្តុក', icon: ICON.stock },
  orders: { to: '/orders', label: 'លក់', icon: ICON.orders },
  production: { to: '/production', label: 'ផលិត', icon: ICON.production },
  purchases: { to: '/purchases', label: 'ទិញ', icon: ICON.purchases },
  customers: { to: '/customers', label: 'អតិថិជន', icon: ICON.orders },
  finance: { to: '/finance', label: 'ហិរញ្ញវត្ថុ', icon: ICON.dashboard },
  more: { to: '/more', label: 'ច្រើនទៀត', icon: ICON.more },
};

function Shell({ children }) {
  const { user, logout } = useAuth();
  const [online, setOnline] = useState(navigator.onLine);

  // ធ្វើសមកាលកម្មរូបិយប័ណ្ណជាមួយម៉ាស៊ីនមេ (រក្សាទុកក្នុងឧបករណ៍ ដូច្នេះបើកលើកក្រោយឃើញភ្លាម)
  useEffect(() => {
    api.get('/catalog/settings')
      .then((rows) => {
        const c = rows.find((r) => r.key === 'currency')?.value;
        if (c) setCurrency(c);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const tabs = TABS_BY_ROLE[user.role] || TABS_BY_ROLE.sales;

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <img src="/logo-mark-white.png" alt="" aria-hidden="true" />
          <div>
            <h1>កសិករទំនើប</h1>
            <div className="who">{user.name}</div>
          </div>
        </div>
        <button onClick={logout}>ចាកចេញ</button>
      </div>

      {!online && (
        <div className="offline">
          គ្មានអ៊ីនធឺណិត — ការកត់ត្រានៅតែធ្វើបាន ហើយផ្ញើពេលបណ្តាញត្រឡប់មក
        </div>
      )}

      <QueueBanner />

      <main>{children}</main>

      <nav className="tabs">
        {tabs.map((t) => (
          <NavLink key={t} to={TAB_INFO[t].to} end={TAB_INFO[t].to === '/'}
                   className={({ isActive }) => (isActive ? 'on' : '')}>
            <Icon d={TAB_INFO[t].icon} />
            <span>{TAB_INFO[t].label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function Guard({ area, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (area && !can(user.role, area)) {
    return <Shell><p className="notice error">អ្នកគ្មានសិទ្ធិមើលទំព័រនេះទេ</p></Shell>;
  }
  return <Shell>{children}</Shell>;
}

function Routed() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<Guard area="dashboard"><Dashboard /></Guard>} />
      <Route path="/stock" element={<Guard area="stock"><Stock /></Guard>} />
      <Route path="/purchases" element={<Guard area="purchases"><Purchases /></Guard>} />
      <Route path="/purchases/new" element={<Guard area="purchases"><PurchaseNew /></Guard>} />
      <Route path="/production" element={<Guard area="production"><Production /></Guard>} />
      <Route path="/orders" element={<Guard area="orders"><Orders /></Guard>} />
      <Route path="/orders/new" element={<Guard area="orders"><OrderNew /></Guard>} />
      <Route path="/orders/:id" element={<Guard area="orders"><OrderDetail /></Guard>} />
      <Route path="/customers" element={<Guard area="customers"><Customers /></Guard>} />
      <Route path="/finance" element={<Guard area="finance"><Finance /></Guard>} />
      <Route path="/settings" element={<Guard area="settings"><Settings /></Guard>} />
      <Route path="/users" element={<Guard area="users"><Users /></Guard>} />
      <Route path="/profile" element={<Guard><Profile /></Guard>} />
      <Route path="/more" element={<Guard><More /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const [user, setUser] = useState(store.user);

  const value = {
    user,
    login: (token, u) => { store.save(token, u); setUser(u); },
    logout: () => { store.clear(); setUser(null); window.location.hash = '#/login'; },
  };

  return (
    <AuthCtx.Provider value={value}>
      <HashRouter>
        <Routed />
      </HashRouter>
    </AuthCtx.Provider>
  );
}
