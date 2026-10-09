<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PushController extends Controller
{
    public function key(): JsonResponse
    {
        return response()->json(['public_key' => config('services.webpush.public_key') ?: null]);
    }

    public function subscribe(Request $request): JsonResponse
    {
        $data = $request->validate([
            'endpoint' => ['required', 'url', 'max:500'],
            'keys.p256dh' => ['required', 'string', 'max:255'],
            'keys.auth' => ['required', 'string', 'max:255'],
        ]);

        // An endpoint is tied to one browser; re-subscribing moves it to the current user.
        PushSubscription::where('endpoint', $data['endpoint'])->delete();
        $request->user()->pushSubscriptions()->create([
            'endpoint' => $data['endpoint'],
            'public_key' => $data['keys']['p256dh'],
            'auth_token' => $data['keys']['auth'],
        ]);

        return response()->json(null, 204);
    }

    public function unsubscribe(Request $request): JsonResponse
    {
        $request->validate(['endpoint' => ['required', 'string']]);
        $request->user()->pushSubscriptions()->where('endpoint', $request->input('endpoint'))->delete();

        return response()->json(null, 204);
    }
}
