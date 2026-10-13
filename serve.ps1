# Minimal static file server on raw sockets, so no URL-ACL or admin rights are
# needed. Serves the directory this script lives in.
#
#   powershell -ExecutionPolicy Bypass -File serve.ps1 [-Port 8378] [-Strict]
#
# If the port is busy it says who holds it and moves to the next free one,
# unless -Strict is given, in which case it stops.
#
# It also accepts POST /save?name=<file>, writing the request body under
# results/. That exists so long benchmark runs can stream their raw per-state
# data straight to disk instead of being read back through a tool.
param(
    [int]$Port = 8378,
    [switch]$Strict
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$resultsDir = Join-Path $root "results"
if (-not (Test-Path $resultsDir)) { New-Item -ItemType Directory -Force $resultsDir | Out-Null }

function Get-PortHolder([int]$p) {
    try {
        $conn = Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction Stop | Select-Object -First 1
    } catch {
        return $null
    }
    if (-not $conn) { return $null }
    $name = "unknown"
    try { $name = (Get-Process -Id $conn.OwningProcess -ErrorAction Stop).ProcessName } catch {}
    return [pscustomobject]@{ Pid = $conn.OwningProcess; Name = $name }
}

# Bind before anything else. Without this the original script sailed past a
# failed Start() and then spun forever on AcceptTcpClient, printing
# "Not listening, you must call Start() before AcceptTcpClient()" per pass.
$listener = $null
$startPort = $Port
for ($p = $startPort; $p -lt $startPort + 10; $p++) {
    $holder = Get-PortHolder $p
    if ($holder) {
        Write-Warning "Port $p is already in use by $($holder.Name) (PID $($holder.Pid))."
        if ($Strict) {
            Write-Host "Stop it with:  Stop-Process -Id $($holder.Pid) -Force"
            exit 1
        }
        continue
    }
    $candidate = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $p)
    try {
        $candidate.Start()
        $listener = $candidate
        $Port = $p
        break
    } catch {
        Write-Warning "Could not bind port ${p}: $($_.Exception.Message)"
        try { $candidate.Stop() } catch {}
        if ($Strict) { exit 1 }
    }
}

if (-not $listener) {
    Write-Error "No free port found in $startPort..$($startPort + 9). Nothing started."
    exit 1
}

Write-Host "Serving $root"
Write-Host "  http://127.0.0.1:$Port/web/index.html"
Write-Host "  POST /save?name=<file> writes into $resultsDir"
Write-Host "Press Ctrl+C to stop."

$types = @{
    ".html" = "text/html; charset=utf-8"
    ".js"   = "text/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".txt"  = "text/plain; charset=utf-8"
    ".csv"  = "text/csv; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
}

function Send-Response($stream, [string]$status, [string]$ctype, [byte[]]$bytes, [string]$extra) {
    $head = "HTTP/1.1 $status`r`nContent-Type: $ctype`r`nContent-Length: $($bytes.Length)`r`n" +
            "Access-Control-Allow-Origin: *`r`nCache-Control: no-store`r`nConnection: close`r`n$extra`r`n"
    $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
    $stream.Write($hb, 0, $hb.Length)
    if ($bytes.Length -gt 0) { $stream.Write($bytes, 0, $bytes.Length) }
    $stream.Flush()
}

