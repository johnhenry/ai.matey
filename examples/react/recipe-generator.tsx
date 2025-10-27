/**
 * Recipe Generator Example with useObject
 *
 * Demonstrates useObject hook for generating structured data.
 *
 * Setup:
 * ```bash
 * npm install react react-dom zod
 * npm install ai.matey
 * ```
 *
 * This example shows:
 * - Structured object generation with schemas
 * - Progressive streaming of partial objects
 * - Schema validation with Zod
 * - Type-safe data generation
 */

import React, { useState } from 'react';
import { useObject } from 'ai.matey/react';
import { createOpenAIBackendAdapter } from 'ai.matey/adapters/backend';
import { z } from 'zod';

// Define recipe schema
const recipeSchema = z.object({
  name: z.string().describe('Recipe name'),
  description: z.string().describe('Brief description of the dish'),
  prepTime: z.number().describe('Preparation time in minutes'),
  cookTime: z.number().describe('Cooking time in minutes'),
  servings: z.number().describe('Number of servings'),
  difficulty: z.enum(['easy', 'medium', 'hard']).describe('Difficulty level'),
  ingredients: z.array(
    z.object({
      item: z.string(),
      amount: z.string(),
    })
  ).describe('List of ingredients with amounts'),
  instructions: z.array(z.string()).describe('Step-by-step cooking instructions'),
  tags: z.array(z.string()).describe('Recipe tags (e.g., vegetarian, gluten-free)'),
});

type Recipe = z.infer<typeof recipeSchema>;

export default function RecipeGenerator() {
  const [dishName, setDishName] = useState('');

  // Create backend adapter
  const backend = React.useMemo(() => {
    return createOpenAIBackendAdapter({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }, []);

  // Initialize useObject hook
  const {
    object: recipe,
    submit,
    isLoading,
    error,
    stop,
  } = useObject<Recipe>({
    backend,
    model: 'gpt-4',
    schema: recipeSchema,
    temperature: 0.8, // Higher temperature for more creative recipes
    maxTokens: 1500,
    onFinish: (recipe) => {
      console.log('Recipe generated:', recipe);
    },
    onError: (error) => {
      console.error('Generation error:', error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (dishName.trim()) {
      submit(`Generate a detailed recipe for ${dishName}`);
    }
  };

  // Example suggestions
  const suggestions = [
    'chocolate chip cookies',
    'vegetarian lasagna',
    'Thai green curry',
    'homemade pizza',
    'beef wellington',
  ];

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
      <header style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1>🍳 AI Recipe Generator</h1>
        <p style={{ color: '#666' }}>Generate detailed, structured recipes with AI</p>
      </header>

      {/* Error display */}
      {error && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '20px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '8px',
          color: '#c00',
        }}>
          <strong>Error:</strong> {error.message}
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} style={{ marginBottom: '30px' }}>
        <div style={{ marginBottom: '15px' }}>
          <label
            htmlFor="dish-input"
            style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 'bold',
              fontSize: '15px',
            }}
          >
            What would you like to cook?
          </label>
          <input
            id="dish-input"
            type="text"
            value={dishName}
            onChange={(e) => setDishName(e.target.value)}
            placeholder="e.g., chocolate chip cookies"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px',
              border: '2px solid #ddd',
              borderRadius: '8px',
              fontSize: '15px',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isLoading ? (
            <button
              type="button"
              onClick={stop}
              style={{
                padding: '12px 24px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: 'bold',
              }}
            >
              ⏹ Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!dishName.trim()}
              style={{
                padding: '12px 24px',
                backgroundColor: dishName.trim() ? '#4caf50' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: dishName.trim() ? 'pointer' : 'not-allowed',
                fontSize: '15px',
                fontWeight: 'bold',
              }}
            >
              🔮 Generate Recipe
            </button>
          )}

          {/* Suggestions */}
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '13px', color: '#666', marginRight: '8px' }}>
              Try:
            </span>
            {suggestions.slice(0, 3).map((suggestion, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setDishName(suggestion)}
                disabled={isLoading}
                style={{
                  padding: '6px 10px',
                  marginRight: '6px',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  opacity: isLoading ? 0.5 : 1,
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </form>

      {/* Recipe display */}
      {(recipe || isLoading) && (
        <div style={{
          border: '2px solid #4caf50',
          borderRadius: '12px',
          padding: '24px',
          backgroundColor: 'white',
        }}>
          {/* Recipe header */}
          <div style={{ marginBottom: '24px', borderBottom: '2px solid #eee', paddingBottom: '16px' }}>
            <h2 style={{ margin: '0 0 8px 0', color: '#333' }}>
              {recipe?.name || (
                <span style={{ color: '#999' }}>Generating recipe name...</span>
              )}
            </h2>
            {recipe?.description && (
              <p style={{ margin: 0, color: '#666', fontSize: '15px' }}>
                {recipe.description}
              </p>
            )}
          </div>

          {/* Recipe metadata */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '12px',
            marginBottom: '24px',
          }}>
            <div style={{ padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Prep Time</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#4caf50' }}>
                {recipe?.prepTime ? `${recipe.prepTime} min` : '—'}
              </div>
            </div>
            <div style={{ padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Cook Time</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ff9800' }}>
                {recipe?.cookTime ? `${recipe.cookTime} min` : '—'}
              </div>
            </div>
            <div style={{ padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Servings</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2196f3' }}>
                {recipe?.servings || '—'}
              </div>
            </div>
            <div style={{ padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Difficulty</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#9c27b0', textTransform: 'capitalize' }}>
                {recipe?.difficulty || '—'}
              </div>
            </div>
          </div>

          {/* Tags */}
          {recipe?.tags && recipe.tags.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Tags:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {recipe.tags.map((tag, i) => (
                  <span
                    key={i}
                    style={{
                      padding: '4px 12px',
                      backgroundColor: '#e3f2fd',
                      color: '#1976d2',
                      borderRadius: '12px',
                      fontSize: '13px',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Ingredients */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '12px' }}>📝 Ingredients</h3>
            {recipe?.ingredients && recipe.ingredients.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '24px' }}>
                {recipe.ingredients.map((ingredient, i) => (
                  <li key={i} style={{ marginBottom: '8px', lineHeight: '1.6' }}>
                    <strong>{ingredient.amount}</strong> {ingredient.item}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: '#999', fontStyle: 'italic' }}>
                {isLoading ? 'Loading ingredients...' : 'No ingredients yet'}
              </p>
            )}
          </div>

          {/* Instructions */}
          <div>
            <h3 style={{ marginBottom: '12px' }}>👨‍🍳 Instructions</h3>
            {recipe?.instructions && recipe.instructions.length > 0 ? (
              <ol style={{ margin: 0, paddingLeft: '24px' }}>
                {recipe.instructions.map((step, i) => (
                  <li key={i} style={{ marginBottom: '12px', lineHeight: '1.6' }}>
                    {step}
                  </li>
                ))}
              </ol>
            ) : (
              <p style={{ color: '#999', fontStyle: 'italic' }}>
                {isLoading ? 'Loading instructions...' : 'No instructions yet'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: '#fff3cd',
          border: '1px solid '#ffc107',
          borderRadius: '6px',
          color: '#856404',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <div style={{
            width: '16px',
            height: '16px',
            border: '2px solid #856404',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          Generating recipe... (streaming structured data)
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
