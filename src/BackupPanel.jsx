import { useRef, useState } from 'react'
import {
  downloadAttendanceBackup,
  parseAttendanceBackup,
} from './attendanceBackup.js'

export default function BackupPanel({ students, records, onRestore }) {
  const [preview, setPreview] = useState(null)
  const [message, setMessage] = useState('')
  const requestId = useRef(0)

  async function chooseBackup(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    const currentRequest = ++requestId.current

    setPreview(null)
    setMessage('')

    if (!file) return

    try {
      const data = parseAttendanceBackup(await file.text())

      if (currentRequest === requestId.current) {
        setPreview({ name: file.name, ...data })
      }
    } catch (error) {
      if (currentRequest === requestId.current) {
        setMessage(error.message || 'The backup file could not be read.')
      }
    }
  }

  function restoreBackup() {
    try {
      onRestore(preview)
      setPreview(null)
      setMessage('Backup restored.')
    } catch {
      setMessage('The browser could not save this backup. Your current data is still open.')
    }
  }

  return (
    <section className="panel" id="backup" aria-labelledby="backup-heading">
      <div className="panel-header">
        <h2 id="backup-heading">Backup &amp; Restore</h2>
      </div>

      <div className="controls">
        <button
          type="button"
          onClick={() => downloadAttendanceBackup(students, records)}
        >
          Download JSON backup
        </button>

        <label>
          Open a JSON backup
          <input
            type="file"
            accept=".json,application/json"
            onChange={chooseBackup}
          />
        </label>
      </div>

      {preview && (
        <>
          <p className="empty-message">
            <strong>{preview.name}</strong>
            <br />
            Exported {new Date(preview.exportedAt).toLocaleString()}
            <br />
            Restore replaces the student roster and attendance records in this browser.
          </p>

          <dl className="report-summary">
            <div>
              <dt>Students in backup</dt>
              <dd>{preview.students.length}</dd>
            </div>
            <div>
              <dt>Saved register dates</dt>
              <dd>{Object.keys(preview.records).length}</dd>
            </div>
          </dl>

          <div className="controls">
            <button className="primary" type="button" onClick={restoreBackup}>
              Restore backup
            </button>
            <button
              type="button"
              onClick={() => {
                setPreview(null)
                setMessage('')
              }}
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {message && <p className="empty-message" role="status">{message}</p>}
    </section>
  )
}