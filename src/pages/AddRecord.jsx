import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import RecordForm from '../components/RecordForm'

export default function AddRecord() {

  const navigate = useNavigate()

  const location = useLocation()

  const repeatCount =
    location.state?.repeatCount || 1
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/field-orders')}
          className="p-2 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Add Field Order</h1>
          <p className="text-slate-500 text-sm mt-0.5">Fill in the details below to create a new record</p>
        </div>
      </div>
      <RecordForm repeatCount={repeatCount} />
    </div>
  )
}
