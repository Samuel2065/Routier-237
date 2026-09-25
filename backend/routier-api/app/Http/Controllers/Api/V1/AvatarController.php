<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\UpdateAvatarRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Photo de profil du compte connecté, quel que soit l'espace. Chacun ne modifie que la sienne.
 */
class AvatarController extends Controller
{
    private const DISK = 'public';

    public function update(UpdateAvatarRequest $request): UserResource
    {
        /** @var User $user */
        $user = $request->user();
        $file = $request->file('avatar');

        // Nom aléatoire et extension déduite du contenu réel, jamais du nom envoyé.
        $path = $file->storeAs('avatars', $user->id.'-'.Str::random(20).'.'.$file->extension(), self::DISK);

        $previous = $user->avatar_path;
        $user->forceFill(['avatar_path' => $path])->save();
        $this->deleteFile($previous);

        return $this->profile($user);
    }

    public function destroy(Request $request): UserResource
    {
        /** @var User $user */
        $user = $request->user();

        $previous = $user->avatar_path;
        $user->forceFill(['avatar_path' => null])->save();
        $this->deleteFile($previous);

        return $this->profile($user);
    }

    private function deleteFile(?string $path): void
    {
        if ($path !== null) {
            Storage::disk(self::DISK)->delete($path);
        }
    }

    private function profile(User $user): UserResource
    {
        return new UserResource($user->loadMissing(['roles.permissions', 'permissions', 'organization', 'employeeProfile.agency.organization']));
    }
}
