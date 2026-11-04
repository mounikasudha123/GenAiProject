export const safetyPattern = /\b(kill myself|suicid(?:e|al)|end my life|hurt myself|self[- ]harm|want to die|don't want to live|do not want to live)\b/i;

export function crisisReflection() {
  return {
    reflection: 'I’m sorry this feels so heavy right now. You deserve support from a real person, not just an app.',
    possibleEmotions: [],
    summary: 'This entry may describe an urgent safety concern. Automated wording checks can be wrong and cannot assess your safety.',
    followUpQuestion: 'Can you reach out to someone you trust and tell them you need support right now?',
    suggestedActions: ['If you may be in immediate danger, contact your local emergency service now.', 'Move closer to a trusted person and let them know what is happening.'],
    gratitudePrompt: null,
    supportReminder: 'MindMate is not an emergency service. In the U.S. or Canada, call or text 988. Elsewhere, contact your local crisis line or emergency service.'
  };
}
