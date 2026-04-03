import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export default async function Page() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, dish_id, ingredient_id, quantity')
    .limit(100);

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center p-6">
        <div className="w-full rounded-xl border border-red-500/30 bg-red-500/5 p-5">
          <h1 className="text-lg font-semibold text-red-700 dark:text-red-300">Could not load recipes</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
          <p className="mt-2 text-xs text-muted-foreground">Code: {error.code ?? 'N/A'}</p>
          <p className="text-xs text-muted-foreground">Details: {error.details ?? 'N/A'}</p>
          <p className="text-xs text-muted-foreground">Hint: {error.hint ?? 'N/A'}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-foreground">Recipes</h1>
      <p className="mb-4 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
        Auth user: {user?.id ?? 'Not signed in (anon role)'}
      </p>
      {!recipes || recipes.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          No recipes found in the `public.recipes` table.
        </p>
      ) : (
        <ul className="space-y-2">
          {recipes.map((recipe) => (
            <li key={recipe.id} className="rounded-lg border border-border bg-card px-4 py-3 text-foreground">
              <div className="text-sm"><span className="font-semibold">Recipe ID:</span> {recipe.id}</div>
              <div className="text-sm text-muted-foreground">Dish: {recipe.dish_id ?? 'N/A'}</div>
              <div className="text-sm text-muted-foreground">Ingredient: {recipe.ingredient_id ?? 'N/A'}</div>
              <div className="text-sm text-muted-foreground">Quantity: {recipe.quantity}</div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
