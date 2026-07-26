import * as XLSX from 'xlsx'

export function exportTicketsToExcel(tickets, filename = 'tickets-export') {
  if (!tickets || tickets.length === 0) {
    alert('No tickets to export.')
    return
  }

  const rows = tickets.map(t => ({
    'Ticket #': `IT-${t.num}`,
    'Title': t.title,
    'Status': t.status,
    'Priority': t.priority,
    'Category': t.category,
    'Department': t.department || t.requester_department || '',
    'Requester': t.requester_name,
    'Requester Email': t.requester_email,
    'Requester Phone': t.requester_phone || '',
    'Requester Type': t.requester_type,
    'Assigned To': t.assigned_to || 'Unassigned',
    'Tags': (t.tags || []).join(', '),
    'Sentiment': t.sentiment || '',
    'Description': t.description || '',
    'Created At': t.created_at ? new Date(t.created_at).toLocaleString() : '',
    'Updated At': t.updated_at ? new Date(t.updated_at).toLocaleString() : '',
    'Resolved At': t.resolved_at ? new Date(t.resolved_at).toLocaleString() : '',
  }))

  const worksheet = XLSX.utils.json_to_sheet(rows)
  worksheet['!cols'] = [
    { wch: 10 }, { wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
    { wch: 16 }, { wch: 18 }, { wch: 24 }, { wch: 14 }, { wch: 12 },
    { wch: 16 }, { wch: 20 }, { wch: 12 }, { wch: 40 }, { wch: 18 },
    { wch: 18 }, { wch: 18 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tickets')

  const stamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `${filename}-${stamp}.xlsx`)
}
