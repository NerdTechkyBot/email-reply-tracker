import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Mail, BarChart3, Inbox, Settings } from 'lucide-react';

const Layout = () => {
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/replies', icon: Mail, label: 'Replies' },
    { path: '/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/mailboxes', icon: Inbox, label: 'Mailboxes' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-primary text-white flex flex-col">
        <div className="p-6">
          <img
            src="https://theglobalassociates.com/wp-content/uploads/2025/12/Screenshot_31.png"
            alt="The Global Associates"
            className="w-full h-auto rounded-[10px]"
          />
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-white/20 text-white font-medium'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <p className="text-sm text-white/60 text-center">
            © 2024 The Global Associates
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
