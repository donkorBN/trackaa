<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BusinessCategories;
use App\Models\Business;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BusinessController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = $request->user()->businesses()->orderBy('id');
        if (! $request->boolean('include_archived')) {
            $q->active();
        }

        return response()->json(['data' => $q->get()->map(fn ($b) => $this->present($b))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:80']]);

        $business = $request->user()->businesses()->create($data);
        app(BusinessCategories::class)->sync($request->user());

        return response()->json($this->present($business), 201);
    }

    public function update(Request $request, Business $business): JsonResponse
    {
        $this->authorizeOwner($request, $business);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:80'],
            'archived' => ['sometimes', 'boolean'],
        ]);
        $business->fill($data);
        if (array_key_exists('archived', $data)) {
            $business->setArchived((bool) $data['archived']);
        }
        $business->save();
        app(BusinessCategories::class)->sync($request->user());

        return response()->json($this->present($business));
    }

    /** Only unused items can be deleted; anything with history is archived instead, so totals never change. */
    public function destroy(Request $request, Business $business): JsonResponse
    {
        $this->authorizeOwner($request, $business);
        abort_if(
            $request->user()->transactions()->where('business_id', $business->id)->exists(),
            422,
            'This is used by existing transactions. Archive it instead.',
        );
        $business->delete();
        app(BusinessCategories::class)->sync($request->user());

        return response()->json(null, 204);
    }

    private function present(Business $b): array
    {
        return ['id' => $b->id, 'name' => $b->name, 'archived' => $b->isArchived()];
    }
}
