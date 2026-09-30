# Dropdown Lists, new Job Descriptions, and self-service filters

## Set up (once)

1. **Tell whoever owns the Supabase project first.** This changes the live database.
2. Open the Supabase SQL Editor and run **`dropdown_lists_and_filters_setup.sql`**.
   - It only **adds** things: two new tables, two new empty columns (Submitted To, Date of Submitted), a few functions, and triggers. Nothing that exists today is changed or removed, so the site that is already online keeps working as before.
   - It is safe to run more than once.
3. Push the code to the repo. Vercel redeploys it.

Until the SQL has been run, the new code still works. The forms use the built-in lists, which already include the 18 new Job Descriptions. The Dropdown Lists tab and Saved filters show a message asking for the SQL to be run.

## What's new

### 18 new Job Descriptions
BROKEN-SEAL, RE-SEALING OF LSG & GRILLS, DISCONNECTION, RECONNECTION, EMPTY METER BASE, MULTI METERING, ENERGIZATION, REPREL, ERC SAMPLING, AMI, ASSIST TO REGULAR CREW, BASKET-ENERGIZE, INTERCHANGE, MC/PU -REPLACE, MC/PU -ENERGIZE, MC/PU -RETIRE, RETAIN METER, ROLAND.

They were added next to the existing values. Nothing was replaced. Each list combines every value that any form, drawer or filter offered before.

### Dropdown Lists (System Settings → Dropdown Lists tab)
System Settings now has two tabs:

- **General**: crew names and overdue thresholds. Super Admin only, as before.
- **Dropdown Lists**: Admin and Super Admin.

The Super Admin opens it from the Super Admin section. An Admin gets **System Settings** in the sector sidebar and sees only the Dropdown Lists tab. Encoders and Viewers get no access: the tab is hidden, the address redirects them, and the database refuses the change.

The page covers five lists: Job Description, Type of Meter, FO Type, For Batch and Billed Amount. On each list you can:

- **Add** values. Paste one per line to add several at once. Values are saved in capitals.
- **Rename** a value.
- **Reorder** values.
- **Hide** a value, and restore it later. Values are never deleted.
- **Limit a value to certain sectors**, for example AMI only. The default is all sectors.

Records are never rewritten. A record that uses a renamed or hidden value keeps that value, and the filters can still find it.

Status Crew and FO Action stay fixed because the app uses them for its own logic.

### Super Admin can see every list change
The database itself logs every add, rename, hide, restore and sector change. The page can't skip this, and the entry can't be deleted afterwards.

- **Super Admin → Audit Logs → "Dropdown list changes"** shows who made the change, when, and the before → after value.
- The Dropdown Lists tab also has a **Recent changes** panel.

### Search and filters: Field Orders, Pending Records, Archived
- **Search** now looks in every text column: FO#, service ID, crew, location, meters, serials, seals, tags, remarks and more. Use **"in: …"** to limit it to certain columns.
- **Every column header has a filter.**
  - Columns with a set of values open a tick list where you can pick several at once. The list shows how many records have each value. Values that appear in records but not on the list are marked **"not on list"** (for example old or imported spellings).
  - Other columns open a condition: contains, is empty, before/after/between dates, more/less than, checked or not checked, or aging more than N days.
- **+ Add filter** does the same thing, for any column.
- **Saved** stores named filter sets.
  - Each saved set belongs to the sector it was saved in.
  - Saved sets are private. Admin and Super Admin can share one with everyone in that sector.
- **Export (N)** on Field Orders downloads every record that matches the filters, not only the page on screen.

### Column filter switches (Super Admin)
**System Settings → General → Column Filters** has an on/off switch for each column. Switching one off applies to every account on Field Orders, Pending Records and Archived:

- the ▽ filter disappears from that column's header
- the column disappears from "+ Add filter"
- saved filters skip that part until the switch is turned back on

The search box still looks in that column, and no records change.

These switches use the existing settings table, so **they work without running any SQL**.

### New fields: Submitted To and Date of Submitted
These are in **Main Information** in the Add Record form and in both edit screens, and they are columns in the Field Orders table. You can filter, search, export and import them like any other column.

- Both fields are optional. Pending Records does not require them before sending a record to Field Orders.
- Admins can edit them directly on a record that is already in Field Orders, like Status Crew, For Check and For Batch.
- Submitted To has suggestions you can manage under Dropdown Lists → Submitted To. Any other name can still be typed.
- The partner API is not changed: it keeps sending exactly what it sent before.

**This part needs the SQL.** It adds the two columns to every sector's tables. Until the SQL is run, the app detects that the columns are missing and hides both fields completely, so saves keep working. After the SQL runs, the fields appear on the next page load.

### Import
When a file contains Job Description, Type of Meter, FO Type, For Batch or Billed Amount values that aren't on the lists, the import screen lists them with their counts. Typos like "REPLAC" are easy to spot there.

Admins can add each value to the list with one click. The import still brings the rows in exactly as written.

### Fix
On Field Orders, "Select all N records" followed by Archive or Delete ignored the **Year/Month** filter. It could therefore reach records outside the period on screen. It now uses exactly the filters on screen.

## Files
New:

- `dropdown_lists_and_filters_setup.sql`
- `src/lib/dropdownLists.js`
- `src/lib/DropdownContext.jsx`
- `src/lib/recordFilters.js`
- `src/lib/useColumnOptions.js`
- `src/lib/optionalColumns.js`
- `src/components/filters/*`
- `src/components/ListsRoute.jsx`
- `src/pages/DropdownLists.jsx` (shown as a tab inside System Settings)

Changed:

- `App.jsx`
- `Sidebar.jsx`
- `SuperAdminLayout.jsx`
- `SystemSettings.jsx`
- `AuditLogs.jsx`
- `auditLog.js`
- `FieldOrders.jsx`
- `PendingRecords.jsx`
- `ArchivedWorkOrders.jsx`
- `RecordForm.jsx`
- `ImportModal.jsx`
- `SettingsContext.jsx`
- `fieldLabels.js`
