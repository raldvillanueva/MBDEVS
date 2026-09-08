<?php
/**
 * MBDEVS Field Order API — working PHP client.
 *
 * Run it:   php mbdevs-api.php
 * Or open:  http://localhost/mbdevs-api.php
 *
 * Only one thing to change: paste your API key below.
 */

// ── Config ────────────────────────────────────────────────────────────
// Note the hyphen in "field-orders". An underscore returns NOT_FOUND.
const MBDEVS_API_URL = 'https://ofgggclyliouuocgoovj.functions.supabase.co/field-orders';
const MBDEVS_API_KEY = 'PASTE_YOUR_API_KEY_HERE';   // mbdevs_...


/**
 * Fetch one page of field orders.
 *
 * Available filters:
 *   sector      rizal | manila | pasig | balintawak
 *   status      completed | cancelled | pending
 *   status_crew exact status value, e.g. "REVISITED FIELD COM."
 *   date_from   YYYY-MM-DD, inclusive
 *   date_to     YYYY-MM-DD, inclusive
 *   date_field  date_executed (default) | date_assign | date_returned
 *               | created_at | updated_at
 *   since       ISO timestamp — records changed since your last sync
 *   limit       default 500, max 1000
 *   offset      paging cursor
 */
function mbdevs_fetch(array $filters = []): array
{
    $url = MBDEVS_API_URL . '?' . http_build_query($filters);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        // The key is a HEADER. It cannot go in the URL — that is why opening
        // the link in a browser always returns Unauthorized.
        CURLOPT_HTTPHEADER     => ['x-api-key: ' . MBDEVS_API_KEY],
        CURLOPT_TIMEOUT        => 30,
    ]);

    $body  = curl_exec($ch);
    $code  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $errNo = curl_errno($ch);
    $err   = curl_error($ch);
    curl_close($ch);

    if ($errNo !== 0) {
        // 60/77 = missing CA bundle. Common on XAMPP/WAMP: download
        // https://curl.se/ca/cacert.pem and point curl.cainfo at it in php.ini
        throw new RuntimeException("Connection failed (cURL $errNo): $err");
    }
    if ($code === 401) {
        throw new RuntimeException('Unauthorized — check the API key and that the header is named x-api-key');
    }
    if ($code === 404) {
        throw new RuntimeException('Not found — the path must be /field-orders with a hyphen');
    }
    if ($code !== 200) {
        throw new RuntimeException("HTTP $code: $body");
    }

    return json_decode($body, true);
}


/**
 * Fetch every matching record, following pagination to the end.
 * Responses are capped at 1000 rows, so a single large request is never enough.
 */
function mbdevs_fetch_all(array $filters = []): array
{
    $all    = [];
    $offset = 0;

    do {
        $page = mbdevs_fetch($filters + ['limit' => 500, 'offset' => $offset]);
        $all  = array_merge($all, $page['data']);
        $offset = $page['pagination']['next_offset'];
    } while ($offset !== null);   // null means no more pages

    return $all;
}


// ── Example usage ─────────────────────────────────────────────────────
header('Content-Type: text/plain; charset=utf-8');

try {
    // Completed jobs executed in October 2025
    $result = mbdevs_fetch([
        'status'    => 'completed',
        'date_from' => '2025-10-01',
        'date_to'   => '2025-10-31',
        'limit'     => 5,
    ]);

    echo "Matching records: {$result['pagination']['total']}\n";
    echo "Showing: {$result['pagination']['returned']}\n\n";

    foreach ($result['data'] as $fo) {
        printf(
            "%-16s %-10s %-12s %-22s %s\n",
            $fo['field_order_no'] ?? '—',
            $fo['sector']         ?? '—',
            $fo['date_executed']  ?? '—',
            $fo['status_crew']    ?? '—',
            $fo['crew_name']      ?? '—'
        );
    }

    // To pull everything and store it, use:
    //
    //   foreach (mbdevs_fetch_all(['status' => 'completed']) as $fo) {
    //       // Upsert on $fo['id'] — never insert blindly. The same record can
    //       // arrive twice, and only overwrite when $fo['updated_at'] is newer
    //       // than the copy you already hold.
    //   }

} catch (RuntimeException $e) {
    echo 'ERROR: ', $e->getMessage(), "\n";
}
