function IngredientsList({
  ingredients,
  onGetRecipe,
  isLoading,
  onRemoveIngredient,
}) {
  const ingredient = ingredients.map((ingredient) => (
    <li key={ingredient} className="ingredient">
      <div className="ingredient-row">
        <span className="ingredient-name">{ingredient}</span>
        <button
          className="remove-ingredient"
          type="button"
          onClick={() => onRemoveIngredient(ingredient)}
          aria-label={`Remove ${ingredient}`}
        >
          Remove
        </button>
      </div>
    </li>
  ));

  return (
    <section className="pantry-section" aria-labelledby="pantry-title">
      <h2 className="section-title" id="pantry-title">Your ingredients</h2>
      <ul className="ingredient-list" aria-live="polite" role="list">
        {ingredient}
      </ul>
      {ingredients.length > 3 && (
        <div className="get-recipe-container">
          <div>
            <h3>Ready for something good?</h3>
            <p>Turn these ingredients into a recipe you can make tonight.</p>
          </div>
          <button
            className="button-primary"
            type="button"
            onClick={onGetRecipe}
            disabled={isLoading}
          >
            {isLoading ? "Getting a recipe..." : "Get a recipe"}
          </button>
        </div>
      )}
    </section>
  );
}

export default IngredientsList;
