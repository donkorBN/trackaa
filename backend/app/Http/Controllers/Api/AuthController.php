<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\DefaultSetup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request, DefaultSetup $setup): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::min(8)],
            'timezone' => ['nullable', 'timezone:all'],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => strtolower($data['email']),
            'password' => $data['password'],
            'timezone' => $data['timezone'] ?? 'Africa/Accra',
        ]);
        $setup->provision($user);

        return response()->json([
            'token' => $user->createToken('app')->plainTextToken,
            'user' => $user->toApi(),
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', strtolower($data['email']))->first();
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => 'Those details don\'t match an account.']);
        }

        return response()->json([
            'token' => $user->createToken('app')->plainTextToken,
            'user' => $user->toApi(),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(null, 204);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($request->user()->toApi());
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:100'],
            'timezone' => ['sometimes', 'timezone:all'],
            'reminder_enabled' => ['sometimes', 'boolean'],
            'reminder_time' => ['sometimes', 'date_format:H:i'],
        ]);

        $user = $request->user();
        $user->fill($data);
        if ($user->isDirty(['reminder_time', 'timezone'])) {
            $user->last_reminded_on = null; // allow a reminder at the new time today
        }
        $user->save();

        return response()->json($user->toApi());
    }
}
