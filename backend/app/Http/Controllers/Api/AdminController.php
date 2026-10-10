<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccessCode;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AdminController extends Controller
{
    public function stats(): JsonResponse
    {
        $codes = AccessCode::query();

        return response()->json([
            'users' => User::count(),
            'users_last_7_days' => User::where('created_at', '>=', now()->subDays(7))->count(),
            'codes_available' => (clone $codes)->whereNull('redeemed_at')->whereNull('revoked_at')->count(),
            'codes_redeemed' => (clone $codes)->whereNotNull('redeemed_at')->count(),
            'codes_revoked' => (clone $codes)->whereNotNull('revoked_at')->whereNull('redeemed_at')->count(),
            'active_last_7_days' => DB::table('activity_days')->where('day', '>=', now()->subDays(7)->toDateString())->distinct()->count('user_id'),
        ]);
    }

    public function codes(Request $request): JsonResponse
    {
        $data = $request->validate([
            'status' => ['nullable', Rule::in(['available', 'redeemed', 'revoked'])],
            'q' => ['nullable', 'string', 'max:100'],
        ]);
        $query = AccessCode::with('redeemer:id,name,email')->latest('id');
        match ($data['status'] ?? null) {
            'available' => $query->whereNull('redeemed_at')->whereNull('revoked_at'),
            'redeemed' => $query->whereNotNull('redeemed_at'),
            'revoked' => $query->whereNotNull('revoked_at')->whereNull('redeemed_at'),
            default => null,
        };
        if (filled($data['q'] ?? null)) {
            $q = '%'.strtolower($data['q']).'%';
            $query->where(fn ($w) => $w
                ->whereRaw('lower(code) like ?', [$q])
                ->orWhereRaw('lower(note) like ?', [$q])
                ->orWhereHas('redeemer', fn ($u) => $u->whereRaw('lower(email) like ?', [$q])));
        }

        return response()->json(['data' => $query->limit(500)->get()->map(fn (AccessCode $c) => $this->present($c))]);
    }

    public function createCodes(Request $request): JsonResponse
    {
        $data = $request->validate([
            'count' => ['required', 'integer', 'min:1', 'max:200'],
            'note' => ['nullable', 'string', 'max:160'],
        ]);
        $codes = DB::transaction(fn () => collect(range(1, $data['count']))->map(fn () => AccessCode::create([
            'code' => AccessCode::generate(),
            'note' => $data['note'] ?? null,
            'created_by' => $request->user()->id,
        ])));

        return response()->json(['data' => $codes->map(fn (AccessCode $c) => $this->present($c))], 201);
    }

    public function updateCode(Request $request, AccessCode $code): JsonResponse
    {
        $data = $request->validate([
            'note' => ['sometimes', 'nullable', 'string', 'max:160'],
            'revoked' => ['sometimes', 'boolean'],
        ]);
        if (array_key_exists('note', $data)) {
            $code->note = $data['note'];
        }
        if (array_key_exists('revoked', $data)) {
            abort_if($code->redeemed_at !== null, 422, 'This code has already been used, so it can\'t be revoked.');
            $code->revoked_at = $data['revoked'] ? ($code->revoked_at ?? now()) : null;
        }
        $code->save();

        return response()->json($this->present($code->load('redeemer:id,name,email')));
    }

    private function present(AccessCode $c): array
    {
        return [
            'id' => $c->id,
            'code' => $c->code,
            'note' => $c->note,
            'status' => $c->status(),
            'created_at' => $c->created_at?->toIso8601String(),
            'redeemed_at' => $c->redeemed_at?->toIso8601String(),
            'redeemed_by' => $c->redeemer ? ['name' => $c->redeemer->name, 'email' => $c->redeemer->email] : null,
        ];
    }
}
