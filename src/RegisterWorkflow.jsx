import { useState } from 'react'
import { REOPEN_REASON_MAX } from './attendanceCorrections.js'

export default function RegisterWorkflow({
  finalizedRegister,
  canFinalize,
  onFinalize,
  onReopen,
}) {
  const [reason, setReason] = useState('')

  function reopen(event) {
    event.preventDefault()

    const trimmed = reason.trim()

    if (!trimmed || trimmed.length > REOPEN_REASON_MAX) return

    onReopen(trimmed)
    setReason('')
  }

  return (
    <section className="panel" aria-labelledby="register-status-heading">
      <div className="panel-header">
        <div>
          <h2 id="register-status-heading">Register status</h2>
          <span
            className={`stat-label ${finalizedRegister ? 'tone-present' : 'tone-unmarked'}`}
            role="status"
          >
            {finalizedRegister ? 'Finalized' : 'Open'}
          </span>
        </div>

        {!finalizedRegister && (
          <button
            className="primary"
            type="button"
            onClick={onFinalize}
            disabled={!canFinalize}
          >
            Finalize register
          </button>
        )}
      </div>

      {finalizedRegister ? (
        <>
          <p className="empty-message">
            Finalized by {finalizedRegister.by} on{' '}
            <time dateTime={finalizedRegister.at}>
              {new Date(finalizedRegister.at).toLocaleString()}
            </time>
            . Reopen this register to edit attendance.
          </p>

          <form className="controls" onSubmit={reopen}>
            <label>
              Reason for reopening
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={REOPEN_REASON_MAX}
                required
              />
            </label>

            <button type="submit" disabled={!reason.trim()}>
              Reopen register
            </button>
          </form>
        </>
      ) : !canFinalize && (
        <p className="empty-message">
          Finalize a register after every enrolled student has a status.
        </p>
      )}
    </section>
  )
}