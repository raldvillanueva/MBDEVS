// PostgREST answers with at most 1,000 rows and says nothing about the
// rest, so a plain select on a table that can grow past that quietly
// under-reports: a list shows the first thousand, a count built from it is
// wrong, and nothing on screen suggests either.
//
// Pass a function that builds the query fresh each time. A Supabase query
// builder is single-use — reusing one for a second page sends the first
// page's range again.
//
//   const { data, error } = await fetchAllRows(() =>
//     supabase.from(table).select('*').order('created_at', { ascending: false }))

const PAGE = 1000

// Far past any sector's real size. If it is ever reached the console says
// so, rather than the page silently going back to under-reporting.
const MAX_ROWS = 100000

export async function fetchAllRows(buildQuery, { page = PAGE, max = MAX_ROWS } = {}) {
  const all = []

  for (let from = 0; from < max; from += page) {
    const { data, error } = await buildQuery().range(from, from + page - 1)

    // Hand back whatever arrived before the failure along with the error,
    // so a caller can show partial data rather than an empty page.
    if (error) return { data: all, error }
    if (!data || data.length === 0) break

    all.push(...data)
    if (data.length < page) break
  }

  if (all.length >= max) {
    console.warn(`fetchAllRows stopped at ${max} rows; the result is incomplete`)
  }

  return { data: all, error: null }
}
