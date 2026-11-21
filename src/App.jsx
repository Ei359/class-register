import { useEffect, useReducer, useRef, useState } from 'react'
import { downloadAttendanceCsv } from './attendanceCsv.js'
import StudentManagement from './StudentManagement.jsx'
import BackupPanel from './BackupPanel.jsx'
import CorrectionLog from './CorrectionLog.jsx'
import RegisterWorkflow from './RegisterWorkflow.jsx'
import attendanceReducer, { canFinalizeRoster } from './attendanceCorrections.js'
import { loadRegisterData, saveRegisterData } from './attendanceBackup.js'
import AttendanceReports from './AttendanceReports.jsx'
import { formatAttendanceRate } from './attendanceReport.js'
import {
  classes,
  statuses,
  getToday,
  formatDate,
  getRoster,
  countStatuses,
} from './attendanceData.js'
import './App.css'
import './roster.css'
import './workspace.css'

const navigation = [
  { id: 'overview', label: 'Overview', icon: '▥' },
  { id: 'attendance', label: 'Attendance', icon: '▦' },
  { id: 'history', label: 'History', icon: '◷' },
  { id: 'reports', label: 'Reports', icon: '▤' },
  { id: 'students', label: 'Students', icon: '♙' },
  { id: 'corrections', label: 'Corrections', icon: '✎' },
  { id: 'backup', label: 'Backup', icon: '⇧' },
]

function getActiveSection() {
  const section = window.location.hash.slice(1)
  return navigation.some((item) => item.id === section) ? section : 'overview'
}

function initializeAttendance() {
  return { ...loadRegisterData(), lastChange: null }
}

function createAttendanceEvent(name) {
  return {
    id: crypto.getRandomValues(new Uint32Array(4)).join('-'),
    by: name.trim() || 'Local operator',
    at: new Date().toISOString(),
  }
}

