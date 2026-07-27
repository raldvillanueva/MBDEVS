import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import RecordForm from '../components/RecordForm'

export default function EditRecord() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isArchived, setIsArchived] = useState(false)

  useEffect(() => {
    supabase
      .from('field_orders')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          navigate('/field-orders')
        } else {
          // Normalize nulls to empty strings for the form
          const normalized = Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, v == null ? '' : v])
          )
          setData(normalized)
setIsArchived(!!data.archived_at)
        }
        setLoading(false)
      })
  }, [id, navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() =>
  navigate(isArchived ? '/archived-work-orders' : '/field-orders')
}
          className="p-2 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Edit Field Order</h1>
          <p className="text-slate-500 text-sm mt-0.5 font-mono">{data?.field_order_no || id}</p>
        </div>
      </div>
      <RecordForm initialData={data} recordId={id} />
    </div>
  )
}
