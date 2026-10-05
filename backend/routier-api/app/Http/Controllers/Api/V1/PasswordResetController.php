<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\AccessSpace;
use App\Enums\RoleName;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

/**
 * Réinitialisation sécurisée du mot de passe (mécanisme Laravel « password broker »).
 *
 * - Un lien à usage unique, valable 60 minutes, est envoyé par e-mail à l'adresse du compte.
 * - Personne, pas même le super_admin, ne voit ni ne choisit le mot de passe : seul le
 *   titulaire de l'adresse e-mail en définit un nouveau.
 * - Après le changement, toutes les sessions du compte sont fermées (jetons révoqués).
 * - La demande publique ne révèle jamais si un compte existe pour une adresse.
 */
class PasswordResetController extends Controller
{
    /**
     * « Mot de passe oublié ? » depuis une page de connexion (public).
     */
    public function forgot(Request $request): JsonResponse
    {
        $email = $request->validate(['email' => ['required', 'string', 'email', 'max:255']])['email'];

        $status = Password::sendResetLink(['email' => $email]);

        if ($status === Password::RESET_LINK_SENT) {
            AuditLog::record('user.password_reset_requested', User::query()->where('email', $email)->first());
        }

        // Réponse identique que le compte existe ou non (pas d'énumération des comptes).
        return response()->json(['message' => __('passwords.sent')]);
    }

    /**
     * Nouveau mot de passe choisi depuis le lien reçu par e-mail (public).
     */
    public function reset(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'token' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'confirmed', PasswordRule::defaults()],
        ]);

        $resetUser = null;

        $status = Password::reset($credentials, function (User $user, string $password) use (&$resetUser) {
            $user->forceFill(['password' => $password])->save();
            // Toutes les sessions ouvertes (et leurs appareils push) sont fermées.
            $user->tokens()->delete();
            $resetUser = $user;

            event(new PasswordReset($user));
        });

        if ($status !== Password::PASSWORD_RESET || $resetUser === null) {
            throw ValidationException::withMessages(['email' => __($status)]);
        }

        AuditLog::record('user.password_reset', $resetUser, actor: $resetUser);

        return response()->json([
            'message' => __('passwords.reset'),
            // Page de connexion vers laquelle diriger l'utilisateur.
            'space' => self::spaceOf($resetUser),
        ]);
    }

    /**
     * Envoi d'un lien de réinitialisation par le super_admin (espace administrateur).
     */
    public function sendForUser(User $user): JsonResponse
    {
        Gate::authorize('update', $user);

        $status = Password::sendResetLink(['email' => $user->email]);

        if ($status === Password::RESET_THROTTLED) {
            return response()->json(['message' => __('passwords.throttled')], Response::HTTP_TOO_MANY_REQUESTS);
        }

        abort_unless($status === Password::RESET_LINK_SENT, Response::HTTP_UNPROCESSABLE_ENTITY, __($status));

        AuditLog::record('user.password_reset_link_sent', $user);

        return response()->json(['message' => "Un lien de réinitialisation a été envoyé à {$user->email}."]);
    }

    private static function spaceOf(User $user): AccessSpace
    {
        return match ($user->primaryRole()) {
            RoleName::Customer => AccessSpace::Customer,
            RoleName::SuperAdmin => AccessSpace::Admin,
            default => AccessSpace::Agency,
        };
    }
}
