<?php

// Reads the DB connection from the app's own config (shared/.env), so the
// deploy scripts never handle the password themselves.
//   php mysql-defaults.php <backend> cnf  -> MySQL client options file on stdout
//                                           (caller writes it with umask 077 and deletes it)
//   php mysql-defaults.php <backend> name -> database name only
// Never print the cnf output to a log.

$base = $argv[1] ?? '';
$mode = $argv[2] ?? 'cnf';

require $base.'/vendor/autoload.php';
$app = require $base.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$c = config('database.connections.'.config('database.default'));
if (($c['driver'] ?? '') !== 'mysql' && ($c['driver'] ?? '') !== 'mariadb') {
    fwrite(STDERR, "DB_CONNECTION must be mysql or mariadb\n");
    exit(1);
}

if ($mode === 'name') {
    echo $c['database'], "\n";
    exit(0);
}

// Option-file values are double-quoted; escape " and the backslash (chr 92).
$q = fn ($v) => '"'.addcslashes((string) $v, '"'.chr(92)).'"';

echo "[client]\n";
echo 'host='.$q($c['host'] ?? 'localhost')."\n";
echo 'port='.$q($c['port'] ?? 3306)."\n";
echo 'user='.$q($c['username'] ?? '')."\n";
echo 'password='.$q($c['password'] ?? '')."\n";
