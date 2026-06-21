import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'

function PlaceholderPage({ title }: { title: string }) {
  return <div style={{ padding: 24 }}><h1>{title}</h1><p>Coming soon...</p></div>
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<PlaceholderPage title="总览" />} />
        <Route path="/deposits" element={<PlaceholderPage title="存款" />} />
        <Route path="/funds" element={<PlaceholderPage title="基金" />} />
        <Route path="/funds/:id" element={<PlaceholderPage title="基金详情" />} />
        <Route path="/entry" element={<PlaceholderPage title="录入" />} />
      </Route>
    </Routes>
  )
}
