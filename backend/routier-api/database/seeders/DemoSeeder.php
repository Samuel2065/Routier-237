<?php

namespace Database\Seeders;

use App\Enums\RecordStatus;
use App\Enums\RoleName;
use App\Enums\TripStatus;
use App\Enums\VehicleStatus;
use App\Models\Agency;
use App\Models\City;
use App\Models\Organization;
use App\Models\TravelClass;
use App\Models\TravelRoute;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Données de démonstration (hors production). Toutes les données sont fictives.
 * Mot de passe de tous les comptes : « password » (documenté dans le README).
 *
 * Ne s'exécute qu'une fois : ignoré si l'organisation de démonstration existe déjà.
 */
class DemoSeeder extends Seeder
{
    public const ORGANIZATION_SLUG = 'routier-demo-voyages';

    public const PASSWORD = 'password';

    public function run(): void
    {
        if (Organization::where('slug', self::ORGANIZATION_SLUG)->exists()) {
            $this->command?->info('Données de démonstration déjà présentes : ignoré.');

            return;
        }

        $city = fn (string $slug) => City::where('slug', $slug)->firstOrFail();
        $vip = TravelClass::where('code', TravelClass::VIP)->firstOrFail();
        $classique = TravelClass::where('code', TravelClass::CLASSIQUE)->firstOrFail();

        $organization = Organization::create([
            'name' => 'Routier Démo Voyages',
            'slug' => self::ORGANIZATION_SLUG,
            'email' => 'contact@routier237.test',
            'phone' => '+237600000000',
            'address' => 'Bertoua, Cameroun',
            'status' => RecordStatus::Active,
        ]);

        $bertoua = $organization->agencies()->create([
            'city_id' => $city('bertoua')->id,
            'name' => 'Agence Bertoua Centre',
            'email' => 'bertoua@routier237.test',
            'phone' => '+237600000001',
            'address' => 'Carrefour Tigre, Bertoua',
            'description' => 'Agence pilote de Routier+237.',
            'status' => RecordStatus::Active,
        ]);

        $yaounde = $organization->agencies()->create([
            'city_id' => $city('yaounde')->id,
            'name' => 'Agence Yaoundé Mvan',
            'email' => 'yaounde@routier237.test',
            'phone' => '+237600000002',
            'address' => 'Gare routière de Mvan, Yaoundé',
            'description' => null,
            'status' => RecordStatus::Active,
        ]);

        $this->seedUsers($organization, $bertoua, $yaounde);

        // Itinéraires (durées et distances indicatives).
        $routes = [];
        foreach ([
            ['bertoua', 'yaounde', 330, 345],
            ['bertoua', 'douala', 540, 590],
            ['yaounde', 'douala', 240, 240],
            ['bertoua', 'batouri', 120, 95],
        ] as [$from, $to, $minutes, $km]) {
            foreach ([[$from, $to], [$to, $from]] as [$a, $b]) {
                $routes["$a-$b"] = TravelRoute::create([
                    'departure_city_id' => $city($a)->id,
                    'destination_city_id' => $city($b)->id,
                    'estimated_duration_minutes' => $minutes,
                    'distance_km' => $km,
                    'status' => RecordStatus::Active,
                ]);
            }
        }

        // Véhicules : chaque véhicule a une seule classe et sa propre capacité.
        $vehicle = fn (Agency $agency, TravelClass $class, string $plate, string $brand, string $model, int $capacity, array $amenities) => $agency->vehicles()->create([
            'travel_class_id' => $class->id,
            'registration_number' => $plate,
            'brand' => $brand,
            'model' => $model,
            'capacity' => $capacity,
            'amenities' => $amenities,
            'status' => VehicleStatus::Active,
        ]);

        $bVip = $vehicle($bertoua, $vip, 'ES 214 AB', 'Toyota', 'Coaster', 30, ['climatisation', 'sièges inclinables']);
        $bClassic1 = $vehicle($bertoua, $classique, 'ES 327 CD', 'Mercedes-Benz', 'O500', 70, []);
        $bClassic2 = $vehicle($bertoua, $classique, 'ES 441 EF', 'Yutong', 'ZK6122', 65, []);
        $yVip1 = $vehicle($yaounde, $vip, 'CE 108 GH', 'Toyota', 'Coaster', 30, ['climatisation']);
        $yClassic = $vehicle($yaounde, $classique, 'CE 552 JK', 'Yutong', 'ZK6122', 70, []);
        $yVip2 = $vehicle($yaounde, $vip, 'CE 619 LM', 'Hyundai', 'County', 29, ['climatisation', 'prises USB']);

        // Programme quotidien : un trajet par véhicule et par jour.
        $schedule = [
            [$bertoua, $bVip, 'bertoua-yaounde', '06:00', 7000],
            [$bertoua, $bClassic1, 'bertoua-yaounde', '07:30', 5000],
            [$bertoua, $bClassic2, 'bertoua-douala', '18:00', 9000],
            [$yaounde, $yVip1, 'yaounde-bertoua', '06:30', 7000],
            [$yaounde, $yClassic, 'yaounde-bertoua', '13:00', 5000],
            [$yaounde, $yVip2, 'yaounde-douala', '08:00', 6000],
        ];

        $today = Carbon::today();

        // Hier : trajets terminés (historique). J+1 à J+7 : publiés. J+8 à J+10 : brouillons.
        foreach (range(-1, 10) as $offset) {
            $date = $today->copy()->addDays($offset)->toDateString();

            foreach ($schedule as $index => [$agency, $bus, $routeKey, $time, $price]) {
                $status = match (true) {
                    $offset < 0 => TripStatus::Completed,
                    $offset === 0 => null, // pas de trajet le jour même dans la démo
                    $offset <= 7 => TripStatus::Published,
                    default => TripStatus::Draft,
                };

                if ($status === null) {
                    continue;
                }

                // Un trajet annulé pour illustrer le statut (J+2, Yaoundé → Bertoua Classique).
                if ($offset === 2 && $index === 4) {
                    $status = TripStatus::Cancelled;
                }

                $agency->trips()->create([
                    'route_id' => $routes[$routeKey]->id,
                    'vehicle_id' => $bus->id,
                    'travel_class_id' => $bus->travel_class_id,
                    'departure_date' => $date,
                    'departure_time' => $time,
                    'price' => $price,
                    'status' => $status,
                ]);
            }
        }
    }

