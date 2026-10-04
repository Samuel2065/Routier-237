<?php

namespace Tests\Feature\Security;

use App\Enums\AccessSpace;
use App\Enums\RoleName;
use App\Models\Agency;
use App\Models\City;
use App\Models\EmployeeProfile;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\TravelRoute;
use App\Models\Trip;
use App\Models\User;
use App\Models\Vehicle;
use App\Notifications\PaymentFailed;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\Concerns\AuthenticatesInSpace;
use Tests\Concerns\CreatesUsers;
use Tests\TestCase;

/**
 * Séparation des espaces sur les vraies routes de l'API : chaque route privée enregistrée
 * est appelée sans jeton (401) puis avec le jeton de chaque espace non autorisé (403).
 *
 * Une nouvelle route privée est couverte automatiquement, sans modifier ce test.
 */
class RouteAccessMatrixTest extends TestCase
{
    use AuthenticatesInSpace, CreatesUsers, RefreshDatabase;

    /** @var array<string, int|string> */
    private array $parameters;

    /** @var array<string, User> */
    private array $users;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRoles();

        // Ressources réelles : chaque paramètre d'URL désigne un enregistrement existant,
        // pour que le refus vienne du contrôle d'accès et non d'un 404.
        $agency = Agency::factory()->create();
        $customer = $this->customer();
        $trip = Trip::factory()->for($agency)->create();
        $reservation = Reservation::factory()->for($trip)->for($customer)->create();
        $payment = Payment::factory()->for($reservation)->create();
        $customer->notify(new PaymentFailed($payment));

        $this->users = [
            'customer' => $customer,
            'agency' => $this->staff(RoleName::AgencyManager, $agency),
            'admin' => $this->superAdmin(),
        ];

        $this->parameters = [
            'organization' => $agency->organization_id,
            'agency' => $agency->id,
            'vehicle' => Vehicle::factory()->for($agency)->create()->id,
            'employee' => EmployeeProfile::query()->where('agency_id', $agency->id)->value('id'),
            'travelRoute' => TravelRoute::factory()->create()->id,
            'trip' => $trip->id,
            'reservation' => $reservation->id,
            'payment' => $payment->id,
            'notification' => $customer->notifications()->value('id'),
            'user' => $customer->id,
            'city' => City::factory()->create()->id,
        ];
    }

    public function test_guests_are_refused_on_every_private_route(): void
    {
        foreach ($this->privateRoutes() as [$method, $uri]) {
            $this->app['auth']->forgetGuards();

            $status = $this->withoutToken()->json($method, $uri)->status();
            $this->assertSame(401, $status, "$method $uri sans jeton");
        }
    }

    public function test_tokens_of_another_space_are_refused_on_every_private_route(): void
    {
        $checked = 0;

        foreach ($this->privateRoutes() as [$method, $uri, $allowedSpaces]) {
            foreach (AccessSpace::cases() as $space) {
                if (in_array($space, $allowedSpaces, true)) {
                    continue;
                }

                $status = $this->actingInSpace($this->users[$space->value], $space)->json($method, $uri)->status();
                $this->assertSame(403, $status, "$method $uri avec un jeton « {$space->value} »");
                $checked++;
            }
        }

        // Garde-fou : la matrice couvre bien les espaces client, agence et administrateur.
        $this->assertGreaterThan(80, $checked);
    }

    /**
     * Routes de l'API protégées par auth:sanctum, avec les espaces attendus d'après leur préfixe :
     * la règle est fixée ici, indépendamment du middleware déclaré dans routes/api.php.
     *
     * @return list<array{string, string, list<AccessSpace>}>
     */
    private function privateRoutes(): array
    {
        $routes = [];

        foreach (Route::getRoutes()->getRoutes() as $route) {
            $middleware = $route->gatherMiddleware();

            if (! str_starts_with($route->uri(), 'api/v1/') || ! in_array('auth:sanctum', $middleware, true)) {
                continue;
            }

            $this->assertTrue(
                collect($middleware)->contains(fn ($name) => $name === 'space' || str_starts_with($name, 'space:')),
                "La route {$route->uri()} doit utiliser le middleware « space ».",
            );

            $allowedSpaces = $this->expectedSpaces($route->uri());

            $uri = preg_replace_callback('/\{(\w+)\??\}/', function (array $match) use ($route) {
                $this->assertArrayHasKey($match[1], $this->parameters, "Paramètre {$match[1]} de {$route->uri()} sans ressource de test.");

                return (string) $this->parameters[$match[1]];
            }, $route->uri());

            foreach (array_diff($route->methods(), ['HEAD']) as $method) {
                $routes[] = [$method, '/'.$uri, $allowedSpaces];
            }
        }

        $this->assertGreaterThan(50, count($routes));

        return $routes;
    }

    /**
     * @return list<AccessSpace>
     */
    private function expectedSpaces(string $uri): array
    {
        $path = substr($uri, strlen('api/v1/'));

        return match (true) {
            str_starts_with($path, 'account/') => [AccessSpace::Customer],
            str_starts_with($path, 'agency/') => [AccessSpace::Agency],
            str_starts_with($path, 'admin/') => [AccessSpace::Admin],
            // Session courante (profil, déconnexion, photo) : chaque espace, pour son propre compte.
            str_starts_with($path, 'auth/') => AccessSpace::cases(),
            default => $this->fail("Route privée hors espace connu : $uri"),
        };
    }
}
