<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Notifications applicatives du client (table notifications Laravel, §15.14).
 */
class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate(['unread' => ['sometimes', 'boolean']]);

        $user = $request->user();
        $notifications = ($request->boolean('unread') ? $user->unreadNotifications() : $user->notifications())
            ->paginate($this->perPage($request, 20, 50))
            ->withQueryString()
            ->through(fn ($notification) => [
                'id' => $notification->id,
                'type' => $notification->data['type'] ?? null,
                'data' => $notification->data,
                'read_at' => $notification->read_at,
                'created_at' => $notification->created_at,
            ]);

        return response()->json($notifications->toArray() + [
            'unread_count' => $user->unreadNotifications()->count(),
        ]);
    }

    public function markAsRead(Request $request, string $notification): Response
    {
        $request->user()->notifications()->whereKey($notification)->firstOrFail()->markAsRead();

        return response()->noContent();
    }

    public function markAllAsRead(Request $request): Response
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->noContent();
    }
}
