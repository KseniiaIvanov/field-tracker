/**
 * Landscape Distribution Bar Plot
 * Displays landscape types as vertical bars with counts
 */

export default function LandscapeBarPlot({ data }) {
  if (!data || data.length === 0) {
    return <p style={{ color: 'var(--text-secondary)' }}>No data to display</p>
  }

  // Find max count for scaling
  const maxCount = Math.max(...data.map(d => d.count))

  // SVG dimensions
  const width = Math.min(800, window.innerWidth - 60)
  const height = 400
  const padding = { top: 20, right: 20, bottom: 60, left: 50 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom

  // Calculate bar dimensions
  const barWidth = plotWidth / data.length * 0.8
  const barSpacing = plotWidth / data.length

  // Colors for bars
  const colors = [
    '#2196F3', // Blue
    '#4CAF50', // Green
    '#FF9800', // Orange
    '#9C27B0', // Purple
    '#F44336', // Red
    '#00BCD4', // Cyan
    '#FFC107', // Amber
    '#795548', // Brown
  ]

  return (
    <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
      <svg
        width={width}
        height={height}
        style={{ minWidth: '600px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)' }}
      >
        {/* Y-axis */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={height - padding.bottom}
          stroke="var(--border-color)"
          strokeWidth="2"
        />

        {/* X-axis */}
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke="var(--border-color)"
          strokeWidth="2"
        />

        {/* Y-axis labels and grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const yValue = Math.round(maxCount * ratio)
          const yPos = height - padding.bottom - plotHeight * ratio

          return (
            <g key={`y-${i}`}>
              {/* Grid line */}
              <line
                x1={padding.left}
                y1={yPos}
                x2={width - padding.right}
                y2={yPos}
                stroke="var(--border-color)"
                strokeWidth="1"
                opacity="0.3"
                strokeDasharray="4"
              />
              {/* Y-axis label */}
              <text
                x={padding.left - 10}
                y={yPos + 4}
                textAnchor="end"
                fontSize="12"
                fill="var(--text-secondary)"
              >
                {yValue}
              </text>
            </g>
          )
        })}

        {/* Bars */}
        {data.map((item, index) => {
          const barHeight = (item.count / maxCount) * plotHeight
          const x = padding.left + index * barSpacing + (barSpacing - barWidth) / 2
          const y = height - padding.bottom - barHeight

          const color = colors[index % colors.length]

          return (
            <g key={item.landscape}>
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={color}
                opacity="0.8"
                style={{ transition: 'opacity 0.2s' }}
              />

              {/* Count label on top of bar */}
              <text
                x={x + barWidth / 2}
                y={y - 5}
                textAnchor="middle"
                fontSize="12"
                fontWeight="600"
                fill="var(--text-primary)"
              >
                {item.count}
              </text>

              {/* X-axis label (landscape name) */}
              <text
                x={x + barWidth / 2}
                y={height - padding.bottom + 20}
                textAnchor="middle"
                fontSize="12"
                fill="var(--text-primary)"
              >
                {item.landscape.length > 12 ? item.landscape.substring(0, 12) + '...' : item.landscape}
              </text>

              {/* Percentage label */}
              <text
                x={x + barWidth / 2}
                y={height - padding.bottom + 35}
                textAnchor="middle"
                fontSize="11"
                fill="var(--text-secondary)"
              >
                {item.percentage}%
              </text>
            </g>
          )
        })}

        {/* Y-axis label */}
        <text
          x={15}
          y={padding.top + 10}
          fontSize="12"
          fill="var(--text-secondary)"
          fontWeight="600"
        >
          Count
        </text>
      </svg>

      {/* Legend */}
      <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        {data.map((item, index) => (
          <div key={item.landscape} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <div
              style={{
                width: '16px',
                height: '16px',
                backgroundColor: colors[index % colors.length],
                borderRadius: '2px',
                opacity: '0.8'
              }}
            />
            <span>{item.landscape}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
