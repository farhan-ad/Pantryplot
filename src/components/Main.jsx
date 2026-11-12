import { useState } from "react";
import Recipe from "./Recipe.jsx";
import IngredientsList from "./IngredientsList.jsx";
import { getRecipeFromGroq } from "../ai.js";

function Main() {
  const [ingredients, setIngredients] = useState([]);
  const [ingredientInput, setIngredientInput] = useState("");
  const [ingredientError, setIngredientError] = useState("");
  const [recipe, setRecipe] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const addIngredient = () => {
    const ingredient = ingredientInput.trim();

    if (!ingredient) {
      setIngredientError("Please enter an ingredient.");
      return;
    }

    const isDuplicate = ingredients.some(
      (item) => item.toLowerCase() === ingredient.toLowerCase(),
    );

    if (isDuplicate) {
      setIngredientError("This ingredient is already in the list.");
      return;
    }
    setIngredients((prevIngredients) => [...prevIngredients, ingredient]);

    setIngredientInput("");
    setIngredientError("");
  };

  function removeIngredient(ingredientToRemove) {
    setIngredients((prevIngredients) =>
      prevIngredients.filter((ingredient) => ingredient !== ingredientToRemove),
    );
    setIngredientError("");
  }

  async function getRecipe() {
    if (isLoading) return;

    setIsLoading(true);
    setError("");

    try {
      const recipeMarkdown = await getRecipeFromGroq(ingredients);
      setRecipe(recipeMarkdown);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="main">
      <section className="app-intro" aria-labelledby="intro-title">
        <p className="eyebrow">A little pantry inspiration</p>
        <h2 id="intro-title">Make more of what’s there.</h2>
        <p className="intro-description">
          A few ingredients. Something good for dinner.
        </p>
      </section>
      <label className="ingredient-label" htmlFor="ingredient">
        Add an ingredient
      </label>
      <form className="ingredient-form" action={addIngredient}>
        <input
          type="text"
          name="ingredient"
          id="ingredient"
          placeholder="e.g. tomatoes"
          value={ingredientInput}
          onChange={(e) => setIngredientInput(e.target.value)}
          aria-invalid={Boolean(ingredientError)}
          aria-describedby={
            ingredientError ? "ingredient-help ingredient-error" : "ingredient-help"
          }
        />
        <button className="button-primary" type="submit">
          + Add ingredient
        </button>
      </form>
      <p className="field-help" id="ingredient-help">
        Add one at a time. You’ll need at least 4 to get a recipe.
      </p>
      {ingredientError && (
        <p className="recipe-error" id="ingredient-error" role="alert">
          {ingredientError}
        </p>
      )}
      {ingredients.length > 0 && (
        <IngredientsList
          ingredients={ingredients}
          onGetRecipe={getRecipe}
          isLoading={isLoading}
          onRemoveIngredient={removeIngredient}
        />
      )}
      {error && (
        <p className="recipe-error" role="alert">
          {error}
        </p>
      )}
      {recipe && <Recipe recipe={recipe} />}
    </main>
  );
}

export default Main;
