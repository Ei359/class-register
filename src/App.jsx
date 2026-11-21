import { useEffect, useReducer, useRef, useState } from 'react'
import { downloadAttendanceCsv } from './attendanceCsv.js'
import StudentManagement from './StudentManagement.jsx'
import BackupPanel from './BackupPanel.jsx'
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

function initializeAttendance() {
  return { ...loadRegisterData(), lastChange: null }
}

function attendanceReducer(state, action) {
  const { records, students, lastChange } = state

  if (action.type === 'restore') {
    return { ...action.data, lastChange: null }
  }

  if (action.type === 'save-student') {
    const student = action.student
    const nextStudents = students.some((item) => item.id === student.id)
      ? students.map((item) => item.id === student.id ? student : item)
      : [...students, student]

    return { ...state, students: nextStudents, lastChange: null }
  }

  if (action.type === 'undo') {
    if (
      !lastChange ||
      lastChange.classId !== action.classId ||
      lastChange.date !== action.date
    ) {
      return state
    }

    const restored = { ...records }

    if (lastChange.previousDay === undefined) {
      delete restored[action.date]
    } else {
      restored[action.date] = lastChange.previousDay
    }

    return { ...state, records: restored, lastChange: null }
  }

  const { date, classId, updates } = action
  const previousDay = records[date]

  const alreadyApplied = Object.entries(updates).every(
    ([id, status]) => previousDay?.[id] === status,
  )

  if (alreadyApplied) return state

  return {
    ...state,
    records: { ...records, [date]: { ...previousDay, ...updates } },
    lastChange: { date, classId, previousDay },
  }
}

function StudentRow({ student, onMark }) {
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

function AttendanceHistory({ history, onViewDate }) {
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
  const [{ records, students, lastChange }, dispatchAttendance] = useReducer(
    attendanceReducer,
    null,
    initializeAttendance,
  )

  const [storageError, setStorageError] = useState(false)
  const [restoreCount, setRestoreCount] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const rosterHeading = useRef(null)

  useEffect(() => {
    let failed = false

    try {
      saveRegisterData({ students, records })
    } catch {
      failed = true
    }

    queueMicrotask(() => setStorageError(failed))
  }, [students, records])

  const selectedClass = classes.find((classroom) => classroom.id === classId)
  const classStudents = students.filter((student) => student.classId === classId)
  const roster = getRoster(classStudents, date, records[date])
  const counts = countStatuses(roster)
  const marked = roster.length - counts.Unmarked
  const rate = formatAttendanceRate(counts)
  const canUndo = lastChange?.date === date && lastChange.classId === classId
  const query = search.trim().toLowerCase()

  const visibleRoster = roster.filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(query) ||
      student.id.toLowerCase().includes(query)

    const matchesStatus =
      statusFilter === 'All' || student.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const history = Object.entries(records)
    .map(([savedDate, day]) => {
      const pastRoster = getRoster(classStudents, savedDate, day)
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

  function restoreBackup({ students, records }) {
    const data = { students, records }

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
    })
  }

  function markUnmarkedPresent() {
    const updates = Object.fromEntries(
      roster
        .filter((student) => student.status === 'Unmarked')
        .map((student) => [student.id, 'Present']),
    )

    dispatchAttendance({ type: 'mark', date, classId, updates })
  }

  function openRegister(savedDate) {
    setDate(savedDate)
    resetFilters()
    rosterHeading.current?.focus()
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span aria-hidden="true">CR</span> Class Register
        </div>

        <nav aria-label="Dashboard">
          <a href="#attendance">Attendance</a>
          <a href="#history">History</a>
          <a href="#reports">Reports</a>
          <a href="#students">Students</a>
          <a href="#backup">Backup</a>
        </nav>
      </aside>

      <main className="workspace">
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

          <button
            type="button"
            disabled={!canUndo}
            onClick={() => dispatchAttendance({ type: 'undo', date, classId })}
          >
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
              disabled={counts.Unmarked === 0}
              onClick={markUnmarkedPresent}
            >
              Mark unmarked present
            </button>
          </div>

          <div className="filters">
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

        <AttendanceHistory history={history} onViewDate={openRegister} />

        <AttendanceReports
          classroom={selectedClass}
          students={classStudents}
          records={records}
        />

        <StudentManagement
          key={`${classId}-${restoreCount}`}
          students={students}
          records={records}
          classroom={selectedClass}
          onSave={saveStudent}
        />

        <BackupPanel
          students={students}
          records={records}
          onRestore={restoreBackup}
        />
      </main>
    </div>
  )
}