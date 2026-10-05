<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Appareil (navigateur) inscrit aux notifications push Firebase Cloud Messaging.
 *
 * Le jeton n'est jamais renvoyé par l'API. Il est supprimé avec le jeton de connexion
 * Sanctum qui l'a enregistré (déconnexion, suspension, expiration), ou dès que Firebase
 * le déclare invalide.
 */
class DeviceToken extends Model
{
    /** @var list<string> */
    protected $hidden = ['token', 'token_hash'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'last_registered_at' => 'datetime',
        ];
    }

    public static function hashOf(string $token): string
    {
        return hash('sha256', $token);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