    private function seedUsers(Organization $organization, Agency $bertoua, Agency $yaounde): void
    {
        $user = function (string $name, string $email, RoleName $role, ?Organization $org = null): User {
            $user = new User([
                'name' => $name,
                'email' => $email,
                'password' => self::PASSWORD,
            ]);
            $user->organization_id = $org?->id;
            $user->email_verified_at = now();
            $user->save();
            $user->assignRole($role->value);

            return $user;
        };

        $user('Administrateur Plateforme', 'admin@routier237.test', RoleName::SuperAdmin);
        $user('Directeur Démo', 'directeur@routier237.test', RoleName::Director, $organization);

        $employees = [
            [$bertoua, 'BTA-001', 'Responsable Bertoua', 'manager.bertoua@routier237.test', RoleName::AgencyManager],
            [$bertoua, 'BTA-002', 'Guichetier Bertoua', 'guichet.bertoua@routier237.test', RoleName::CounterClerk],
            [$bertoua, 'BTA-003', 'Comptable Bertoua', 'comptable.bertoua@routier237.test', RoleName::Accountant],
            [$bertoua, 'BTA-004', 'Chauffeur Bertoua', 'chauffeur.bertoua@routier237.test', RoleName::Driver],
            [$yaounde, 'YDE-001', 'Responsable Yaoundé', 'manager.yaounde@routier237.test', RoleName::AgencyManager],
        ];

        foreach ($employees as [$agency, $number, $name, $email, $role]) {
            $account = $user($name, $email, $role);

            $profile = $agency->employeeProfiles()->make([
                'employee_number' => $number,
                'hired_at' => '2026-01-05',
                'status' => 'active',
            ]);
            $profile->user()->associate($account);
            $profile->save();

            if ($role === RoleName::Driver) {
                $profile->driverProfile()->create([
                    'license_number' => 'DEMO-PERMIS-0001',
                    'license_expires_at' => '2030-12-31',
                    'status' => RecordStatus::Active,
                ]);
            }
        }

        $customer = $user('Client Démo', 'client@routier237.test', RoleName::Customer);
        $customer->phone = '+237699000000';
        $customer->save();
    }
}
