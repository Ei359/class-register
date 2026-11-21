function quoteCsvCell(value) {
  const text = String(value)
  // Prevent spreadsheet apps from interpreting a cell as a formula.
  const safeText = /^[\s\uFEFF]*[=+@-]|^[\t\r\n]/.test(text) ? "'" + text : text

  return `"${safeText.replaceAll('"', '""')}"`
}

export function downloadFile(file, filename) {
  let link
  let url

  try {
    url = URL.createObjectURL(file)
    link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.append(link)
    link.click()
  } catch {
    window.alert('The download could not start. Please try again.')
  } finally {
    link?.remove()

    if (url) {
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  }
}

export function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(quoteCsvCell).join(',')).join('\r\n')
  const file = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })

  downloadFile(file, filename)
}

export function downloadAttendanceCsv(date, roster, classroom) {
  const rows = [
    ['Date', 'Class', 'Student ID', 'Student Name', 'Attendance Status'],
    ...roster.map((student) => [
      date,
      classroom.name,
      student.id,
      student.name,
      student.status,
    ]),
  ]

  downloadCsv(`attendance-${classroom.id}-${date}.csv`, rows)
}