import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface BackButtonProps {
  to?: string
  label?: string
}

export default function BackButton({ to, label = 'Back' }: BackButtonProps) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => (to ? navigate(to) : navigate(-1))}
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-4"
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </button>
  )
}
