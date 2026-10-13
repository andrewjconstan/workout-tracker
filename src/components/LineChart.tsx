export interface ChartPoint {
  label: string
  value: number
}

/** Small dependency-free line chart. Points are oldest to newest. */
export default function LineChart({ title, points, unit }: { title: string; points: ChartPoint[]; unit?: string }) {
  if (points.length < 2) {
    return (
      <div className="chart">
        <h4>{title}</h4>
        <p className="muted small">Needs at least two sessions.</p>
      </div>
    )
  }
  const W = 320
  const H = 130
  const padL = 34
  const padR = 10
  const padT = 12
  const padB = 22
  const values = points.map((p) => p.value)
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (min === max) {
    min -= 1
    max += 1
  }
  const x = (i: number) => padL + (i * (W - padL - padR)) / (points.length - 1)
  const y = (v: number) => padT + ((max - v) * (H - padT - padB)) / (max - min)
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

  return (
    <div className="chart">
      <h4>
        {title}
        {unit ? <span className="muted small"> ({unit})</span> : null}
      </h4>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        <line className="axis" x1={padL} x2={W - padR} y1={y(min)} y2={y(min)} />
        <line className="axis" x1={padL} x2={W - padR} y1={y(max)} y2={y(max)} />
        <text className="tick" x={padL - 4} y={y(max) + 4} textAnchor="end">{fmt(max)}</text>
        <text className="tick" x={padL - 4} y={y(min) + 4} textAnchor="end">{fmt(min)}</text>
        <path className="line" d={path} fill="none" />
        {points.map((p, i) => (
          <circle key={i} className="dot" cx={x(i)} cy={y(p.value)} r={3}>
            <title>{`${p.label}: ${fmt(p.value)}`}</title>
          </circle>
        ))}
        <text className="tick" x={padL} y={H - 6} textAnchor="start">{points[0].label}</text>
        <text className="tick" x={W - padR} y={H - 6} textAnchor="end">{points[points.length - 1].label}</text>
      </svg>
    </div>
  )
}
