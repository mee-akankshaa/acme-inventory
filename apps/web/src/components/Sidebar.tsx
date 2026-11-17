import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Building2,
  Users,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Boxes,
  Bell,
  BarChart3,
  Settings,
  LogOut,
  X,
  Warehouse,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { alertsApi } from '../services/alerts'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/vendors', label: 'Vendors', icon: Building2 },
  { to: '/buyers', label: 'Buyers', icon: Users },
  { to: '/stock/in', label: 'Stock In', icon: ArrowDownToLine },
  { to: '/stock/out', label: 'Stock Out', icon: ArrowUpFromLine },
  { to: '/stock/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/inventory', label: 'Inventory', icon: Boxes },
  { to: '/alerts', label: 'Alerts', icon: Bell, badge: true },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings/alerts', label: 'Settings', icon: Settings },
]

function SidebarContent({ full, onClose, unreadCount }: { full: boolean; onClose: () => void; unreadCount: number }) {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#1E1B4B' }}>
      {/* Logo */}
      <div className={`flex items-center h-14 border-b border-white/10 flex-shrink-0 ${full ? 'px-4 gap-3 justify-between' : 'justify-center px-2'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-500 flex-shrink-0">
            <Warehouse className="w-5 h-5 text-white" />
          </div>
          {full && (
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm leading-tight">Acme</p>
              <p className="text-primary-300 text-xs">Inventory</p>
            </div>
          )}
        </div>
        {/* Mobile close */}
        {full && (
          <button onClick={onClose} className="lg:hidden text-white/60 hover:text-white p-1 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            title={!full ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg text-sm font-medium transition-colors relative group ${
                full ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center'
              } ${
                isActive
                  ? 'bg-white/15 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {full && <span className="flex-1 truncate">{label}</span>}
            {badge && unreadCount > 0 && (
              <span className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ${!full ? 'absolute -top-1 -right-1 h-4 w-4 min-w-0' : ''}`}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-2 py-3 border-t border-white/10">
        <button
          onClick={handleLogout}
          title={!full ? 'Logout' : undefined}
          className={`flex items-center gap-3 w-full rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors ${
            full ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center'
          }`}
        >
          <LogOut className="w-4 h-4" />
          {full && 'Logout'}
        </button>
      </div>
    </div>
  )
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { data: unreadData } = useQuery({
    queryKey: ['alerts-unread'],
    queryFn: alertsApi.getUnreadCount,
    refetchInterval: 30000,
  })
  const unreadCount = unreadData?.count ?? 0

  return (
    <>
      {/* Tablet sidebar: icons only (md–lg) */}
      <aside className="hidden md:flex lg:hidden flex-shrink-0">
        <div className="w-14">
          <SidebarContent full={false} onClose={onClose} unreadCount={unreadCount} />
        </div>
      </aside>

      {/* Desktop sidebar: full (lg+) */}
      <aside className="hidden lg:flex flex-shrink-0">
        <div className="w-56">
          <SidebarContent full={true} onClose={onClose} unreadCount={unreadCount} />
        </div>
      </aside>

      {/* Mobile drawer (< md) */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={onClose} />
          <aside className="fixed inset-y-0 left-0 z-50 w-56 md:hidden">
            <SidebarContent full={true} onClose={onClose} unreadCount={unreadCount} />
          </aside>
        </>
      )}
    </>
  )
}
