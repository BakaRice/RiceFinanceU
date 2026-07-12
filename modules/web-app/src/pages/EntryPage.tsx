import { useNavigate } from 'react-router-dom'
import SnapshotForm from '../components/SnapshotForm'
import TableWorkspace from '../components/TableWorkspace'
import './EntryPage.css'

export default function EntryPage() {
  const navigate = useNavigate()

  return (
    <div className="entry-page">
      <TableWorkspace
        title="录入"
        description="全部可录入资产已预填；只修改发生变化的单元格"
      >
        <SnapshotForm
          onSuccess={() => undefined}
          onManageAssets={() => navigate('/assets')}
        />
      </TableWorkspace>
    </div>
  )
}
