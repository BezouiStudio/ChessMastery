'use server';

/**
 * @fileOverview Explains the reasoning behind a suggested chess move.
 *
 * - explainMoveHint - A function that provides an explanation for a given chess move.
 * - ExplainMoveHintInput - The input type for the explainMoveHint function.
 * - ExplainMoveHintOutput - The return type for the explainMoveHint function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExplainMoveHintInputSchema = z.object({
  currentBoardState: z
    .string()
    .describe('FEN representation of the current chess board state.'),
  suggestedMove: z.string().describe('The suggested chess move in algebraic notation (e.g., e4, Nf3, Rd8).'),
  difficultyLevel: z
    .enum(['beginner', 'intermediate', 'advanced'])
    .describe('The difficulty level of the AI opponent.'),
  isPlayerInCheckBeforeHintedMove: z.boolean().optional().describe('Whether the player was in check on the currentBoardState before this suggestedMove is made.'),
});
export type ExplainMoveHintInput = z.infer<typeof ExplainMoveHintInputSchema>;

const ExplainMoveHintOutputSchema = z.object({
  explanation: z.string().describe('The AI tutor explanation of the suggested move.'),
});
export type ExplainMoveHintOutput = z.infer<typeof ExplainMoveHintOutputSchema>;

export async function explainMoveHint(input: ExplainMoveHintInput): Promise<ExplainMoveHintOutput> {
  return explainMoveHintFlow(input);
}

const prompt = ai.definePrompt({
  name: 'explainMoveHintPrompt',
  input: {schema: ExplainMoveHintInputSchema},
  output: {schema: ExplainMoveHintOutputSchema},
  prompt: `You are an expert chess tutor. Explain the reasoning behind the following chess move.

Current Board State (FEN): {{{currentBoardState}}}
Suggested Move: {{{suggestedMove}}}
Difficulty Level: {{{difficultyLevel}}}
{{#if isPlayerInCheckBeforeHintedMove}}
The player was in CHECK on this board state before the suggested move.
{{/if}}

Provide a clear, concise, and easy-to-understand explanation of why this move is being suggested.
{{#if isPlayerInCheckBeforeHintedMove}}
Specifically explain how this move addresses the check (e.g., by moving the king, blocking the check, or capturing the attacking piece). Since this is a suggested legal move, it must resolve the check.
{{/if}}
Focus on the strategic and tactical implications of the move, and how it benefits the player. Do not make up facts.
Use markdown bold syntax (**text**) for critical keywords or phrases in your explanation if appropriate for emphasis.
`,
});

const explainMoveHintFlow = ai.defineFlow(
  {
    name: 'explainMoveHintFlow',
    inputSchema: ExplainMoveHintInputSchema,
    outputSchema: ExplainMoveHintOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
