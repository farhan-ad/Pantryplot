import Markdown from "react-markdown";
import { useRef, useEffect } from "react";

function Recipe({ recipe }) {
  const recipeRef = useRef(null);

  useEffect(() => {
    if (recipeRef.current) {
      recipeRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [recipe]);

  return (
    <section
      className="recipe-section"
      ref={recipeRef}
      aria-labelledby="recipe-title"
    >
      <h2 className="recipe-heading" id="recipe-title">Your Pantryplot recipe</h2>
      <article className="suggested-recipe-container" aria-live="polite">
        <Markdown>{recipe}</Markdown>
      </article>
    </section>
  );
}

export default Recipe;