function StudentRow({ student, onMark, locked }) {
  const initials = student.name.split(' ').map((part) => part[0]).join('')

  return (
    <tr>
      <th scope="row">
        <div className="student">
          <span className="avatar" aria-hidden="true">{initials}</span>
          <div>
            <span>{student.name}</span>
            <small>{student.id}</small>
          </div>
        </div>
      </th>

      <td>
        <select
          className={`status-select tone-${student.status.toLowerCase()}`}
          aria-label={`Attendance for ${student.name}`}
          value={student.status}
          disabled={locked}
          onChange={(event) => onMark(student.id, event.target.value)}
        >
          {statuses.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </td>
    </tr>
  )
}

function AttendanceHistory({ history, finalized, onViewDate }) {
  return (
    <section className="panel" id="history" aria-labelledby="history-heading">
      <div className="panel-header">
        <h2 id="history-heading">Attendance history</h2>
      </div>

      {history.length === 0 ? (
        <p className="empty-message">
          Mark a student to start this class’s attendance history.
        </p>
      ) : (
        <div className="table-container">
          <table className="history-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                {statuses.map((status) => (
                  <th key={status} scope="col">{status}</th>
                ))}
                <th scope="col">Register status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>

            <tbody>
              {history.map(({ date, counts }) => (
                <tr key={date}>
                  <th scope="row">
                    <time dateTime={date}>{formatDate(date)}</time>
                  </th>
                  {statuses.map((status) => (
                    <td key={status}>{counts[status]}</td>
                  ))}
                  <td>
                    <span
                      className={`stat-label ${finalized[date] ? 'tone-present' : 'tone-unmarked'}`}
                    >
                      {finalized[date] ? 'Finalized' : 'Open'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      aria-label={`View records for ${formatDate(date)}`}
                      onClick={() => onViewDate(date)}
                    >
                      View records
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default function App() {
  const [classId, setClassId] = useState(classes[0].id)
  const [date, setDate] = useState(getToday)

  const [{ records, students, corrections, finalized, lastChange }, dispatchAttendance] =
    useReducer(attendanceReducer, null, initializeAttendance)

  const [storageError, setStorageError] = useState(false)
  const [restoreCount, setRestoreCount] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [operator, setOperator] = useState('')
  const [activeSection, setActiveSection] = useState(getActiveSection)
  const rosterHeading = useRef(null)

  useEffect(() => {
    let failed = false

    try {
      saveRegisterData({ students, records, corrections, finalized })
    } catch {
      failed = true
    }

    queueMicrotask(() => setStorageError(failed))
  }, [students, records, corrections, finalized])

  useEffect(() => {
    function syncNavigation() {
      setActiveSection(getActiveSection())
    }

    window.addEventListener('hashchange', syncNavigation)
    return () => window.removeEventListener('hashchange', syncNavigation)
  }, [])

  const selectedClass = classes.find((classroom) => classroom.id === classId)
  const classStudents = students.filter((student) => student.classId === classId)
  const classFinalized = finalized[classId] ?? {}
  const finalizedRegister = classFinalized[date]

  const roster = getRoster(classStudents, date, records[date], finalizedRegister)
  const counts = countStatuses(roster)
  const marked = roster.length - counts.Unmarked
  const rate = formatAttendanceRate(counts)

  const canUndo =
    !finalizedRegister && lastChange?.date === date && lastChange.classId === classId

  const query = search.trim().toLowerCase()
  const today = getToday()
  const todayRoster = getRoster(students, today, records[today])
  const todayCounts = countStatuses(todayRoster)

  const overview = [
    ['Classes', classes.length],
    ['Enrolled students', todayRoster.length],
    ['Marked today', todayRoster.length - todayCounts.Unmarked],
    ['Attendance rate', formatAttendanceRate(todayCounts)],
  ]

  const visibleRoster = roster.filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(query) ||
      student.id.toLowerCase().includes(query)

    const matchesStatus = statusFilter === 'All' || student.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const history = Object.entries(records)
    .map(([savedDate, day]) => {
      const pastRoster = getRoster(classStudents, savedDate, day, classFinalized[savedDate])
      const dayCounts = countStatuses(pastRoster)

      return {
        date: savedDate,
        counts: dayCounts,
        marked: pastRoster.length - dayCounts.Unmarked,
      }
    })
    .filter((entry) => entry.marked > 0)
    .sort((first, second) => second.date.localeCompare(first.date))

  function resetFilters() {
    setSearch('')
    setStatusFilter('All')
  }

  function saveStudent(student) {
    dispatchAttendance({ type: 'save-student', student })
  }

  function changeRegisterStatus(type, reason) {
    dispatchAttendance({
      type,
      classId,
      date,
      reason,
      event: createAttendanceEvent(operator),
    })
  }

  function restoreBackup({ students, records, corrections, finalized }) {
    const data = { students, records, corrections, finalized }

    saveRegisterData(data)
    dispatchAttendance({ type: 'restore', data })
    resetFilters()
    setRestoreCount((previous) => previous + 1)
  }

  function markAttendance(studentId, status) {
    dispatchAttendance({
      type: 'mark',
      date,
      classId,
      updates: { [studentId]: status },
      event: createAttendanceEvent(operator),
    })
  }

  function markUnmarkedPresent() {
    const updates = Object.fromEntries(
      roster
        .filter((student) => student.status === 'Unmarked')
        .map((student) => [student.id, 'Present']),
    )

    dispatchAttendance({
      type: 'mark',
      date,
      classId,
      updates,
      event: createAttendanceEvent(operator),
    })
  }

  function undoAttendance() {
    dispatchAttendance({
      type: 'undo',
      date,
      classId,
      event: createAttendanceEvent(operator),
    })
  }

  function openRegister(savedDate) {
    setDate(savedDate)
    resetFilters()
    window.history.replaceState(window.history.state, '', '#attendance')
    setActiveSection('attendance')
    rosterHeading.current?.focus()
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span aria-hidden="true">CR</span> Class Register
        </div>

        <p className="sidebar-label">WORKSPACE</p>

        <nav aria-label="Dashboard navigation">
          {navigation.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={activeSection === item.id ? 'active' : undefined}
              aria-current={activeSection === item.id ? 'location' : undefined}
              onClick={() => setActiveSection(item.id)}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              {activeSection === item.id && (
                <span className="active-indicator" aria-hidden="true">●</span>
              )}
            </a>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="sidebar-status-dot" aria-hidden="true" />
          Local workspace
        </div>
      </aside>

      <main className="workspace">
        <section id="overview" aria-labelledby="overview-heading">
          <div className="page-header">
            <p>All classes · {formatDate(today)}</p>
            <h2 id="overview-heading">Today’s overview</h2>
          </div>

          <div className="summary">
            {overview.map(([label, value]) => (
              <div className="stat" key={label}>
                <span className="workspace-note">{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>

        <header className="page-header" id="attendance">
          <p>{selectedClass.section}</p>
          <h1>Attendance register</h1>
        </header>

        {storageError && (
          <p className="empty-message" role="alert">
            Browser storage could not save your latest changes. Download a JSON
            backup to keep a copy.
          </p>
        )}

        <section className="panel controls" aria-label="Register controls">
          <label>
            Class
            <select
              value={classId}
              onChange={(event) => {
                setClassId(event.target.value)
                resetFilters()
              }}
            >
              {classes.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name} · {classroom.section}
                </option>
              ))}
            </select>
          </label>

          <label>
            Attendance date
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value || getToday())}
            />
          </label>

          <button type="button" onClick={() => openRegister(getToday())}>
            Today
          </button>

          <button type="button" disabled={!canUndo} onClick={undoAttendance}>
            Undo last change
          </button>

          <button
            type="button"
            disabled={marked === 0}
            onClick={() => downloadAttendanceCsv(date, roster, selectedClass)}
          >
            Download CSV
          </button>
        </section>

        <RegisterWorkflow
          key={`${classId}-${date}-${restoreCount}`}
          finalizedRegister={finalizedRegister}
          canFinalize={canFinalizeRoster(roster)}
          onFinalize={() => changeRegisterStatus('finalize')}
          onReopen={(reason) => changeRegisterStatus('reopen', reason)}
        />

        <section className="summary" aria-label="Class attendance totals">
          {statuses.map((status) => (
            <div className="stat" key={status}>
              <span className={`stat-label tone-${status.toLowerCase()}`}>
                {status}
              </span>
              <strong>{counts[status]}</strong>
            </div>
          ))}
        </section>

        <section className="panel completion" aria-labelledby="completion-heading">
          <div>
            <h2 id="completion-heading">Register completion</h2>
            <p aria-live="polite">{marked} of {roster.length} students marked</p>
            <progress
              aria-label="Students marked"
              value={marked}
              max={roster.length || 1}
            />
          </div>

          <div className="rate">
            <strong>{rate}</strong>
            <span>Attendance rate, excluding excused and unmarked</span>
          </div>
        </section>

        <section className="panel" aria-labelledby="roster-heading">
          <div className="panel-header">
            <h2 id="roster-heading" tabIndex={-1} ref={rosterHeading}>
              Class roster
            </h2>

            <button
              type="button"
              className="primary"
              disabled={Boolean(finalizedRegister) || counts.Unmarked === 0}
              onClick={markUnmarkedPresent}
            >
              Mark unmarked present
            </button>
          </div>

          {finalizedRegister && (
            <p className="empty-message">
              This register keeps the roster from when it was finalized.
              New students appear on open registers from their first day.
            </p>
          )}

          <div className="filters">
            <label>
              Recorded by
              <input
                type="text"
                value={operator}
                maxLength={80}
                placeholder="Name (optional)"
                onChange={(event) => setOperator(event.target.value)}
              />
            </label>

            <label>
              Search students
              <input
                type="search"
                placeholder="Name or student ID"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <label>
              Filter by status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="All">All statuses</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="table-container">
            <table className="roster-table">
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  <th scope="col">Attendance status</th>
                </tr>
              </thead>

              <tbody>
                {visibleRoster.map((student) => (
                  <StudentRow
                    key={student.id}
                    student={student}
                    onMark={markAttendance}
                    locked={Boolean(finalizedRegister)}
                  />
                ))}

                {visibleRoster.length === 0 && (
                  <tr>
                    <td className="empty-message" colSpan={2}>
                      {roster.length
                        ? 'No students match your filters.'
                        : 'No students enrolled on this date.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <AttendanceHistory
          history={history}
          finalized={classFinalized}
          onViewDate={openRegister}
        />

        <AttendanceReports
          classroom={selectedClass}
          students={classStudents}
          records={records}
          finalized={classFinalized}
        />

        <StudentManagement
          key={`${classId}-${restoreCount}`}
          students={students}
          records={records}
          classroom={selectedClass}
          onSave={saveStudent}
        />

        <CorrectionLog corrections={corrections} classroom={selectedClass} />

        <BackupPanel
          students={students}
          records={records}
          corrections={corrections}
          finalized={finalized}
          onRestore={restoreBackup}
        />
      </main>
    </div>
  )
}