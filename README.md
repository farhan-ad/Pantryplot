# Pantryplot

**Your pantry. Tonight's possibilities.**

An ingredient-based recipe app built with React and a small Node.js API. Add what you have, request a recipe, and read the result in a calm Oat & Terracotta interface.

![Pantryplot home screen](docs/images/pantryplot-home.jpg)

## Features

- Add and remove ingredients with trimmed-input validation and case-insensitive duplicate prevention.
- Request a recipe after adding at least four ingredients.
- See loading feedback, clear errors and a retry option; the previous recipe stays visible if a later request fails.
- Read generated recipes as Markdown with headings, ingredient lists and numbered steps.
- Use a responsive interface with visible labels, linked validation messages and keyboard-focus styles.

<details>
<summary>View full desktop and mobile screens</summary>

### Desktop

![Pantryplot ingredients and recipe layout](docs/images/pantryplot-desktop.jpg)

### Mobile

<img src="docs/images/pantryplot-mobile.jpg" alt="Pantryplot on a narrow phone screen" width="320" />

The recipe shown in these screenshots is sample content used to test the interface.

</details>

## Stack

React 19, JavaScript, Vite, CSS, Node.js 24, Groq and react-markdown.

The API uses Node's built-in HTTP server and fetch. It does not require Express, a provider SDK or an environment-variable package.

## Run locally

### Requirements

- Node.js 24 and npm.
- A Groq API key from the [Groq console](https://console.groq.com/keys).

### Setup

From the project folder:

```sh
npm ci
```

Copy the example configuration and add your own key to `.env.local`.

PowerShell:

```powershell
Copy-Item .env.example .env.local
```

macOS or Linux:

```sh
cp .env.example .env.local
```

The configuration contains one server-only variable:

```dotenv
GROQ_API_KEY=your_groq_api_key_here
```

If `.env.local` already exists, edit it rather than replacing it. Do not use a `VITE_` prefix: the credential belongs on the server and must never be sent to the browser.

### Start the app

In one terminal, start the recipe API:

```sh
npm run server
```

In a second terminal, start Vite:

```sh
npm run dev
```

Open the Local URL printed by Vite. The API listens on `127.0.0.1:3001`. Restart `npm run server` after changing `.env.local`.

The configured Groq model is `openai/gpt-oss-120b`. Provider availability and account limits apply; see the [rate-limit documentation](https://console.groq.com/docs/rate-limits).

## How it works

1. `Main.jsx` owns the ingredient list, validation, loading, recipe and error state.
2. `IngredientsList.jsx` receives the list and callbacks through props. Its button calls the recipe handler in `Main`.
3. `src/ai.js` posts the ingredient array to `/api/recipe`.
4. During development, Vite proxies that request to the local Node server.
5. `server/index.js` validates the input and calls Groq using the private environment variable.
6. `Recipe.jsx` renders the returned Markdown and scrolls the recipe into view.

The server accepts 4 to 30 ingredients, with a maximum of 100 characters per ingredient. Recipe text uses ordinary Markdown; table rendering is not enabled.

## Project structure

```text
Pantryplot/
  docs/images/          README screenshots
  public/              Pantryplot SVG logo and favicon
  server/index.js      Input validation and server-side provider request
  src/
    components/
      Header.jsx
      Main.jsx
      IngredientsList.jsx
      Recipe.jsx
    App.jsx
    ai.js
    index.css
    index.jsx
  .env.example         Safe configuration template
  index.html
  package.json
  package-lock.json
  vite.config.js
```

## Design

The spoon monogram, Georgia headings and Inter body text give Pantryplot its own identity. Palette values are CSS variables in `src/index.css`.

| Role | Colour |
| --- | --- |
| Oat background | `#F8F3EB` |
| White surfaces | `#FFFFFF` |
| Soft beige | `#E9D9C8` |
| Terracotta accent | `#B97859` |
| Deep-clay buttons and focus | `#8A4B35` |
| Main text | `#382E29` |

The main buttons share `.button-primary`. Controls are at least 44 pixels tall, long ingredient names wrap safely, and hover transitions respect reduced-motion preferences.

## Validation

```sh
npm run lint
npm run build
```

The interface has been checked at 320, 375, 545, 768 and 1280 pixels wide. Input validation, removal, loading, success, failure and retry flows were checked with controlled local responses. The screenshots use a sample recipe rather than a recorded live provider response.

## Current limitations

- Ingredients and recipes are stored in React state and reset on refresh.
- This is configured for local development. The Node API binds to loopback and accepts local browser origins.
- A frontend build alone is not a complete deployed application. A public demo needs the API hosted separately or adapted for the chosen host, appropriate origin configuration and protection for the shared API quota.
- GitHub Pages is static hosting and cannot run this Node API. The repository can be shared independently of a hosted demo.

`.env.local`, dependencies and generated build output are excluded from version control. Keep your actual API key private.
