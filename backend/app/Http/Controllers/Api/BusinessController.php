<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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

        return response()->json($this->present($request->user()->businesses()->create($data)), 201);
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

        return response()->json($this->present($business));
    }

    private function present(Business $b): array
    {
        return ['id' => $b->id, 'name' => $b->name, 'archived' => $b->isArchived()];
    }
}
