import { useState, useEffect } from 'react';
import { Mic, MicOff, ArrowRight, RotateCcw, Loader2 } from 'lucide-react';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { cn } from './lib/utils';

type Screen = 'welcome' | 'question1' | 'question2' | 'question3' | 'processing' | 'output';

interface Answers {
  whatYouFeel: string;
  whereYouFeelIt: string;
  whatItNeeds: string;
}

interface ProcessedOutput {
  feeling: string;
  location: string;
  need: string;
}

const QUESTIONS = [
  { key: 'whatYouFeel', prompt: 'What do you feel?' },
  { key: 'whereYouFeelIt', prompt: 'Where do you feel it in your body?' },
  { key: 'whatItNeeds', prompt: 'What does it need?' },
] as const;

function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [answers, setAnswers] = useState<Answers>({
    whatYouFeel: '',
    whereYouFeelIt: '',
    whatItNeeds: '',
  });
  const [output, setOutput] = useState<ProcessedOutput | null>(null);

  const {
    transcript,
    isListening,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  // Get current question index
  const currentQuestionIndex = screen === 'question1' ? 0 : screen === 'question2' ? 1 : screen === 'question3' ? 2 : -1;
  const currentQuestion = currentQuestionIndex >= 0 && currentQuestionIndex < QUESTIONS.length
    ? QUESTIONS[currentQuestionIndex as 0 | 1 | 2]
    : null;

  // Update answer when transcript changes
  useEffect(() => {
    if (currentQuestion && transcript) {
      setAnswers(prev => ({
        ...prev,
        [currentQuestion.key]: transcript,
      }));
    }
  }, [transcript, currentQuestion]);

  const handleStart = () => {
    setScreen('question1');
    resetTranscript();
  };

  const handleNext = () => {
    stopListening();

    if (screen === 'question1') {
      setScreen('question2');
      resetTranscript();
    } else if (screen === 'question2') {
      setScreen('question3');
      resetTranscript();
    } else if (screen === 'question3') {
      handleProcess();
    }
  };

  const handleProcess = async () => {
    setScreen('processing');

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      });

      if (!response.ok) {
        throw new Error('Failed to process');
      }

      const data = await response.json();
      setOutput(data);
      setScreen('output');
    } catch (err) {
      console.error('Processing error:', err);
      // For demo, use mock processing
      setOutput({
        feeling: answers.whatYouFeel || 'You shared something important.',
        location: answers.whereYouFeelIt || 'Your body is holding this.',
        need: answers.whatItNeeds || 'Take a moment to breathe.',
      });
      setScreen('output');
    }
  };

  const handleReset = () => {
    setScreen('welcome');
    setAnswers({ whatYouFeel: '', whereYouFeelIt: '', whatItNeeds: '' });
    setOutput(null);
    resetTranscript();
  };

  const toggleRecording = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Welcome Screen
  if (screen === 'welcome') {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="space-y-8 max-w-sm">
          <h1 className="text-4xl font-bold tracking-tight">
            WHAT DO YOU FEEL?
          </h1>
          <p className="text-lg text-zinc-400">
            ORGANIZE YOU.<br />
            IN 2 MINUTES.
          </p>

          {!isSupported && (
            <p className="text-sm text-red-400">
              Voice input not supported in this browser. Try Chrome or Safari.
            </p>
          )}

          <button
            onClick={handleStart}
            className="w-full py-4 px-8 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-full text-lg transition-colors"
          >
            START
          </button>

          <p className="text-xs text-zinc-500">
            Voice-first • Mobile-first
          </p>
        </div>
      </div>
    );
  }

  // Question Screens
  if (screen === 'question1' || screen === 'question2' || screen === 'question3') {
    const questionNumber = currentQuestionIndex + 1;
    const currentAnswer = currentQuestion ? answers[currentQuestion.key as keyof Answers] : '';

    return (
      <div className="min-h-full flex flex-col p-6">
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((num) => (
            <div
              key={num}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                num <= questionNumber ? 'bg-rose-600' : 'bg-zinc-800'
              )}
            />
          ))}
        </div>

        {/* Question */}
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
          <p className="text-sm text-zinc-500 uppercase tracking-wider">
            Question {questionNumber} of 3
          </p>

          <h2 className="text-2xl font-semibold">
            {currentQuestion?.prompt}
          </h2>

          {/* Record Button */}
          <div className="relative">
            {isListening && (
              <div className="absolute inset-0 bg-rose-600/30 rounded-full animate-pulse-ring" />
            )}
            <button
              onClick={toggleRecording}
              className={cn(
                'relative w-24 h-24 rounded-full flex items-center justify-center transition-all',
                isListening
                  ? 'bg-rose-600 text-white scale-110'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              )}
            >
              {isListening ? (
                <MicOff className="w-10 h-10" />
              ) : (
                <Mic className="w-10 h-10" />
              )}
            </button>
          </div>

          <p className="text-sm text-zinc-500">
            {isListening ? 'Tap to stop' : 'Tap to speak'}
          </p>

          {/* Transcript Display */}
          <div className="w-full max-w-md min-h-[100px] p-4 bg-zinc-900 rounded-lg">
            <p className={cn(
              'text-lg',
              currentAnswer ? 'text-white' : 'text-zinc-600'
            )}>
              {currentAnswer || 'Your words will appear here...'}
            </p>
          </div>
        </div>

        {/* Next Button */}
        <div className="pt-6">
          <button
            onClick={handleNext}
            disabled={!currentAnswer.trim()}
            className={cn(
              'w-full py-4 px-8 rounded-full font-semibold text-lg flex items-center justify-center gap-2 transition-all',
              currentAnswer.trim()
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            )}
          >
            {screen === 'question3' ? 'PROCESS' : 'NEXT'}
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // Processing Screen
  if (screen === 'processing') {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="space-y-6">
          <Loader2 className="w-16 h-16 text-rose-600 animate-spin mx-auto" />
          <p className="text-xl text-zinc-400">
            Organizing your thoughts...
          </p>
        </div>
      </div>
    );
  }

  // Output Screen
  if (screen === 'output' && output) {
    return (
      <div className="min-h-full flex flex-col p-6">
        <div className="flex-1 flex flex-col justify-center space-y-8">
          <h2 className="text-2xl font-bold text-center mb-4">
            YOU, ORGANIZED.
          </h2>

          {/* Output Cards */}
          <div className="space-y-4">
            <div className="p-5 bg-zinc-900 rounded-xl border border-zinc-800">
              <p className="text-xs text-rose-500 uppercase tracking-wider mb-2">
                WHAT YOU FEEL
              </p>
              <p className="text-lg">{output.feeling}</p>
            </div>

            <div className="p-5 bg-zinc-900 rounded-xl border border-zinc-800">
              <p className="text-xs text-rose-500 uppercase tracking-wider mb-2">
                WHERE YOU FEEL IT
              </p>
              <p className="text-lg">{output.location}</p>
            </div>

            <div className="p-5 bg-zinc-900 rounded-xl border border-zinc-800">
              <p className="text-xs text-rose-500 uppercase tracking-wider mb-2">
                WHAT YOU NEED
              </p>
              <p className="text-lg">{output.need}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-6 space-y-3">
          <button
            onClick={handleReset}
            className="w-full py-4 px-8 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-full text-lg flex items-center justify-center gap-2 transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            START OVER
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default App;
