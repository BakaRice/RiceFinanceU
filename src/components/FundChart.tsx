import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { ChartDataPoint } from '../domain/funds'
import './FundChart.css'

interface Props { data: ChartDataPoint[] }

export default function FundChart({ data }: Props) {
  if (data.length === 0) return <p className="chart-empty">暂无净值数据，请先录入基金净值。</p>
  return (
    <div className="fund-chart">
      <h3>走势图</h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" fontSize={12} />
          <YAxis fontSize={12} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="nav" name="单位净值" stroke="#0f3460" dot={false} />
          <Line type="monotone" dataKey="marketValue" name="持仓市值" stroke="#e94560" dot={false} />
          <Line type="monotone" dataKey="costBasis" name="累计投入" stroke="#8884d8" dot={false} />
          <Line type="monotone" dataKey="pnl" name="收益" stroke="#82ca9d" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
