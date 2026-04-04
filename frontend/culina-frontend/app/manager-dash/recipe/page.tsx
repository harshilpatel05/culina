"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BookOpen,
  Boxes,
  Building2,
  ChevronRight,
  LayoutDashboard,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MacOSSidebar } from "@/components/ui/macos-sidebar-base";

type Dish = {
  id: string;
  restaurant_id?: string | null;
  menu_id?: string | null;
  name: string | null;
  category?: string | null;
  price?: number | null;
  cost?: number | null;
  is_active?: boolean | null;
  menus?: {
    name?: string | null;
  } | null;
  restaurants?: {
    name?: string | null;
  } | null;
};

type Menu = {
  id: string;
  restaurant_id?: string | null;
  name: string | null;
};

type Ingredient = {
  id: string;
  name: string | null;
  unit?: string | null;
};

type RecipeRecord = {
  id: string;
  dish_id: string | null;
  ingredient_id: string | null;
  quantity: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  dishes?: {
    name?: string | null;
    category?: string | null;
  } | null;
  ingredients?: {
    name?: string | null;
    unit?: string | null;
  } | null;
};

type RecipeFormState = {
  dishId: string;
};

type RecipeIngredientLine = {
  id: string;
  ingredientId: string;
  quantity: string;
};

type DishFormState = {
  name: string;
  category: string;
  price: string;
  cost: string;
  menuId: string;
  isActive: "active" | "inactive";
};

type RecipeDishGroup = {
  dishKey: string;
  dishId: string | null;
  dishName: string;
  dishCategory: string;
  recipes: RecipeRecord[];
};

const EMPTY_FORM: RecipeFormState = {
  dishId: "",
};

const EMPTY_INGREDIENT_LINE: RecipeIngredientLine = {
  id: "line-1",
  ingredientId: "",
  quantity: "",
};

const EMPTY_DISH_FORM: DishFormState = {
  name: "",
  category: "",
  price: "",
  cost: "",
  menuId: "",
  isActive: "active",
};

const PANEL_SHELL = "rounded-2xl border border-slate-300/90 bg-card/70 p-4 shadow-sm backdrop-blur-sm dark:border-slate-600/70";
const SUBTLE_PANEL = "rounded-2xl border border-slate-300/80 bg-card/60 shadow-sm backdrop-blur-sm dark:border-slate-600/60";
const FIELD_INPUT = "w-full rounded-xl border border-border/70 bg-background px-3 py-2.5 text-sm outline-none ring-primary transition focus:border-primary/60 focus:ring-2";

