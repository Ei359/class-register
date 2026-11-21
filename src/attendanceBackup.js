import {
  classes,
  getToday,
  loadRecords,
  loadStudents,
  getRoster,
  snapshotFinalizedRosters,
  statuses,
} from './attendanceData.js'
import { canFinalizeRoster, REOPEN_REASON_MAX } from './attendanceCorrections.js'
import { downloadFile } from './attendanceCsv.js'

const storageKey = 'class-register-data-v1'
const backupFormat = 'class-register'
const backupVersion = 1

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function loadRegisterData() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey))

    if (isObject(saved) && isObject(saved.records) && Array.isArray(saved.students)) {
      return {
        students: saved.students,
        records: saved.records,
        corrections: Array.isArray(saved.corrections) ? saved.corrections : [],
        finalized: snapshotFinalizedRosters(
          isObject(saved.finalized) ? saved.finalized : {},
          saved.students,
        ),
      }
    }
  } catch {
    // The original storage keys are also supported.
  }

  return {
    students: loadStudents(),
    records: loadRecords(),
    corrections: [],
    finalized: {},
  }
}

export function saveRegisterData({ students, records, corrections = [], finalized = {} }) {
  localStorage.setItem(
    storageKey,
    JSON.stringify({ students, records, corrections, finalized }),
  )
}

export function downloadAttendanceBackup(students, records, corrections = [], finalized = {}) {
  const backup = {
    format: backupFormat,
    version: backupVersion,
    exportedAt: new Date().toISOString(),
    students,
    records,
    corrections,
    finalized,
  }

  const file = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  })

  downloadFile(file, `class-register-backup-${getToday()}.json`)
}

export function parseAttendanceBackup(text) {
  let backup

  try {
    backup = JSON.parse(text)
  } catch {
    throw new Error('This file could not be read as JSON.')
  }

  if (
    !isObject(backup) ||
    backup.format !== backupFormat ||
    backup.version !== backupVersion
  ) {
    throw new Error('Choose a JSON backup exported by this version of Class Register.')
  }

  const { students, records, corrections = [], finalized = {}, exportedAt } = backup

  if (
    !Array.isArray(students) ||
    !isObject(records) ||
    !Array.isArray(corrections) ||
    !isObject(finalized) ||
    typeof exportedAt !== 'string' ||
    !Number.isFinite(Date.parse(exportedAt))
  ) {
    throw new Error('The backup is missing valid student, attendance, or export data.')
  }

  const studentsById = new Map()

  for (const student of students) {
    if (
      !isObject(student) ||
      typeof student.id !== 'string' ||
      !/^[A-Z0-9-]+$/.test(student.id) ||
      typeof student.name !== 'string' ||
      !student.name.trim() ||
      !classes.some((classroom) => classroom.id === student.classId) ||
      (student.startDate !== '' && !isDate(student.startDate)) ||
      (student.endDate !== '' && !isDate(student.endDate)) ||
      (student.startDate && student.endDate && student.endDate < student.startDate) ||
      studentsById.has(student.id)
    ) {
      throw new Error('The backup contains a duplicate student ID or an invalid student record.')
    }

    studentsById.set(student.id, student)
  }

  for (const [date, day] of Object.entries(records)) {
    if (!isDate(date) || !isObject(day)) {
      throw new Error('The backup contains an invalid register date.')
    }

    for (const [id, status] of Object.entries(day)) {
      const student = studentsById.get(id)

      if (!student || !statuses.includes(status)) {
        throw new Error('The backup contains an unknown student ID or attendance status.')
      }

      if (
        status !== 'Unmarked' &&
        ((student.startDate && date < student.startDate) ||
          (student.endDate && date > student.endDate))
      ) {
        throw new Error('A saved mark is outside the student’s enrollment dates.')
      }
    }
  }

  for (const [classId, registers] of Object.entries(finalized)) {
    if (!classes.some((item) => item.id === classId) || !isObject(registers)) {
      throw new Error('The backup contains an invalid finalized register.')
    }

    const classStudents = students.filter((student) => student.classId === classId)

    for (const [date, entry] of Object.entries(registers)) {
      if (
        !isDate(date) ||
        !hasValidActorAndTime(entry) ||
        !hasValidSnapshot(entry, classId, studentsById) ||
        !canFinalizeRoster(getRoster(classStudents, date, records[date], entry))
      ) {
        throw new Error('The backup contains an incomplete or invalid finalized register.')
      }
    }
  }

  const correctionIds = new Set()

  for (const entry of corrections) {
    if (
      !hasValidActorAndTime(entry) ||
      typeof entry.id !== 'string' ||
      !entry.id ||
      correctionIds.has(entry.id) ||
      !classes.some((item) => item.id === entry.classId) ||
      !isDate(entry.date) ||
      !isValidCorrection(entry, studentsById)
    ) {
      throw new Error('The backup contains an invalid correction or register event.')
    }

    correctionIds.add(entry.id)
  }

  return {
    students,
    records,
    corrections,
    finalized: snapshotFinalizedRosters(finalized, students),
    exportedAt,
  }
}

function hasValidSnapshot(entry, classId, studentsById) {
  const ids = entry.studentIds

  if (ids === undefined) return true

  return (
    Array.isArray(ids) &&
    ids.length > 0 &&
    new Set(ids).size === ids.length &&
    ids.every((id) => studentsById.get(id)?.classId === classId)
  )
}

function hasValidActorAndTime(entry) {
  return (
    isObject(entry) &&
    typeof entry.by === 'string' &&
    Boolean(entry.by.trim()) &&
    typeof entry.at === 'string' &&
    Number.isFinite(Date.parse(entry.at))
  )
}

function isValidCorrection(entry, studentsById) {
  if (entry.action === 'Finalize') {
    return entry.from === 'Open' && entry.to === 'Finalized'
  }

  if (entry.action === 'Reopen') {
    return (
      entry.from === 'Finalized' &&
      entry.to === 'Open' &&
      typeof entry.reason === 'string' &&
      Boolean(entry.reason.trim()) &&
      entry.reason.length <= REOPEN_REASON_MAX
    )
  }

  return (
    ['Edit', 'Undo'].includes(entry.action) &&
    studentsById.get(entry.studentId)?.classId === entry.classId &&
    typeof entry.studentName === 'string' &&
    Boolean(entry.studentName.trim()) &&
    statuses.includes(entry.from) &&
    statuses.includes(entry.to) &&
    entry.from !== entry.to
  )
}