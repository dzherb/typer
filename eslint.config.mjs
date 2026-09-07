import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

/*
 * The type-aware half of the linting. Biome reads one file at a time and is
 * quick enough to run on save; this one reads the whole program, and is what
 * catches a promise nobody awaited or a condition that was never in doubt.
 *
 * A rule is turned off here only where it and this codebase disagree about
 * style rather than about correctness, and each one says why.
 */
export default defineConfig(
  globalIgnores(["dist/", "public/", "deploy/"]),
  {
    files: ["**/*.ts", "**/*.mjs"],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        // This file is not in tsconfig.json, and is checked against defaults.
        projectService: { allowDefaultProject: ["eslint.config.mjs"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // The app talks to the person through notices, never through the console.
      "no-console": "error",

      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/prefer-readonly": "error",

      /*
       * The remembered carets are a plain object because they are written to
       * localStorage as JSON. `delete` is how a key leaves such an object; the
       * Map this rule steers towards would have to be converted on every read.
       */
      "@typescript-eslint/no-dynamic-delete": "off",

      // `() => close()` reads better than `() => { close(); }` in a table of
      // handlers, and what an event handler returns goes nowhere.
      "@typescript-eslint/no-confusing-void-expression": ["error", { ignoreArrowShorthand: true }],

      // A number in a template is a number; `${n}` is not a mistake.
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
  {
    /*
     * The catalogue in i18n.ts is its own declaration: `en` is typed as
     * `typeof ru`, so every entry's type comes from the Russian it is checked
     * against. Writing `: string` on each of them thirty-odd times would say
     * nothing the compiler does not already know.
     */
    files: ["src/i18n.ts"],
    rules: { "@typescript-eslint/explicit-module-boundary-types": "off" },
  },
);
