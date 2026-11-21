export const classes = [
  { id: 'class-a', name: 'Web Development', section: 'Class A' },
  { id: 'class-b', name: 'Database Systems', section: 'Class B' },
]

export const statuses = ['Present', 'Late', 'Absent', 'Excused', 'Unmarked']
export const recordsKey = 'student-attendance-v1'
export const studentsKey = 'student-roster-v1'

const sampleStudents = [
  ['S001', 'Aye Chan', 'class-a'],
  ['S002', 'Htet Htet', 'class-a'],
  ['S003', 'Kaung Myat', 'class-a'],
  ['S004', 'May Thiri', 'class-a'],
  ['S005', 'Nyein Chan', 'class-a'],
  ['S006', 'Thiri Hlaing', 'class-b'],
  ['S007', 'Min Khant', 'class-b'],
  ['S008', 'Su Myat', 'class-b'],
  ['S009', 'Ye Htet', 'class-b'],
  ['S010', 'Pwint Phyu', 'class-b'],
  ['S011', 'Zin Mar', 'class-b'],
].map(([id, name, classId]) => ({
  id,
  name,
  classId,
  startDate: '',
  endDate: '',
}))

export function loadStudents() {
  try {
    const saved = JSON.parse(localStorage.getItem(studentsKey))

    if (Array.isArray(saved)) return saved
  } catch {
    // Use the sample roster if the saved roster cannot be read.
  }

  return sampleStudents
}

export function loadRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem(recordsKey))

    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      return saved
    }
  } catch {
    // Use an empty record set if attendance cannot be read.
  }

  return {}
}

export function getToday() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${now.getFullYear()}-${month}-${day}`
}

export function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function getRoster(students, date, dayRecords) {
  return students
    .filter((student) =>
      (!student.startDate || student.startDate <= date) &&
      (!student.endDate || student.endDate >= date),
    )
    .map((student) => {
      const status = dayRecords?.[student.id]

      return {
        ...student,
        status: statuses.includes(status) ? status : 'Unmarked',
      }
    })
}

export function countStatuses(roster) {
  const counts = { Present: 0, Late: 0, Absent: 0, Excused: 0, Unmarked: 0 }

  for (const student of roster) {
    counts[student.status] += 1
  }

  return counts
}