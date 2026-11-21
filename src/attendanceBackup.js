import {
  classes,
  getToday,
  loadRecords,
  loadStudents,
  statuses,
} from './attendanceData.js'

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

  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  )
}

export function loadRegisterData() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey))

    if (isObject(saved) && isObject(saved.records) && Array.isArray(saved.students)) {
      return { students: saved.students, records: saved.records }
    }
  } catch {
    // Fall back to the storage keys used by earlier versions.
  }

  return { students: loadStudents(), records: loadRecords() }
}

export function saveRegisterData({ students, records }) {
  localStorage.setItem(storageKey, JSON.stringify({ students, records }))
}

export function downloadAttendanceBackup(students, records) {
  const backup = {
    format: backupFormat,
    version: backupVersion,
    exportedAt: new Date().toISOString(),
    students,
    records,
  }

  const file = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  })

  const url = URL.createObjectURL(file)
  const link = document.createElement('a')

  link.href = url
  link.download = `class-register-backup-${getToday()}.json`
  document.body.append(link)
  link.click()
  link.remove()

  setTimeout(() => URL.revokeObjectURL(url), 1000)
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

  const { students, records, exportedAt } = backup

  if (
    !Array.isArray(students) ||
    !isObject(records) ||
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

  return { students, records, exportedAt }
}