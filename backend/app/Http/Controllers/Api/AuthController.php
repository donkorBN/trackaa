<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Middleware\ExtendTokenLifetime;
use App\Models\User;
use App\Services\DefaultSetup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request, DefaultSetup $setup): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', PasswordRule::min(8)],
            'timezone' => ['nullable', 'timezone:all'],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => strtolower($data['email']),
            'password' => $data['password'],
            'timezone' => $data['timezone'] ?? 'Africa/Accra',
        ]);
        $setup->provision($user);

        return response()->json(['token' => $this->issueToken($user), 'user' => $user->toApi()], 201);
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

        return response()->json(['token' => $this->issueToken($user), 'user' => $user->toApi()]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(null, 204);
    }

    /** Always answers the same way so it can't be used to discover which emails have accounts. */
    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email']]);
        Password::sendResetLink(['email' => strtolower($data['email'])]);

        return response()->json(['message' => 'If that email has an account, a reset link is on its way.']);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', PasswordRule::min(8)],
        ]);

        $user = null;
        $status = Password::reset(
            ['email' => strtolower($data['email'])] + $data,
            function (User $u, string $password) use (&$user) {
                $u->forceFill(['password' => $password])->save();
                $u->tokens()->delete(); // sign out every device
                $user = $u;
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => 'This reset link is invalid or has expired. Request a new one.']);
        }

        return response()->json(['token' => $this->issueToken($user), 'user' => $user->toApi()]);
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
        ]);

        $user = $request->user();
        $user->fill($data)->save();

        return response()->json($user->toApi());
    }

    public function changePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'string', 'current_password:sanctum'],
            'password' => ['required', 'confirmed', PasswordRule::min(8)],
        ], ['current_password.current_password' => 'Your current password is incorrect.']);

        $user = $request->user();
        $user->forceFill(['password' => $data['password']])->save();
        // Sign out every other device.
        $user->tokens()->where('id', '!=', $user->currentAccessToken()->id)->delete();

        return response()->json(null, 204);
    }

    /**
     * Check in for a day ("nothing else to add" / "no spending today"). Keeps the
     * streak alive on days with nothing to record. Only today or yesterday.
     */
    public function review(Request $request): JsonResponse
    {
        $user = $request->user();
        $today = now($user->timezone)->toDateString();
        $yesterday = now($user->timezone)->subDay()->toDateString();
        $data = $request->validate(['date' => ['required', 'date_format:Y-m-d', 'in:'.$today.','.$yesterday]], [
            'date.in' => 'You can only check in for today or yesterday.',
        ]);
        $user->forceFill(['last_reviewed_on' => $data['date']])->save();
        $user->activityDays()->firstOrCreate(['day' => $data['date']], ['kind' => 'checkin']);

        return response()->json($user->toApi());
    }

    private function issueToken(User $user): string
    {
        return $user->createToken('app', ['*'], now()->addDays(ExtendTokenLifetime::DAYS))->plainTextToken;
    }
}
