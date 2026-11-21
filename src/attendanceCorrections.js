import { getRoster, snapshotFinalizedRosters, statuses } from './attendanceData.js'

export const REOPEN_REASON_MAX = 240

export function canFinalizeRoster(roster) {
  return roster.length > 0 && roster.every((student) => student.status !== 'Unmarked')
}

function savedStatus(day, id) {
  const value = day?.[id]
  return statuses.includes(value) ? value : 'Unmarked'
}

function getStudentName(students, id) {
  return students.find((student) => student.id === id)?.name ?? id
}

export default function attendanceReducer(state, action) {
  const { students, records, corrections, finalized, lastChange } = state

  switch (action.type) {
    case 'restore':
      return { ...action.data, lastChange: null }

    case 'save-student': {
      const student = action.student
      const previousStudent = students.find((item) => item.id === student.id)

      const nextStudents = previousStudent
        ? students.map((item) => item.id === student.id ? student : item)
        : [...students, student]

      return {
        ...state,
        students: nextStudents,
        finalized: snapshotFinalizedRosters(finalized, students),
        lastChange: null,
      }
    }

    case 'finalize':
    case 'reopen': {
      const { classId, date, event } = action
      const classRegisters = finalized[classId] ?? {}
      const isFinalizing = action.type === 'finalize'
      const reason = (action.reason ?? '').trim()

      const classStudents = students.filter((student) => student.classId === classId)
      const roster = getRoster(classStudents, date, records[date])

      if (isFinalizing) {
        if (classRegisters[date] || !canFinalizeRoster(roster)) return state
      } else if (!classRegisters[date] || !reason || reason.length > REOPEN_REASON_MAX) {
        return state
      }

      const nextClassRegisters = { ...classRegisters }

      if (isFinalizing) {
        nextClassRegisters[date] = {
          by: event.by,
          at: event.at,
          studentIds: roster.map((student) => student.id),
        }
      } else {
        delete nextClassRegisters[date]
      }

      const entry = {
        id: event.id,
        classId,
        date,
        from: isFinalizing ? 'Open' : 'Finalized',
        to: isFinalizing ? 'Finalized' : 'Open',
        by: event.by,
        at: event.at,
        action: isFinalizing ? 'Finalize' : 'Reopen',
        reason,
      }

      return {
        ...state,
        finalized: { ...finalized, [classId]: nextClassRegisters },
        corrections: [entry, ...corrections],
        lastChange: lastChange?.classId === classId && lastChange.date === date
          ? null
          : lastChange,
      }
    }

    case 'mark': {
      const { classId, date, updates, event } = action

      if (finalized[classId]?.[date]) return state

      const previousDay = records[date]
      const changed = Object.entries(updates).filter(
        ([id, status]) => savedStatus(previousDay, id) !== status,
      )

      if (!changed.length) return state

      const nextDay = { ...previousDay, ...Object.fromEntries(changed) }
      const entries = changed
        .filter(([id]) => savedStatus(previousDay, id) !== 'Unmarked')
        .map(([id, to]) => ({
          id: `${event.id}-${id}`,
          classId,
          date,
          studentId: id,
          studentName: getStudentName(students, id),
          from: savedStatus(previousDay, id),
          to,
          by: event.by,
          at: event.at,
          action: 'Edit',
        }))

      return {
        ...state,
        records: { ...records, [date]: nextDay },
        corrections: [...entries, ...corrections],
        lastChange: {
          classId,
          date,
          previousDay,
          ids: changed.map(([id]) => id),
        },
      }
    }

    case 'undo': {
      const { classId, date, event } = action

      if (
        finalized[classId]?.[date] ||
        !lastChange ||
        lastChange.classId !== classId ||
        lastChange.date !== date
      ) {
        return state
      }

      const { previousDay, ids } = lastChange
      const nextRecords = { ...records }

      if (previousDay === undefined) {
        delete nextRecords[date]
      } else {
        nextRecords[date] = previousDay
      }

      const entries = ids.map((id) => ({
        id: `${event.id}-${id}`,
        classId,
        date,
        studentId: id,
        studentName: getStudentName(students, id),
        from: savedStatus(records[date], id),
        to: savedStatus(previousDay, id),
        by: event.by,
        at: event.at,
        action: 'Undo',
      }))

      return {
        ...state,
        records: nextRecords,
        corrections: [...entries, ...corrections],
        lastChange: null,
      }
    }

    default:
      return state
  }
}