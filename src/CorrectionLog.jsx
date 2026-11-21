import { formatDate } from './attendanceData.js'

export default function CorrectionLog({ corrections, classroom }) {
  const entries = corrections.filter((entry) => entry.classId === classroom.id)

  return (
    <section className="panel" id="corrections" aria-labelledby="corrections-heading">
      <div className="panel-header">
        <div>
          <h2 id="corrections-heading">Attendance correction log</h2>
          <p className="workspace-note">{classroom.name} · {classroom.section}</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="empty-message">
          Corrections, Undo actions, and register status changes appear here.
        </p>
      ) : (
        <div className="table-container">
          <table className="corrections-table" aria-label="Attendance corrections">
            <thead>
              <tr>
                <th scope="col">Register date</th>
                <th scope="col">Student</th>
                <th scope="col">Previous</th>
                <th scope="col">Updated</th>
                <th scope="col">Recorded by</th>
                <th scope="col">Action</th>
                <th scope="col">Changed at</th>
                <th scope="col">Reason</th>
              </tr>
            </thead>

            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <time dateTime={entry.date}>{formatDate(entry.date)}</time>
                  </td>
                  <th scope="row">
                    {entry.studentName ?? 'Whole register'}
                    {entry.studentId && <small>{entry.studentId}</small>}
                  </th>
                  <td>{entry.from}</td>
                  <td>{entry.to}</td>
                  <td>{entry.by}</td>
                  <td>{entry.action}</td>
                  <td>
                    <time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time>
                  </td>
                  <td>{entry.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}