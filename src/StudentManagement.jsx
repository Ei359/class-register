import { useRef, useState } from 'react'
import { formatDate, getToday, statuses } from './attendanceData.js'

function newStudentFields() {
  return { id: '', name: '', startDate: getToday(), endDate: '' }
}

export default function StudentManagement({ students, records, classroom, onSave }) {
  const [editingId, setEditingId] = useState(null)
  const [fields, setFields] = useState(newStudentFields)
  const [message, setMessage] = useState('')
  const nameInput = useRef(null)

  const classStudents = students.filter((student) => student.classId === classroom.id)

  function changeField(event) {
    const { name, value } = event.target
    setFields((previous) => ({ ...previous, [name]: value }))
    setMessage('')
  }

  function editStudent(student) {
    setEditingId(student.id)
    setFields(student)
    setMessage('')
    nameInput.current?.focus()
  }

  function resetForm() {
    setEditingId(null)
    setFields(newStudentFields())
  }

  function saveStudent(event) {
    event.preventDefault()

    const id = fields.id.trim().toUpperCase()
    const name = fields.name.trim()
    const { startDate, endDate } = fields

    if (!id || !name) {
      setMessage('Enter a student ID and name.')
      return
    }

    if (!/^[A-Z0-9-]+$/.test(id)) {
      setMessage('Use letters, numbers, or hyphens for the student ID.')
      return
    }

    if (!editingId && students.some((student) => student.id === id)) {
      setMessage('That student ID is already in use.')
      return
    }

    if (endDate && startDate && endDate < startDate) {
      setMessage('The last day must be on or after the first day.')
      return
    }

    const hasLaterMark = endDate && Object.entries(records).some(([date, day]) => {
      const status = day?.[id]
      return date > endDate && status !== 'Unmarked' && statuses.includes(status)
    })

    if (hasLaterMark) {
      setMessage('Choose a last day on or after this student’s latest attendance mark.')
      return
    }

    const student = { id, name, classId: classroom.id, startDate, endDate }
    const error = onSave(student)

    if (error) {
      setMessage(error)
      return
    }

    resetForm()
    setMessage(editingId ? 'Student updated.' : 'Student added.')
  }

  return (
    <section className="panel" id="students" aria-labelledby="students-heading">
      <div className="panel-header">
        <h2 id="students-heading">Manage students</h2>
      </div>

      <form className="student-form" onSubmit={saveStudent}>
        <label>
          Student ID
          <input
            name="id"
            value={fields.id}
            onChange={changeField}
            readOnly={editingId !== null}
            required
          />
        </label>

        <label>
          Student name
          <input
            ref={nameInput}
            name="name"
            value={fields.name}
            onChange={changeField}
            required
          />
        </label>

        {(!editingId || fields.startDate) && (
          <label>
            First day in class
            <input
              name="startDate"
              type="date"
              value={fields.startDate}
              onChange={changeField}
              readOnly={editingId !== null}
              required
            />
          </label>
        )}

        {editingId && (
          <label>
            Last day in class (optional)
            <input
              name="endDate"
              type="date"
              value={fields.endDate}
              onChange={changeField}
            />
          </label>
        )}

        <button className="primary" type="submit">
          {editingId ? 'Save student' : 'Add student'}
        </button>

        {editingId && (
          <button
            type="button"
            onClick={() => {
              resetForm()
              setMessage('')
            }}
          >
            Cancel
          </button>
        )}

        {message && <p className="student-message" role="status">{message}</p>}
      </form>

      <div className="table-container">
        <table aria-label={`${classroom.name} student list`}>
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Student</th>
              <th scope="col">First day</th>
              <th scope="col">Last day</th>
              <th scope="col">Action</th>
            </tr>
          </thead>

          <tbody>
            {classStudents.map((student) => (
              <tr key={student.id}>
                <td>{student.id}</td>
                <th scope="row">{student.name}</th>
                <td>{student.startDate ? formatDate(student.startDate) : '—'}</td>
                <td>{student.endDate ? formatDate(student.endDate) : '—'}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => editStudent(student)}
                    aria-label={`Edit ${student.name}`}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}