function formatQuantity(value: number | null, unit?: string | null) {
  if (value == null || Number.isNaN(Number(value))) {
    return "-";
  }

  const normalized = Number(value);
  return `${normalized.toFixed(2)}${unit ? ` ${unit}` : ""}`;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ManagerRecipePage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<RecipeRecord[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDishSubmitting, setIsDishSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [modalType, setModalType] = useState<"recipe" | "dish" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [form, setForm] = useState<RecipeFormState>(EMPTY_FORM);
  const [ingredientLines, setIngredientLines] = useState<RecipeIngredientLine[]>([EMPTY_INGREDIENT_LINE]);
  const [dishForm, setDishForm] = useState<DishFormState>(EMPTY_DISH_FORM);
  const [expandedDishGroups, setExpandedDishGroups] = useState<Record<string, boolean>>({});

  const dishMap = useMemo(() => {
    return dishes.reduce<Record<string, Dish>>((accumulator, dish) => {
      accumulator[dish.id] = dish;
      return accumulator;
    }, {});
  }, [dishes]);

  const ingredientMap = useMemo(() => {
    return ingredients.reduce<Record<string, Ingredient>>((accumulator, ingredient) => {
      accumulator[ingredient.id] = ingredient;
      return accumulator;
    }, {});
  }, [ingredients]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [recipesRes, dishesRes, ingredientsRes, menusRes] = await Promise.all([
        fetch("/api/recipes"),
        fetch("/api/dishes"),
        fetch("/api/ingredients"),
        fetch("/api/menus"),
      ]);

      if (!recipesRes.ok || !dishesRes.ok || !ingredientsRes.ok || !menusRes.ok) {
        throw new Error(`Could not load recipe data (${recipesRes.status}/${dishesRes.status}/${ingredientsRes.status}/${menusRes.status})`);
      }

      const recipesData = await recipesRes.json();
      const dishesData = await dishesRes.json();
      const ingredientsData = await ingredientsRes.json();
      const menusData = await menusRes.json();

      const normalizedRecipes = Array.isArray(recipesData)
        ? recipesData
        : Array.isArray(recipesData?.data)
          ? recipesData.data
          : [];

      setRecipes(normalizedRecipes as RecipeRecord[]);
      setDishes(Array.isArray(dishesData) ? dishesData : []);
      setIngredients(Array.isArray(ingredientsData) ? ingredientsData : []);
      setMenus(Array.isArray(menusData) ? menusData : []);
    } catch (loadErr) {
      const message = loadErr instanceof Error ? loadErr.message : "Failed to load recipe data.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRecipes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return recipes;
    }

    return recipes.filter((recipe) => {
      const dish = recipe.dish_id ? dishMap[recipe.dish_id] : undefined;
      const ingredient = recipe.ingredient_id ? ingredientMap[recipe.ingredient_id] : undefined;

      const dishName = (recipe.dishes?.name ?? dish?.name ?? "").toLowerCase();
      const dishCategory = (recipe.dishes?.category ?? dish?.category ?? "").toLowerCase();
      const ingredientName = (recipe.ingredients?.name ?? ingredient?.name ?? "").toLowerCase();
      const ingredientUnit = (recipe.ingredients?.unit ?? ingredient?.unit ?? "").toLowerCase();
      const quantity = String(recipe.quantity ?? "").toLowerCase();

      return (
        dishName.includes(normalizedQuery) ||
        dishCategory.includes(normalizedQuery) ||
        ingredientName.includes(normalizedQuery) ||
        ingredientUnit.includes(normalizedQuery) ||
        quantity.includes(normalizedQuery)
      );
    });
  }, [dishMap, ingredientMap, query, recipes]);

  const metrics = useMemo(() => {
    const totalRecipes = recipes.length;
    const uniqueDishCount = new Set(recipes.map((recipe) => recipe.dish_id).filter(Boolean)).size;
    const uniqueIngredientCount = new Set(recipes.map((recipe) => recipe.ingredient_id).filter(Boolean)).size;

    return {
      totalRecipes,
      uniqueDishCount,
      uniqueIngredientCount,
    };
  }, [recipes]);

  const groupedRecipes = useMemo<RecipeDishGroup[]>(() => {
    const groups = new Map<string, RecipeDishGroup>();

    filteredRecipes.forEach((recipe) => {
      const dish = recipe.dish_id ? dishMap[recipe.dish_id] : undefined;
      const dishName = recipe.dishes?.name ?? dish?.name ?? "Unknown dish";
      const dishCategory = recipe.dishes?.category ?? dish?.category ?? "Uncategorized";
      const dishKey = recipe.dish_id ?? `unknown-${dishName.toLowerCase()}`;

      const existingGroup = groups.get(dishKey);
      if (existingGroup) {
        existingGroup.recipes.push(recipe);
      } else {
        groups.set(dishKey, {
          dishKey,
          dishId: recipe.dish_id ?? null,
          dishName,
          dishCategory,
          recipes: [recipe],
        });
      }
    });

    return Array.from(groups.values()).sort((left, right) =>
      left.dishName.localeCompare(right.dishName)
    );
  }, [dishMap, filteredRecipes]);

  useEffect(() => {
    setExpandedDishGroups((previous) => {
      const next = { ...previous };
      groupedRecipes.forEach((group) => {
        if (next[group.dishKey] === undefined) {
          next[group.dishKey] = true;
        }
      });
      return next;
    });
  }, [groupedRecipes]);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIngredientLines([EMPTY_INGREDIENT_LINE]);
    setModalType(null);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIngredientLines([EMPTY_INGREDIENT_LINE]);
    setModalType("recipe");
  };

  const openEdit = (recipe: RecipeRecord) => {
    setEditingId(recipe.id);
    setForm({
      dishId: recipe.dish_id ?? "",
    });
    setIngredientLines([
      {
        id: `line-${recipe.id}`,
        ingredientId: recipe.ingredient_id ?? "",
        quantity: recipe.quantity != null ? String(recipe.quantity) : "",
      },
    ]);
    setModalType("recipe");
  };

  const addIngredientLine = () => {
    setIngredientLines((previous) => [
      ...previous,
      {
        id: `line-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        ingredientId: "",
        quantity: "",
      },
    ]);
  };

  const removeIngredientLine = (lineId: string) => {
    setIngredientLines((previous) => {
      if (previous.length <= 1) {
        return previous;
      }
      return previous.filter((line) => line.id !== lineId);
    });
  };

  const updateIngredientLine = (
    lineId: string,
    patch: Partial<Pick<RecipeIngredientLine, "ingredientId" | "quantity">>
  ) => {
    setIngredientLines((previous) =>
      previous.map((line) => (line.id === lineId ? { ...line, ...patch } : line))
    );
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.dishId) {
      setError("Dish is required.");
      return;
    }

    if (ingredientLines.length === 0) {
      setError("At least one ingredient is required.");
      return;
    }

    const normalizedLines = ingredientLines.map((line) => ({
      ...line,
      parsedQuantity: Number(line.quantity),
    }));

    const hasMissingValues = normalizedLines.some((line) => !line.ingredientId);
    if (hasMissingValues) {
      setError("Each ingredient row must have an ingredient selected.");
      return;
    }

    const hasInvalidQuantity = normalizedLines.some(
      (line) => Number.isNaN(line.parsedQuantity) || line.parsedQuantity <= 0
    );
    if (hasInvalidQuantity) {
      setError("Each quantity must be a valid number greater than 0.");
      return;
    }

    const duplicateIngredientIds = new Set<string>();
    for (const line of normalizedLines) {
      if (duplicateIngredientIds.has(line.ingredientId)) {
        setError("The same ingredient cannot be added twice for one dish in a single save.");
        return;
      }
      duplicateIngredientIds.add(line.ingredientId);
    }

    const isEditing = Boolean(editingId);

    if (!isEditing) {
      const duplicateExists = normalizedLines.some((line) =>
        recipes.some(
          (recipe) => recipe.dish_id === form.dishId && recipe.ingredient_id === line.ingredientId
        )
      );

      if (duplicateExists) {
        setError("One or more ingredients already exist for this dish recipe.");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (isEditing) {
        const editLine = normalizedLines[0];
        const payload = {
          dish_id: form.dishId,
          ingredient_id: editLine.ingredientId,
          quantity: editLine.parsedQuantity,
        };

        const response = await fetch(`/api/recipes/${editingId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const responseBody = await response.json().catch(() => null);
          throw new Error(responseBody?.error ?? "Could not save recipe record.");
        }
      } else {
        const responses = await Promise.all(
          normalizedLines.map((line) =>
            fetch("/api/recipes", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                dish_id: form.dishId,
                ingredient_id: line.ingredientId,
                quantity: line.parsedQuantity,
              }),
            })
          )
        );

        const firstFailedResponse = responses.find((response) => !response.ok);
        if (firstFailedResponse) {
          const responseBody = await firstFailedResponse.json().catch(() => null);
          throw new Error(responseBody?.error ?? "Could not save recipe records.");
        }
      }

      await loadData();
      resetForm();
    } catch (submitErr) {
      const message = submitErr instanceof Error ? submitErr.message : "Failed to save recipe record.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteRecipe = async (id: string) => {
    const shouldDelete = window.confirm("Delete this recipe? This action cannot be undone.");
    if (!shouldDelete) {
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const responseBody = await response.json().catch(() => null);
        throw new Error(responseBody?.error ?? "Could not delete recipe.");
      }
      await loadData();
    } catch (deleteErr) {
      const message = deleteErr instanceof Error ? deleteErr.message : "Failed to delete recipe.";
      setError(message);
    }
  };

  const handleSidebarNav = (label: string) => {
    switch (label) {
      case "Dashboard":
        router.push("/manager-dash");
        break;
      case "Staff":
        router.push("/manager-dash/staff");
        break;
      case "Inventory":
        router.push("/manager-dash/inventory");
        break;
      case "Recipe":
        router.push("/manager-dash/recipe");
        break;
      case "Restaurant":
        router.push("/manager-dash/restaurant");
        break;
      default:
        break;
    }
  };

  const toggleDishGroup = (dishKey: string) => {
    setExpandedDishGroups((previous) => ({
      ...previous,
      [dishKey]: !previous[dishKey],
    }));
  };

  const resetDishForm = () => {
    setEditingDishId(null);
    setDishForm(EMPTY_DISH_FORM);
    setModalType(null);
  };

  const openCreateDish = () => {
    setEditingDishId(null);
    setDishForm(EMPTY_DISH_FORM);
    setModalType("dish");
  };

  const openEditDish = (dish: Dish) => {
    setEditingDishId(dish.id);
    setDishForm({
      name: dish.name ?? "",
      category: dish.category ?? "",
      price: dish.price != null ? String(dish.price) : "",
      cost: dish.cost != null ? String(dish.cost) : "",
      menuId: dish.menu_id ?? "",
      isActive: dish.is_active === false ? "inactive" : "active",
    });
    setModalType("dish");
  };

  const submitDishForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!dishForm.name.trim()) {
      setError("Dish name is required.");
      return;
    }

    const parsedPrice = Number(dishForm.price);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setError("Price must be a valid positive number.");
      return;
    }

    const parsedCost = dishForm.cost.trim() ? Number(dishForm.cost) : null;
    if (parsedCost != null && (Number.isNaN(parsedCost) || parsedCost < 0)) {
      setError("Cost must be a valid positive number.");
      return;
    }

    try {
      setIsDishSubmitting(true);
      setError(null);

      const selectedMenu = menus.find((menu) => menu.id === dishForm.menuId);
      const fallbackRestaurantId =
        dishes.find((dish) => Boolean(dish.restaurant_id))?.restaurant_id ??
        menus.find((menu) => Boolean(menu.restaurant_id))?.restaurant_id ??
        null;
      const restaurantId = selectedMenu?.restaurant_id ?? fallbackRestaurantId;

      if (!restaurantId) {
        throw new Error("Restaurant context is missing. Create at least one menu first or load existing dishes.");
      }

      const payload = {
        restaurant_id: restaurantId,
        menu_id: dishForm.menuId || null,
        name: dishForm.name.trim(),
        category: dishForm.category.trim() || null,
        price: parsedPrice,
        cost: parsedCost,
        is_active: dishForm.isActive === "active",
      };

      const isEditingDish = Boolean(editingDishId);
      const endpoint = isEditingDish ? `/api/dishes/${editingDishId}` : "/api/dishes";
      const method = isEditingDish ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const responseBody = await response.json().catch(() => null);
        throw new Error(responseBody?.error ?? "Could not save dish.");
      }

      await loadData();
      resetDishForm();
    } catch (submitErr) {
      const message = submitErr instanceof Error ? submitErr.message : "Failed to save dish.";
      setError(message);
    } finally {
      setIsDishSubmitting(false);
    }
  };

  const deleteDish = async (dishId: string) => {
    const shouldDelete = window.confirm("Delete this dish? This action cannot be undone.");
    if (!shouldDelete) {
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/dishes/${dishId}`, { method: "DELETE" });
      if (!response.ok) {
        const responseBody = await response.json().catch(() => null);
        throw new Error(responseBody?.error ?? "Could not delete dish.");
      }
      await loadData();
    } catch (deleteErr) {
      const message = deleteErr instanceof Error ? deleteErr.message : "Failed to delete dish.";
      setError(message);
    }
  };

  const closeActiveModal = () => {
    if (modalType === "dish") {
      setEditingDishId(null);
      setDishForm(EMPTY_DISH_FORM);
    }

    if (modalType === "recipe") {
      setEditingId(null);
      setForm(EMPTY_FORM);
      setIngredientLines([EMPTY_INGREDIENT_LINE]);
    }

    setModalType(null);
  };

  return (
    <main className="min-h-screen w-full bg-background dark:bg-linear-to-br dark:from-background dark:via-background dark:to-card">
      <MacOSSidebar
        items={[
          { label: "Dashboard", icon: <LayoutDashboard className="size-4" /> },
          { label: "Staff", icon: <Users className="size-4" /> },
          { label: "Inventory", icon: <Boxes className="size-4" /> },
          { label: "Recipe", icon: <BookOpen className="size-4" /> },
          { label: "Restaurant", icon: <Building2 className="size-4" /> },
        ]}
        defaultOpen={false}
        initialSelectedIndex={3}
        onItemClick={handleSidebarNav}
        className="w-full max-w-384 p-1 sm:p-2 lg:p-4"
      >
        <div className="flex w-full flex-col gap-6 pl-3 sm:pl-4 lg:pl-5">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
            <header className="rounded-3xl border border-orange-400/75 bg-linear-to-br from-orange-100 via-orange-200 to-amber-300 p-6 shadow-[0_8px_22px_rgba(194,65,12,0.18)] backdrop-blur dark:border-orange-400/55 dark:from-orange-950 dark:via-orange-900/90 dark:to-amber-950/90">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Manager Console</p>
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground">Recipe Management</h1>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    Build and maintain dish recipes by mapping ingredients and quantities for consistent kitchen output.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Add Recipe
                </button>
              </div>
            </header>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <article className={SUBTLE_PANEL + " p-4"}>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Total Recipes</p>
                <div className="mt-3 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <p className="text-2xl font-semibold text-foreground">{metrics.totalRecipes}</p>
                </div>
              </article>
              <article className={SUBTLE_PANEL + " p-4"}>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Covered Dishes</p>
                <div className="mt-3 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <p className="text-2xl font-semibold text-foreground">{metrics.uniqueDishCount}</p>
                </div>
              </article>
              <article className={SUBTLE_PANEL + " p-4 sm:col-span-2 xl:col-span-1"}>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Ingredients Used</p>
                <div className="mt-3 flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-primary" />
                  <p className="text-2xl font-semibold text-foreground">{metrics.uniqueIngredientCount}</p>
                </div>
              </article>
            </section>

            <section className={PANEL_SHELL}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-foreground">Recipe Register</h2>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <div className="relative w-full sm:w-80">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search by dish, ingredient, category, unit, or quantity"
                      className="w-full rounded-xl border border-border/70 bg-background py-2 pl-9 pr-3 text-sm outline-none ring-primary transition focus:ring-2"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={openCreateDish}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted/50"
                  >
                    <Plus className="h-4 w-4" />
                    Add Dish
                  </button>
                </div>
              </div>

              {error ? (
                <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  {error}
                </p>
              ) : null}

              <div className="mt-4 space-y-3">
                {isLoading ? (
                  <div className="rounded-xl border border-border/70 px-3 py-8 text-center text-muted-foreground">
                    Loading recipe records...
                  </div>
                ) : groupedRecipes.length === 0 ? (
                  <div className="rounded-xl border border-border/70 px-3 py-8 text-center text-muted-foreground">
                    No recipes found. Add your first recipe.
                  </div>
                ) : (
                  groupedRecipes.map((group) => {
                    const isExpanded = expandedDishGroups[group.dishKey] ?? true;
                    const groupedDish = group.dishId ? dishMap[group.dishId] : undefined;

                    return (
                      <div key={group.dishKey} className="overflow-hidden rounded-xl border border-border/70 bg-background/45">
                        <div className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-muted/40">
                          <button
                            type="button"
                            onClick={() => toggleDishGroup(group.dishKey)}
                            className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                          >
                            <div>
                              <p className="font-semibold text-foreground">{group.dishName}</p>
                              <p className="text-xs text-muted-foreground">
                                {group.dishCategory}
                                {groupedDish?.menus?.name ? ` • ${groupedDish.menus.name}` : ""}
                                {groupedDish?.price != null ? ` • Price ${Number(groupedDish.price).toFixed(2)}` : ""}
                                {` • ${group.recipes.length} ingredient${group.recipes.length > 1 ? "s" : ""}`}
                              </p>
                            </div>
                            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                          </button>

                          {groupedDish?.id ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEditDish(groupedDish)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition hover:text-foreground"
                                aria-label="Edit dish"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteDish(groupedDish.id)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-400/40 text-red-500 transition hover:bg-red-500/10"
                                aria-label="Delete dish"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ) : null}
                        </div>

                        {isExpanded && (
                          <div className="border-t border-border/70">
                            <table className="w-full border-collapse text-left text-sm">
                              <thead>
                                <tr className="border-b border-border/70 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                                  <th className="px-3 py-2.5 font-medium">Ingredient</th>
                                  <th className="px-3 py-2.5 font-medium">Quantity</th>
                                  <th className="px-3 py-2.5 font-medium">Updated</th>
                                  <th className="px-3 py-2.5 text-right font-medium">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.recipes.map((recipe) => {
                                  const ingredient = recipe.ingredient_id ? ingredientMap[recipe.ingredient_id] : undefined;
                                  const ingredientName = recipe.ingredients?.name ?? ingredient?.name ?? "Unknown ingredient";
                                  const ingredientUnit = recipe.ingredients?.unit ?? ingredient?.unit;

                                  return (
                                    <tr key={recipe.id} className="border-b border-border/40 last:border-b-0 hover:bg-muted/40">
                                      <td className="px-3 py-3 text-muted-foreground">{ingredientName}</td>
                                      <td className="px-3 py-3 text-muted-foreground">
                                        {formatQuantity(recipe.quantity, ingredientUnit)}
                                      </td>
                                      <td className="px-3 py-3 text-muted-foreground">
                                        {formatDate(recipe.updated_at ?? recipe.created_at)}
                                      </td>
                                      <td className="px-3 py-3">
                                        <div className="flex justify-end gap-2">
                                          <button
                                            type="button"
                                            onClick={() => openEdit(recipe)}
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition hover:text-foreground"
                                            aria-label="Edit recipe"
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => deleteRecipe(recipe.id)}
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-400/40 text-red-500 transition hover:bg-red-500/10"
                                            aria-label="Delete recipe"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <AnimatePresence>
              {modalType ? (
                <motion.div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                  onClick={closeActiveModal}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <motion.section
                    className="w-full max-w-2xl rounded-2xl border border-slate-300/90 bg-card p-6 shadow-2xl sm:p-7 dark:border-slate-600/70"
                    onClick={(event) => event.stopPropagation()}
                    initial={{ opacity: 0, y: 18, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.98 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-foreground">
                        {modalType === "dish"
                          ? editingDishId
                            ? "Edit Dish"
                            : "Add Dish"
                          : editingId
                            ? "Edit Recipe"
                            : "Add Recipe"}
                      </h3>
                      <button
                        type="button"
                        onClick={closeActiveModal}
                        className="rounded-lg border border-border/70 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>

                    {modalType === "dish" ? (
                      <form onSubmit={submitDishForm} className="grid gap-5 md:grid-cols-2">
                        <label className="space-y-2.5 md:col-span-2">
                          <span className="text-sm font-medium text-foreground">Dish Name</span>
                          <input
                            value={dishForm.name}
                            onChange={(event) => setDishForm((previous) => ({ ...previous, name: event.target.value }))}
                            className={FIELD_INPUT}
                            placeholder="e.g. Paneer Butter Masala"
                            required
                          />
                        </label>

                        <label className="space-y-2.5">
                          <span className="text-sm font-medium text-foreground">Category</span>
                          <input
                            value={dishForm.category}
                            onChange={(event) => setDishForm((previous) => ({ ...previous, category: event.target.value }))}
                            className={FIELD_INPUT}
                            placeholder="e.g. Main Course"
                          />
                        </label>

                        <label className="space-y-2.5">
                          <span className="text-sm font-medium text-foreground">Menu</span>
                          <Select
                            value={dishForm.menuId || undefined}
                            onValueChange={(value) => setDishForm((previous) => ({ ...previous, menuId: value }))}
                          >
                            <SelectTrigger className="h-10 w-full rounded-xl border-border/70 bg-background px-3 text-sm">
                              <SelectValue placeholder="Select menu" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/70">
                              {menus.map((menu) => (
                                <SelectItem key={menu.id} value={menu.id}>
                                  {menu.name ?? "Unnamed menu"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </label>

                        <label className="space-y-2.5">
                          <span className="text-sm font-medium text-foreground">Price</span>
                          <input
                            value={dishForm.price}
                            onChange={(event) => setDishForm((previous) => ({ ...previous, price: event.target.value }))}
                            type="number"
                            min="0"
                            step="0.01"
                            className={FIELD_INPUT}
                            placeholder="e.g. 320"
                            required
                          />
                        </label>

                        <label className="space-y-2.5">
                          <span className="text-sm font-medium text-foreground">Cost</span>
                          <input
                            value={dishForm.cost}
                            onChange={(event) => setDishForm((previous) => ({ ...previous, cost: event.target.value }))}
                            type="number"
                            min="0"
                            step="0.01"
                            className={FIELD_INPUT}
                            placeholder="e.g. 140"
                          />
                        </label>

                        <label className="space-y-2.5 md:col-span-2">
                          <span className="text-sm font-medium text-foreground">Status</span>
                          <Select
                            value={dishForm.isActive}
                            onValueChange={(value) => setDishForm((previous) => ({ ...previous, isActive: value as "active" | "inactive" }))}
                          >
                            <SelectTrigger className="h-10 w-full rounded-xl border-border/70 bg-background px-3 text-sm">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/70">
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        </label>

                        <div className="md:col-span-2">
                          <button
                            type="submit"
                            disabled={isDishSubmitting}
                            className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {isDishSubmitting ? "Saving..." : editingDishId ? "Save Dish" : "Create Dish"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <form onSubmit={submitForm} className="mt-1">
                        <div className="grid max-h-[72vh] gap-5 overflow-y-auto px-1 pb-1 md:grid-cols-2">
                          <label className="space-y-2.5 md:col-span-2">
                            <span className="text-sm font-medium text-foreground">Dish</span>
                            <Select
                              value={form.dishId || undefined}
                              onValueChange={(value) => setForm((previous) => ({ ...previous, dishId: value }))}
                            >
                              <SelectTrigger className="h-10 w-full rounded-xl border-border/70 bg-background px-3 text-sm">
                                <SelectValue placeholder="Select dish" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-border/70">
                                {dishes.map((dish) => (
                                  <SelectItem key={dish.id} value={dish.id}>
                                    {dish.name ?? "Unnamed dish"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </label>

                          <div className="space-y-3 md:col-span-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-foreground">Ingredients</span>
                              {!editingId && (
                                <button
                                  type="button"
                                  onClick={addIngredientLine}
                                  className="inline-flex items-center gap-1 rounded-lg border border-border/70 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted/50"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  Add Ingredient
                                </button>
                              )}
                            </div>

                            {ingredientLines.map((line) => (
                              <div key={line.id} className="grid gap-3 rounded-xl border border-border/60 bg-background/50 p-3 md:grid-cols-[1fr_180px_auto]">
                                <Select
                                  value={line.ingredientId || undefined}
                                  onValueChange={(value) => updateIngredientLine(line.id, { ingredientId: value })}
                                >
                                  <SelectTrigger className="h-10 w-full rounded-xl border-border/70 bg-background px-3 text-sm">
                                    <SelectValue placeholder="Select ingredient" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl border-border/70">
                                    {ingredients.map((ingredient) => (
                                      <SelectItem key={ingredient.id} value={ingredient.id}>
                                        {ingredient.name ?? "Unnamed ingredient"}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                <input
                                  value={line.quantity}
                                  onChange={(event) => updateIngredientLine(line.id, { quantity: event.target.value })}
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  className={FIELD_INPUT}
                                  placeholder="Quantity"
                                  required
                                />

                                {!editingId && ingredientLines.length > 1 ? (
                                  <button
                                    type="button"
                                    onClick={() => removeIngredientLine(line.id)}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-400/40 text-red-500 transition hover:bg-red-500/10"
                                    aria-label="Remove ingredient row"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                ) : (
                                  <div className="h-10 w-10" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-6">
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {isSubmitting ? "Saving..." : editingId ? "Save Changes" : "Create Recipe"}
                          </button>
                        </div>
                      </form>
                    )}
                  </motion.section>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </MacOSSidebar>
    </main>
  );
}