try {
    while ($true) {
        if (-not $listener.Server -or -not $listener.Server.IsBound) {
            Write-Error "Listener is no longer bound. Stopping."
            break
        }

        $client = $null
        try {
            $client = $listener.AcceptTcpClient()
        } catch {
            Write-Error "Accept failed: $($_.Exception.Message). Stopping."
            break
        }

        try {
            $client.ReceiveTimeout = 30000
            $stream = $client.GetStream()

            # Read until the end of the headers, keeping whatever body bytes
            # arrived in the same packets.
            $raw = New-Object System.Collections.Generic.List[byte]
            $buf = New-Object byte[] 65536
            $headerLen = -1
            while ($headerLen -lt 0) {
                $n = $stream.Read($buf, 0, $buf.Length)
                if ($n -le 0) { break }
                for ($i = 0; $i -lt $n; $i++) { $raw.Add($buf[$i]) }
                $probe = [System.Text.Encoding]::ASCII.GetString($raw.ToArray())
                $idx = $probe.IndexOf("`r`n`r`n")
                if ($idx -ge 0) { $headerLen = $idx + 4 }
                if ($raw.Count -gt 2000000 -and $headerLen -lt 0) { break }
            }
            if ($headerLen -lt 0) { continue }

            $headerText = [System.Text.Encoding]::ASCII.GetString($raw.ToArray(), 0, $headerLen)
            $lines = $headerText -split "`r`n"
            $parts = $lines[0] -split " "
            $method = $parts[0]
            $target = if ($parts.Length -gt 1) { $parts[1] } else { "/" }

            if ($method -eq "POST") {
                $len = 0
                foreach ($l in $lines) {
                    if ($l -match '^(?i)Content-Length:\s*(\d+)$') { $len = [int]$Matches[1] }
                }
                # Body bytes already buffered, plus whatever is still coming.
                $body = New-Object System.Collections.Generic.List[byte]
                for ($i = $headerLen; $i -lt $raw.Count; $i++) { $body.Add($raw[$i]) }
                while ($body.Count -lt $len) {
                    $n = $stream.Read($buf, 0, [Math]::Min($buf.Length, $len - $body.Count))
                    if ($n -le 0) { break }
                    for ($i = 0; $i -lt $n; $i++) { $body.Add($buf[$i]) }
                }

                $name = "post.txt"
                if ($target -match '[?&]name=([^&]+)') { $name = [System.Uri]::UnescapeDataString($Matches[1]) }
                $name = [System.IO.Path]::GetFileName($name)
                if ([string]::IsNullOrWhiteSpace($name)) { $name = "post.txt" }

                [System.IO.File]::WriteAllBytes((Join-Path $resultsDir $name), $body.ToArray())
                Write-Host ("saved {0} ({1} bytes)" -f $name, $body.Count)
                Send-Response $stream "200 OK" "text/plain" ([System.Text.Encoding]::UTF8.GetBytes("ok $($body.Count)")) ""
                continue
            }

            if ($method -eq "OPTIONS") {
                Send-Response $stream "204 No Content" "text/plain" (New-Object byte[] 0) "Access-Control-Allow-Methods: GET, POST, OPTIONS`r`nAccess-Control-Allow-Headers: Content-Type`r`n"
                continue
            }

            $path = ($target -split "\?")[0]

            # Redirect rather than serving the app at "/", otherwise its
            # relative script and worker URLs resolve against the wrong base
            # and the page loads as inert HTML.
            if ($path -eq "/") {
                Send-Response $stream "302 Found" "text/plain" (New-Object byte[] 0) "Location: /web/index.html`r`n"
                continue
            }
            if ($path.EndsWith("/")) { $path += "index.html" }

            $rel = $path.TrimStart("/") -replace "/", "\"
            $full = [System.IO.Path]::GetFullPath((Join-Path $root $rel))

            if ($full.StartsWith($root) -and (Test-Path -LiteralPath $full -PathType Leaf)) {
                $bytes = [System.IO.File]::ReadAllBytes($full)
                $ext = [System.IO.Path]::GetExtension($full).ToLower()
                $ctype = $types[$ext]
                if (-not $ctype) { $ctype = "application/octet-stream" }
                Send-Response $stream "200 OK" $ctype $bytes ""
            } else {
                Send-Response $stream "404 Not Found" "text/plain" ([System.Text.Encoding]::UTF8.GetBytes("not found: $path")) ""
            }
        } catch {
            Write-Warning "Request failed: $($_.Exception.Message)"
        } finally {
            if ($client) { $client.Close() }
        }
    }
} finally {
    try { $listener.Stop() } catch {}
    Write-Host "Stopped."
}
