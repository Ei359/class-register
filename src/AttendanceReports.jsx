import { useState } from 'react'
import { formatDate, getToday, statuses } from './attendanceData.js'
import { buildAttendanceReport, formatAttendanceRate } from './attendanceReport.js'
import { downloadCsv } from './attendanceCsv.js'
import './reports.css'

function recentRange(days) {
  const start = new Date()
  start.setDate(start.getDate() - days + 1)

  const month = String(start.getMonth() + 1).padStart(2, '0')
  const day = String(start.getDate()).padStart(2, '0')

  return {
    from: `${start.getFullYear()}-${month}-${day}`,
    to: getToday(),
  }
}

function ReportTable({ title, firstColumn, rows }) {
  return (
    <div className="report-table">
      <h3>{title}</h3>

      <div className="table-container">
        <table aria-label={title}>
          <thead>
            <tr>
              <th scope="col">{firstColumn}</th>
              {statuses.map((status) => (
                <th key={status} scope="col">{status}</th>
              ))}
              <th scope="col">Rate</th>
            </tr>
          </thead>

          <tbody>
            {rows.map(({ key, label, counts }) => (
              <tr key={key}>
                <th scope="row">{label}</th>
                {statuses.map((status) => (
                  <td key={status}>{counts[status]}</td>
                ))}
                <td>{formatAttendanceRate(counts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AttendanceReports({ classroom, students, records }) {
  const [range, setRange] = useState(() => recentRange(7))
  const { from, to } = range
  const validRange = Boolean(from && to && from <= to)
  const report = buildAttendanceReport(students, records, from, to)

  function changeRange(event) {
    const { name, value } = event.target
    setRange((previous) => ({ ...previous, [name]: value }))
  }

  function exportReport() {
    const rows = [
      ['Class', 'From', 'To', 'Student ID', 'Student name', ...statuses, 'Rate'],
      ...report.students.map((student) => [
        classroom.name,
        from,
        to,
        student.id,
        student.name,
        ...statuses.map((status) => student.counts[status]),
        formatAttendanceRate(student.counts),
      ]),
    ]

    downloadCsv(
      `attendance-report-${classroom.id}-${from}-to-${to}.csv`,
      rows,
    )
  }

  const summary = [
    ['Days with attendance', report.days.length],
    ['Class attendance rate', formatAttendanceRate(report.totals)],
    ['Total absences', report.totals.Absent],
    ['Unmarked entries', report.totals.Unmarked],
  ]

  return (
    <section className="panel reports" id="reports" aria-labelledby="reports-heading">
      <div className="panel-header">
        <div>
          <h2 id="reports-heading">Attendance reports</h2>
          <p className="report-note">{classroom.name} · {classroom.section}</p>
        </div>

        <button
          type="button"
          disabled={!report.days.length}
          onClick={exportReport}
        >
          Download report CSV
        </button>
      </div>

      <div className="report-filters">
        <label>
          Report from
          <input type="date" name="from" value={from} onChange={changeRange} />
        </label>

        <label>
          Report to
          <input type="date" name="to" value={to} onChange={changeRange} />
        </label>

        <button type="button" onClick={() => setRange(recentRange(7))}>
          Last 7 days
        </button>

        <button type="button" onClick={() => setRange(recentRange(30))}>
          Last 30 days
        </button>
      </div>

      {!validRange ? (
        <p className="empty-message" role="status">
          Choose a start date and an end date on or after it.
        </p>
      ) : report.days.length === 0 ? (
        <p className="empty-message" role="status">
          This class has no attendance marks in the selected date range.
        </p>
      ) : (
        <>
          <dl className="report-summary">
            {summary.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <p className="report-note report-explanation">
            Includes days with at least one mark. Rates use Present and Late as a
            share of Present, Late, and Absent.
          </p>

          <ReportTable
            title="Daily breakdown"
            firstColumn="Date"
            rows={report.days.map(({ date, counts }) => ({
              key: date,
              label: <time dateTime={date}>{formatDate(date)}</time>,
              counts,
            }))}
          />

          <ReportTable
            title="Student breakdown"
            firstColumn="Student"
            rows={report.students.map(({ id, name, counts }) => ({
              key: id,
              label: <>{name} <small className="report-id">{id}</small></>,
              counts,
            }))}
          />
        </>
      )}
    </section>
  )
}