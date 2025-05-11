import { config } from 'dotenv';
config();

import '@/ai/flows/move-hint-explanation'; // Keep this as it might be used by other parts or for single hints
import '@/ai/flows/ai-tutor-analysis';
import '@/ai/flows/vague-chess-hint';
