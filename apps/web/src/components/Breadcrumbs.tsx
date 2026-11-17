import { Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

interface Crumb {
  label: string
  to?: string
}

export default function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1 text-xs text-gray-500 mb-4">
      <Link to="/dashboard" className="hover:text-primary-600 transition-colors">
        <Home className="w-3.5 h-3.5" />
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          {crumb.to ? (
            <Link to={crumb.to} className="hover:text-primary-600 transition-colors">
              {crumb.label}
            </Link>
          ) : (
            <span className="text-gray-800 font-medium">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
