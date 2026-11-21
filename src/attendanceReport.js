import { countStatuses, getRoster } from './attendanceData.js'

export function formatAttendanceRate(counts) {
  const attending = counts.Present + counts.Late
  const eligible = attending + counts.Absent

  return eligible ? `${Math.round(attending / eligible * 100)}%` : '—'
}

export function buildAttendanceReport(students, records, from, to, finalized = {}) {
  const days = []
  const totals = countStatuses([])
  const studentTotals = new Map()

  if (!from || !to || from > to) {
    return { days, totals, students: [] }
  }

  const dates = Object.keys(records)
    .filter((date) => date >= from && date <= to)
    .sort()

  for (const date of dates) {
    const roster = getRoster(students, date, records[date], finalized[date])
    const counts = countStatuses(roster)

    if (counts.Unmarked === roster.length) continue

    days.push({ date, counts })

    for (const student of roster) {
      if (!studentTotals.has(student.id)) {
        studentTotals.set(student.id, {
          id: student.id,
          name: student.name,
          counts: countStatuses([]),
        })
      }

      totals[student.status] += 1
      studentTotals.get(student.id).counts[student.status] += 1
    }
  }

  return {
    days,
    totals,
    students: [...studentTotals.values()].sort(
      (first, second) => first.name.localeCompare(second.name),
    ),
  }
}