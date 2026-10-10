<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // usage_count (last 90 days) lets Quick Add put the categories you use most first.
        $q = $request->user()->categories()->orderBy('id')
            ->withCount(['transactions as usage_count' => fn ($t) => $t->where('occurred_at', '>=', now()->subDays(90))]);
        if (! $request->boolean('include_archived')) {
            $q->active();
        }

        return response()->json(['data' => $q->get()->map(fn ($c) => $this->present($c))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'transaction_type' => ['required', Rule::in(['income', 'expense'])],
        ]);

        return response()->json($this->present($request->user()->categories()->create($data)), 201);
    }

    /** The type is fixed after creation so existing transactions stay consistent. */
    public function update(Request $request, Category $category): JsonResponse
    {
        $this->authorizeOwner($request, $category);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:80'],
            'archived' => ['sometimes', 'boolean'],
        ]);
        $category->fill($data);
        if (array_key_exists('archived', $data)) {
            $category->setArchived((bool) $data['archived']);
            $category->auto_hidden = false; // the user decided; stop managing it automatically
        }
        $category->save();

        return response()->json($this->present($category));
    }

    /** Only unused items can be deleted; anything with history is archived instead, so totals never change. */
    public function destroy(Request $request, Category $category): JsonResponse
    {
        $this->authorizeOwner($request, $category);
        abort_if(
            $request->user()->transactions()->where('category_id', $category->id)->exists(),
            422,
            'This is used by existing transactions. Archive it instead.',
        );
        $category->delete();

        return response()->json(null, 204);
    }

    private function present(Category $c): array
    {
        return [
            'id' => $c->id,
            'name' => $c->name,
            'transaction_type' => $c->transaction_type,
            'archived' => $c->isArchived(),
            'usage_count' => (int) ($c->usage_count ?? 0),
        ];
    }
}
