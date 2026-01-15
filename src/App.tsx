import { useState, useEffect } from 'react';
import { Mic, MicOff, ArrowRight, RotateCcw, Loader2, ChevronDown } from 'lucide-react';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { cn } from './lib/utils';

type Screen = 'welcome' | 'inquiry' | 'processing' | 'output';

interface InquiryEntry {
  question: string;
  answer: string;
  depth: number;
}

interface ProcessedOutput {
  coreFeeling: string;
  bodyWisdom: string;
  underlyingNeed: string;
  integration: string;
  shift: string;
}

// RAIN-inspired inquiry questions - progressively deeper
const INITIAL_QUESTIONS = [
  "What do you feel right now?",
  "Where do you feel it in your body?",
  "What does this feeling need from you?",
];

const DEEPENING_QUESTIONS = [
  "What's underneath that?",
  "If this feeling could speak, what would it say?",
  "What are you afraid might happen?",
  "What do you really need right now?",
  "What would help you feel safe?",
  "Is there something you haven't allowed yourself to feel?",
];

function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [entries, setEntries] = useState<InquiryEntry[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [depth, setDepth] = useState(0); // 0 = initial questions, 1+ = deepening
  const [output, setOutput] = useState<ProcessedOutput | null>(null);

  const {
    transcript,
    isListening,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  // Get current question
  const getCurrentQuestion = () => {
    if (depth === 0 && currentQuestionIndex < INITIAL_QUESTIONS.length) {
      return INITIAL_QUESTIONS[currentQuestionIndex];
    }
    // Pick a contextual deepening question
    const deepIndex = (currentQuestionIndex + depth) % DEEPENING_QUESTIONS.length;
    return DEEPENING_QUESTIONS[deepIndex];
  };

  // Sync transcript to current answer (append mode)
  useEffect(() => {
    if (transcript && screen === 'inquiry') {
      setCurrentAnswer(transcript);
    }
  }, [transcript, screen]);

  const handleStart = () => {
    setScreen('inquiry');
    setEntries([]);
    setCurrentAnswer('');
    setCurrentQuestionIndex(0);
    setDepth(0);
    resetTranscript();
  };

  const handleNext = () => {
    stopListening();

    if (!currentAnswer.trim()) return;

    // Save current entry
    const newEntry: InquiryEntry = {
      question: getCurrentQuestion(),
      answer: currentAnswer.trim(),
      depth,
    };
    const newEntries = [...entries, newEntry];
    setEntries(newEntries);

    // Move to next question
    if (depth === 0 && currentQuestionIndex < INITIAL_QUESTIONS.length - 1) {
      // Still in initial questions
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setCurrentAnswer('');
      resetTranscript();
    } else if (depth === 0) {
      // Finished initial questions, offer to go deeper or complete
      setDepth(1);
      setCurrentQuestionIndex(0);
      setCurrentAnswer('');
      resetTranscript();
    } else {
      // In deepening mode - always offer choice after each answer
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setCurrentAnswer('');
      resetTranscript();
    }
  };

  const handleGoDeeper = () => {
    // Continue with next deepening question
    handleNext();
  };

  const handleComplete = () => {
    stopListening();

    // Build final entries list including current answer
    let finalEntries = [...entries];
    if (currentAnswer.trim()) {
      const newEntry: InquiryEntry = {
        question: getCurrentQuestion(),
        answer: currentAnswer.trim(),
        depth,
      };
      finalEntries = [...entries, newEntry];
      setEntries(finalEntries);
    }

    handleProcess(finalEntries);
  };

  const handleProcess = async (finalEntries?: InquiryEntry[]) => {
    const entriesToProcess = finalEntries || entries;
    setScreen('processing');

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: entriesToProcess }),
      });

      if (!response.ok) {
        throw new Error('Failed to process');
      }

      const data = await response.json();
      setOutput(data);
      setScreen('output');
    } catch (err) {
      console.error('Processing error:', err);
      // Fallback: Generate a simple integration locally
      const feelings = entriesToProcess.filter(e => e.depth === 0).map(e => e.answer);
      const deeper = entriesToProcess.filter(e => e.depth > 0).map(e => e.answer);

      setOutput({
        coreFeeling: feelings[0] || 'Something important surfaced.',
        bodyWisdom: feelings[1] || 'Your body is holding this.',
        underlyingNeed: deeper.length > 0
          ? `Beneath the surface: ${deeper[deeper.length - 1]}`
          : feelings[2] || 'A need for presence.',
        integration: `You explored ${entriesToProcess.length} layers of feeling. The thread connecting them points toward what truly matters to you right now.`,
        shift: entriesToProcess.length > 3
          ? 'By staying with your experience, you moved from the surface to something deeper.'
          : 'You touched something real. Consider returning to explore further.',
      });
      setScreen('output');
    }
  };

  const handleReset = () => {
    setScreen('welcome');
    setEntries([]);
    setCurrentAnswer('');
    setCurrentQuestionIndex(0);
    setDepth(0);
    setOutput(null);
    resetTranscript();
  };

  const toggleRecording = () => {
    if (isListening) {
      stopListening();
    } else {
      // Pass existing text to preserve it
      startListening(currentAnswer);
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
        </div>
      </div>
    );
  }

  // Inquiry Screen (RAIN-style)
  if (screen === 'inquiry') {
    const totalAnswered = entries.length;
    const isDeepening = depth > 0;
    const showDeeperOption = isDeepening || (depth === 0 && currentQuestionIndex === INITIAL_QUESTIONS.length - 1);

    return (
      <div className="min-h-full flex flex-col p-6">
        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex gap-1">
            {[1, 2, 3].map((num) => (
              <div
                key={num}
                className={cn(
                  'w-2 h-2 rounded-full transition-colors',
                  totalAnswered >= num ? 'bg-rose-600' : 'bg-zinc-800'
                )}
              />
            ))}
          </div>
          {isDeepening && (
            <span className="text-xs text-rose-500 ml-2">
              Going deeper...
            </span>
          )}
        </div>

        {/* Previous answers (collapsed) */}
        {entries.length > 0 && (
          <div className="mb-4 space-y-2 max-h-32 overflow-y-auto">
            {entries.slice(-2).map((entry, i) => (
              <div key={i} className="text-sm text-zinc-500 truncate">
                <span className="text-zinc-600">{entry.question}</span>
                <ChevronDown className="w-3 h-3 inline mx-1" />
                <span className="text-zinc-400 italic">"{entry.answer}"</span>
              </div>
            ))}
          </div>
        )}

        {/* Current Question */}
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
          <h2 className="text-2xl font-semibold">
            {getCurrentQuestion()}
          </h2>

          {/* Combined Input */}
          <div className="w-full max-w-md space-y-4">
            <textarea
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              placeholder="Type or tap the mic to speak..."
              className="w-full h-32 p-4 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-rose-600 text-lg"
            />

            {/* Mic Button */}
            <div className="flex items-center justify-center gap-3">
              <div className="relative">
                {isListening && (
                  <div className="absolute inset-0 bg-rose-600/30 rounded-full animate-pulse-ring" />
                )}
                <button
                  onClick={toggleRecording}
                  className={cn(
                    'relative w-14 h-14 rounded-full flex items-center justify-center transition-all',
                    isListening
                      ? 'bg-rose-600 text-white scale-110'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  )}
                >
                  {isListening ? (
                    <MicOff className="w-6 h-6" />
                  ) : (
                    <Mic className="w-6 h-6" />
                  )}
                </button>
              </div>
              <p className="text-sm text-zinc-500">
                {isListening ? 'Recording...' : 'or tap to speak'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-6 space-y-3">
          {showDeeperOption && currentAnswer.trim() ? (
            // Show both options when deepening is available
            <>
              <button
                onClick={handleGoDeeper}
                className="w-full py-4 px-8 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-full text-lg flex items-center justify-center gap-2 transition-all"
              >
                GO DEEPER
                <ChevronDown className="w-5 h-5" />
              </button>
              <button
                onClick={handleComplete}
                className="w-full py-4 px-8 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-full text-lg flex items-center justify-center gap-2 transition-all"
              >
                I'M READY
                <ArrowRight className="w-5 h-5" />
              </button>
            </>
          ) : (
            // Just next button during initial questions
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
              NEXT
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
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
            Integrating your experience...
          </p>
        </div>
      </div>
    );
  }

  // Output Screen (Consolidated Summary)
  if (screen === 'output' && output) {
    return (
      <div className="min-h-full flex flex-col p-6 overflow-y-auto">
        <div className="flex-1 space-y-6">
          <h2 className="text-2xl font-bold text-center mb-6">
            YOUR INTEGRATION
          </h2>

          {/* Core Feeling */}
          <div className="p-5 bg-zinc-900 rounded-xl border border-zinc-800">
            <p className="text-xs text-rose-500 uppercase tracking-wider mb-2">
              WHAT YOU'RE FEELING
            </p>
            <p className="text-lg">{output.coreFeeling}</p>
          </div>

          {/* Body Wisdom */}
          <div className="p-5 bg-zinc-900 rounded-xl border border-zinc-800">
            <p className="text-xs text-rose-500 uppercase tracking-wider mb-2">
              WHAT YOUR BODY KNOWS
            </p>
            <p className="text-lg">{output.bodyWisdom}</p>
          </div>

          {/* Underlying Need */}
          <div className="p-5 bg-zinc-900 rounded-xl border border-zinc-800">
            <p className="text-xs text-rose-500 uppercase tracking-wider mb-2">
              WHAT'S UNDERNEATH
            </p>
            <p className="text-lg">{output.underlyingNeed}</p>
          </div>

          {/* Integration Insight */}
          <div className="p-5 bg-gradient-to-br from-rose-950/50 to-zinc-900 rounded-xl border border-rose-900/50">
            <p className="text-xs text-rose-400 uppercase tracking-wider mb-2">
              THE THREAD
            </p>
            <p className="text-lg">{output.integration}</p>
          </div>

          {/* Shift */}
          <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
            <p className="text-sm text-zinc-400 italic">
              {output.shift}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-6">
          <button
            onClick={handleReset}
            className="w-full py-4 px-8 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-full text-lg flex items-center justify-center gap-2 transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            START FRESH
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default App;
