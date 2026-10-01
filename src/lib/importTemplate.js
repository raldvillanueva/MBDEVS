// The blank import template, as a real Excel file.
//
// It used to be a CSV, which cannot carry a colour, a bold weight or a
// column width — so it arrived looking nothing like the sheet people
// already work in, and read as something half-finished. This writes a
// .xlsx laid out like their own file.
//
// The columns are exactly the ones their export carries, and each header
// is one the importer matches on its own, so a filled-in copy needs
// nothing picked by hand on the mapping screen.

const HEAD_DARK = 'FF404040'
const HEAD_BLUE = 'FF2F5597'
const HEAD_GOLD = 'FFFFC000'
const HEAD_GREY = 'FF808080'

// label must stay in step with ALIASES in ImportModal — see the test in
// the commit that added this, which checks every one of them still maps.
const COLUMNS = [
  { label: 'DATE ASSIGN',          width: 16, fill: HEAD_DARK },
  { label: 'FO ACTION',            width: 18, fill: HEAD_DARK },
  { label: 'FIELD ORDER/FO',       width: 20, fill: HEAD_BLUE },
  { label: 'SERVICE NUMBER',       width: 18, fill: HEAD_DARK },
  // Gold in their sheet too: it is the number the crew reads off the
  // meter, so it is the one they look for first.
  { label: 'REMOVED METER NUMBER', width: 22, fill: HEAD_GOLD, dark: true },
  { label: 'LOCATION',             width: 40, fill: HEAD_GREY },
  { label: 'CREW NAME',            width: 34, fill: HEAD_GREY },
]

export async function downloadImportTemplate() {
  // Loaded on demand. The writer is large and most people never ask for
  // the template, so it has no business in the main bundle.
  const ExcelJS = (await import('exceljs')).default

  const wb = new ExcelJS.Workbook()
  wb.created = new Date()
  const ws = wb.addWorksheet('Field Orders', {
    // The header stays put while they scroll, which is the whole reason
    // their own sheet has it frozen.
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  ws.columns = COLUMNS.map(c => ({ header: c.label, width: c.width }))

  const header = ws.getRow(1)
  header.height = 28

  COLUMNS.forEach((col, i) => {
    const cell = header.getCell(i + 1)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: col.fill } }
    cell.font = {
      bold: true,
      size: 11,
      // White on the dark fills, black on the gold — white on gold is
      // unreadable.
      color: { argb: col.dark ? 'FF000000' : 'FFFFFFFF' },
    }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    }
  })

  // The dropdown arrows on row 1, same as the sheet they are used to.
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } }

  // The date column is deliberately left as a normal column. Forcing it to
  // text made Excel store a typed date as its raw serial number with a text
  // format, and the importer then read 46294 instead of a date. Left alone,
  // a real date stays a real date — which is unambiguous, unlike the
  // 09/01/2026 that a text column would have produced.

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'field_orders_import_template.xlsx'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const TEMPLATE_HEADERS = COLUMNS.map(c => c.label)
