<?php

namespace App\Notifications;

use App\Enums\PermissionName;
use App\Enums\RecordStatus;
use App\Enums\RoleName;
use App\Enums\UserStatus;
use App\Models\Reservation;
use App\Models\User;
use App\Notifications\Channels\PushChannel;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Notification as Notifier;

/**
 * Alerte du personnel d'une agence sur une réservation (centre de notifications de l'espace agence).
 *
 * Destinataires : personnel actif de l'agence du trajet et director de son organisation,
 * uniquement s'ils détiennent la permission du type d'alerte (le conducteur, par exemple,
 * ne reçoit rien). Canal base de données : pas d'e-mail au personnel.
 */
class StaffReservationAlert extends Notification
{
    /** Réservation payée et confirmée. */
    public const CONFIRMED = 'agency_reservation_confirmed';

    /** Réservation annulée par le client. */
    public const CANCELLED_BY_CUSTOMER = 'agency_reservation_cancelled';

    /** Paiement reçu pour une réservation qui n'est plus valide (expirée ou annulée). */
    public const REFUND_REQUIRED = 'agency_refund_required';

    private const PERMISSIONS = [
        self::CONFIRMED => PermissionName::ReservationsView,
        self::CANCELLED_BY_CUSTOMER => PermissionName::ReservationsView,
        self::REFUND_REQUIRED => PermissionName::PaymentsRefund,
    ];

    public function __construct(
        public readonly Reservation $reservation,
        public readonly string $kind,
        public readonly bool $paid = false,
    ) {}

    /**
     * Envoie l'alerte aux membres du personnel concernés. Une alerte ne fait jamais échouer
     * l'opération qui l'a déclenchée (paiement, annulation) : l'erreur est seulement journalisée.
     */
    public static function dispatch(Reservation $reservation, string $kind, bool $paid = false): void
    {
        rescue(function () use ($reservation, $kind, $paid) {
            $recipients = self::recipients($reservation, self::PERMISSIONS[$kind]);

            if ($recipients->isNotEmpty()) {
                Notifier::send($recipients, new self($reservation, $kind, $paid));
            }
        });
    }

    /**
     * @return Collection<int, User>
     */
    public static function recipients(Reservation $reservation, PermissionName $permission): Collection
    {
        $agency = $reservation->trip()->with('agency')->first()?->agency;

        if ($agency === null) {
            return collect();
        }

        return User::query()
            ->where('status', UserStatus::Active)
            ->where(fn ($query) => $query
                ->whereHas('employeeProfile', fn ($profile) => $profile->where('agency_id', $agency->id))
                ->orWhere(fn ($director) => $director
                    ->where('organization_id', $agency->organization_id)
                    ->whereHas('roles', fn ($role) => $role->where('name', RoleName::Director->value))))
            ->with(['roles.permissions', 'permissions', 'organization', 'employeeProfile.agency.organization'])
            ->get()
            ->filter(fn (User $user) => $agency->status === RecordStatus::Active
                && $user->hasActiveAccess()
                && $user->canAccessAgency($agency)
                && $user->checkPermissionTo($permission->value))
            ->values();
    }

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['database', PushChannel::class];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => $this->kind,
            'reservation_id' => $this->reservation->id,
            'trip_id' => $this->reservation->trip_id,
            'reference' => $this->reservation->reference,
            'message' => $this->message(),
        ];
    }

    /**
     * @return array{title: string, body: string, link: string}
     */
    public function toPush(object $notifiable): array
    {
        $reference = rawurlencode($this->reservation->reference);

        return match ($this->kind) {
            self::CONFIRMED => ['title' => 'Nouvelle réservation', 'body' => $this->message(), 'link' => "/agency/reservations?search={$reference}"],
            self::CANCELLED_BY_CUSTOMER => ['title' => 'Réservation annulée par le client', 'body' => $this->message(), 'link' => "/agency/reservations?search={$reference}"],
            self::REFUND_REQUIRED => ['title' => 'Remboursement à effectuer', 'body' => $this->message(), 'link' => '/agency/payments?requires_refund=1'],
        };
    }

    private function message(): string
    {
        $reference = $this->reservation->reference;
        $summary = TripSummary::for($this->reservation);

        return match ($this->kind) {
            self::CONFIRMED => "Nouvelle réservation confirmée {$reference} : {$this->reservation->passenger_count} passager(s), "
                .number_format($this->reservation->total_amount, 0, ',', ' ')." FCFA. {$summary}",
            self::CANCELLED_BY_CUSTOMER => "Le client a annulé la réservation {$reference}. {$summary}"
                .($this->paid ? ' Paiement à rembourser.' : ''),
            self::REFUND_REQUIRED => "Paiement reçu pour la réservation {$reference}, qui n'est plus valide : remboursement à effectuer. {$summary}",
        };
    }
}
