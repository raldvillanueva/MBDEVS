<?php
/**
 * MBDEVS Field Order API — connection test.
 *
 * Drop this anywhere and run it:
 *     php mbdevs-test.php
 * or open it in a browser.
 *
 * It prints exactly where the request fails, instead of a blank page.
 */

$API_URL = 'https://ofgggclyliouuocgoovj.functions.supabase.co/field-orders';
$API_KEY = 'PASTE_YOUR_API_KEY_HERE';   // mbdevs_...

header('Content-Type: text/plain; charset=utf-8');

echo "MBDEVS API test\n";
echo str_repeat('=', 60), "\n\n";

// ---------------------------------------------------------------
// 0. Environment checks — catches the usual local-setup problems
// ---------------------------------------------------------------
if (!function_exists('curl_init')) {
    exit("FAIL: the cURL extension is not enabled.\n"
       . "Fix: uncomment ;extension=curl in php.ini and restart your server.\n");
}
echo "PHP version : ", PHP_VERSION, "\n";
echo "cURL        : ", curl_version()['version'], "\n";
echo "API key set : ", ($API_KEY === 'PASTE_YOUR_API_KEY_HERE' ? 'NO — still the placeholder!' : 'yes'), "\n\n";

if ($API_KEY === 'PASTE_YOUR_API_KEY_HERE') {
    exit("Paste the API key into \$API_KEY first.\n");
}

// ---------------------------------------------------------------
// 1. The request
// ---------------------------------------------------------------
$params = [
    'status'    => 'completed',
    'date_from' => '2025-10-01',
    'date_to'   => '2025-10-31',
    'limit'     => 3,
];

$url = $API_URL . '?' . http_build_query($params);
echo "GET $url\n\n";

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['x-api-key: ' . $API_KEY],
    CURLOPT_TIMEOUT        => 30,
]);

$body      = curl_exec($ch);
$httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErrNo = curl_errno($ch);
$curlErr   = curl_error($ch);
curl_close($ch);

// ---------------------------------------------------------------
// 2. Network-level failures (never reached the server)
// ---------------------------------------------------------------
if ($curlErrNo !== 0) {
    echo "FAIL: the request never reached the server.\n";
    echo "cURL error $curlErrNo: $curlErr\n\n";

    if (in_array($curlErrNo, [60, 77], true)) {
        echo "This is the SSL certificate problem, and it is the single most\n";
        echo "common failure on XAMPP / WAMP / local PHP on Windows.\n\n";
        echo "Proper fix:\n";
        echo "  1. Download https://curl.se/ca/cacert.pem\n";
        echo "  2. Save it somewhere permanent, e.g. C:\\php\\cacert.pem\n";
        echo "  3. In php.ini add:  curl.cainfo = \"C:\\php\\cacert.pem\"\n";
        echo "  4. Restart Apache / PHP\n\n";
        echo "Quick check only (NEVER ship this):\n";
        echo "  curl_setopt(\$ch, CURLOPT_SSL_VERIFYPEER, false);\n";
    } elseif ($curlErrNo === 6) {
        echo "DNS failed — check the URL spelling and your internet connection.\n";
    } elseif ($curlErrNo === 28) {
        echo "Timed out. Check for a firewall or proxy blocking outbound HTTPS.\n";
    }
    exit(1);
}

// ---------------------------------------------------------------
// 3. HTTP-level failures (server answered, but not with data)
// ---------------------------------------------------------------
echo "HTTP $httpCode\n\n";

if ($httpCode === 401) {
    echo "FAIL: the API key was rejected.\n";
    echo "  - Check for a stray space or line break when you pasted it\n";
    echo "  - The header name is exactly: x-api-key\n";
    echo "  - Confirm with the MBDEVS team that the key is current\n";
    echo "\nServer said: $body\n";
    exit(1);
}

if ($httpCode === 404) {
    echo "FAIL: wrong URL. It should end in /field-orders\n";
    exit(1);
}

if ($httpCode !== 200) {
    echo "FAIL: unexpected status.\nServer said: $body\n";
    exit(1);
}

// ---------------------------------------------------------------
// 4. Success — show what came back
// ---------------------------------------------------------------
$result = json_decode($body, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    echo "FAIL: response was not valid JSON (", json_last_error_msg(), ")\n";
    echo substr($body, 0, 500), "\n";
    exit(1);
}

echo "SUCCESS\n\n";
echo "Filters applied : ", json_encode($result['filters']), "\n";
echo "Matching records: ", $result['pagination']['total'], "\n";
echo "Returned now    : ", $result['pagination']['returned'], "\n";
echo "Next offset     : ", var_export($result['pagination']['next_offset'], true), "\n\n";

echo str_repeat('-', 60), "\n";
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
echo str_repeat('-', 60), "\n";
echo "\nConnection works. You can build against this now.\n";
