import { Component, createSignal, For, Show } from 'solid-js';

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "In what city were you born?",
  "What was your mother's maiden name?",
  "What was the make of your first car?",
  "What was the name of your elementary school?",
  "What is your favorite book?",
  "What was your childhood nickname?",
  "In what city did you meet your spouse?",
  "What is your favorite movie?",
  "What was your first job?",
  "What is your favorite food?",
  "What was the name of your best friend in school?",
  "What is your favorite color?",
  "What year did you graduate high school?",
  "What is your favorite sports team?"
];

interface SecurityQuestionsSetupProps {
  onComplete: (questions: string[], answers: string[]) => void;
  onSkip: () => void;
}

const SecurityQuestionsSetup: Component<SecurityQuestionsSetupProps> = (props) => {
  const [selectedQuestions, setSelectedQuestions] = createSignal<number[]>([]);
  const [answers, setAnswers] = createSignal<Record<number, string>>({});
  const [error, setError] = createSignal('');
  const [showAnswers, setShowAnswers] = createSignal(false);

  const toggleQuestion = (index: number) => {
    const current = selectedQuestions();
    if (current.includes(index)) {
      setSelectedQuestions(current.filter(i => i !== index));
      setAnswers(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    } else if (current.length < 3) {
      setSelectedQuestions([...current, index]);
    } else {
      setError('Please select exactly 3 questions');
    }
  };

  const updateAnswer = (index: number, value: string) => {
    setAnswers(prev => ({ ...prev, [index]: value }));
    setError('');
  };

  const handleContinue = () => {
    if (selectedQuestions().length !== 3) {
      setError('Please select exactly 3 questions');
      return;
    }
    setShowAnswers(true);
  };

  const handleComplete = () => {
    const selected = selectedQuestions();
    const allAnswered = selected.every(q => answers()[q]?.trim().length > 0);
    
    if (!allAnswered) {
      setError('Please answer all selected questions');
      return;
    }

    const questionTexts = selected.map(i => SECURITY_QUESTIONS[i]);
    const answerTexts = selected.map(i => 
      answers()[i]
        .trim()
        .replace(/^["']|["']$/g, '') // Remove quotes from start/end
        .trim() // Trim again after removing quotes
    );
    
    
    props.onComplete(questionTexts, answerTexts);
  };

  return (
    <div class="w-full max-w-2xl mx-auto p-4 md:p-6 bg-white dark:bg-gray-900">
      <Show when={!showAnswers()}>
        <div class="mb-6">
          <h2 class="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">Set Up PIN Recovery</h2>
          <p class="text-gray-600 dark:text-gray-400">
            Select 3 security questions. Your answers will be used to recover your PIN if you forget it.
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-500 mt-2">
            Note: Answers are case-insensitive and spaces will be removed.
          </p>
        </div>
      </Show>

      <Show when={showAnswers()}>
        <div class="mb-4">
          <h2 class="text-xl font-bold mb-1 text-gray-900 dark:text-gray-100">Answer your selected questions:</h2>
        </div>
      </Show>

      <Show when={error()}>
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-2 rounded-md text-sm mb-4">
          {error()}
        </div>
      </Show>

      <Show when={!showAnswers()}>
        <div class="mb-6">
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Select 3 questions ({selectedQuestions().length}/3):
          </p>
          <div class="max-h-[240px] overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-2 space-y-2 bg-white dark:bg-gray-800">
            <For each={SECURITY_QUESTIONS}>
              {(question, index) => (
                <label class="flex items-start p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-800">
                  <input
                    type="checkbox"
                    checked={selectedQuestions().includes(index())}
                    onChange={() => toggleQuestion(index())}
                    class="mt-1 mr-3 flex-shrink-0 accent-blue-600 dark:accent-blue-400"
                  />
                  <span class={`flex-1 text-gray-900 dark:text-gray-100 ${selectedQuestions().includes(index()) ? 'font-medium' : ''}`}>
                    {question}
                  </span>
                </label>
              )}
            </For>
          </div>
        </div>

        <div class="flex gap-3">
          <button
            onClick={handleContinue}
            disabled={selectedQuestions().length !== 3}
            class="flex-1 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-md hover:bg-gray-800 dark:hover:bg-gray-100 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            Continue
          </button>
          <button
            onClick={props.onSkip}
            class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100 transition-colors"
          >
            Skip Recovery Setup
          </button>
        </div>
      </Show>

      <Show when={showAnswers()}>
        <div class="space-y-3 mb-4">
          <For each={selectedQuestions()}>
            {(questionIndex) => (
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {SECURITY_QUESTIONS[questionIndex]}
                </label>
                <input
                  type="text"
                  value={answers()[questionIndex] || ''}
                  onInput={(e) => updateAnswer(questionIndex, e.currentTarget.value)}
                  placeholder="Your answer"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  autocomplete="off"
                />
              </div>
            )}
          </For>
        </div>

        <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded-md mb-4">
          <p class="text-xs text-yellow-800 dark:text-yellow-400 font-medium mb-1">Important:</p>
          <ul class="text-xs text-yellow-700 dark:text-yellow-400 list-disc list-inside space-y-0.5">
            <li>Write down your answers exactly as entered</li>
            <li>Answers are case-insensitive when recovering</li>
            <li>You cannot recover your PIN without these answers</li>
          </ul>
        </div>

        <div class="flex gap-3">
          <button
            onClick={handleComplete}
            class="flex-1 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-md hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
          >
            Complete Setup
          </button>
          <button
            onClick={() => setShowAnswers(false)}
            class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100 transition-colors"
          >
            Back
          </button>
        </div>
      </Show>
    </div>
  );
};

export default SecurityQuestionsSetup;