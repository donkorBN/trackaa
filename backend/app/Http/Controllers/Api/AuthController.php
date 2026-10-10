<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Middleware\ExtendTokenLifetime;
use App\Models\User;
use App\Services\BusinessCategories;
use App\Services\DefaultSetup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /** Public facts the sign-in screens need: is email set up, is an invite code required. */
    public function meta(): JsonResponse
    {
        return response()->json([
            'mail_enabled' => ! in_array(config('mail.default'), ['log', 'array'], true),
            'invite_required' => filled(config('trackaa.invite_code')),
        ]);
    }

    public function register(Request $request, DefaultSetup $setup, BusinessCategories $businessCategories): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', PasswordRule::min(8)],
            'timezone' => ['nullable', 'timezone:all'],
            'invite_code' => ['nullable', 'string', 'max:100'],
        ]);

        $code = (string) config('trackaa.invite_code');
        if ($code !== '' && ! hash_equals($code, trim((string) ($data['invite_code'] ?? '')))) {
            throw ValidationException::withMessages(['invite_code' => 'That invite code isn\'t right. Ask the person who invited you.']);
        }

        $user = User::create([
            'name' => $data['name'],
            'email' => strtolower($data['email']),
            'password' => $data['password'],
            'timezone' => $data['timezone'] ?? 'Africa/Accra',
        ]);
        $setup->provision($user);
        $businessCategories->sync($user); // no businesses yet: business categories start hidden

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

    /** Permanently deletes the account and everything in it. Needs the current password. */
    public function destroy(Request $request): JsonResponse
    {
        $request->validate(['password' => ['required', 'string']]);
        $user = $request->user();
        if (! Hash::check($request->input('password'), $user->password)) {
            throw ValidationException::withMessages(['password' => 'That password isn\'t right.']);
        }

        DB::transaction(function () use ($user) {
            // Children first: transactions restrict deletes of the accounts and categories they use.
            $user->statements()->delete();
            $user->goals()->delete();
            $user->budgets()->delete();
            $user->transactions()->delete();
            $user->activityDays()->delete();
            $user->categories()->delete();
            $user->businesses()->delete();
            $user->accounts()->delete();
            $user->tokens()->delete();
            DB::table('password_reset_tokens')->where('email', $user->email)->delete();
            $user->delete();
        });

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
