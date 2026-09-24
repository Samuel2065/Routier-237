<?php

namespace Tests\Feature\Reservations;

use App\Enums\TripStatus;
use App\Models\Agency;
use App\Models\Reservation;
use App\Models\Trip;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\Process\Process;
use Tests\TestCase;

/**
 * Contrôle de capacité concurrent (§8, §20, critère A6) : plusieurs processus PHP réservent
 * simultanément les dernières places d'un trajet, chacun avec sa propre connexion MySQL.
 *
 * Les autres processus doivent voir les données : ce test n'utilise donc pas de transaction
 * englobante (RefreshDatabase) et nettoie lui-même les tables.
 */
class ConcurrentBookingTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->artisan('migrate');
        $this->truncateAllTables();
    }

    protected function tearDown(): void
    {
        $this->truncateAllTables();

        parent::tearDown();
    }

    public function test_simultaneous_bookings_never_exceed_the_vehicle_capacity(): void
    {
        $agency = Agency::factory()->create();
        $vehicle = Vehicle::factory()->for($agency)->create(['capacity' => 5]);
        $trip = Trip::factory()->for($agency)->for($vehicle)->create([
            'travel_class_id' => $vehicle->travel_class_id,
            'departure_date' => now()->addDays(2)->toDateString(),
            'status' => TripStatus::Published,
        ]);
        $customers = User::factory()->count(8)->create();

        // 8 clients tentent chacun 1 place au même instant sur un trajet de 5 places.
        $startAt = microtime(true) + 4;
        $processes = $customers->map(function (User $customer) use ($trip, $startAt) {
            $process = new Process(
                [PHP_BINARY, base_path('tests/Support/book-concurrently.php'), $trip->id, $customer->id, 1, sprintf('%.6F', $startAt)],
                base_path(),
                [
                    'APP_ENV' => 'testing',
                    'DB_CONNECTION' => 'mysql',
                    'DB_DATABASE' => config('database.connections.mysql.database'),
                    'CACHE_STORE' => 'array',
                ],
            );
            $process->setTimeout(60);
            $process->start();

            return $process;
        });

        $outputs = $processes->map(function (Process $process) {
            $process->wait();

            return trim($process->getOutput()).trim($process->getErrorOutput());
        });

        $accepted = $outputs->filter(fn (string $output) => str_starts_with($output, 'OK '));
        $refused = $outputs->filter(fn (string $output) => $output === 'REFUSED 409');

        $this->assertCount(5, $accepted, "Sorties : \n".$outputs->implode("\n"));
        $this->assertCount(3, $refused, "Sorties : \n".$outputs->implode("\n"));
        $this->assertSame(5, (int) Reservation::query()->where('trip_id', $trip->id)->sum('passenger_count'));
        $this->assertSame(0, $trip->fresh()->remainingSeats());
    }

    private function truncateAllTables(): void
    {
        Schema::disableForeignKeyConstraints();

        foreach (Schema::getTableListing(DB::getDatabaseName(), schemaQualified: false) as $table) {
            if ($table !== 'migrations') {
                DB::table($table)->truncate();
            }
        }

        Schema::enableForeignKeyConstraints();
    }
}
