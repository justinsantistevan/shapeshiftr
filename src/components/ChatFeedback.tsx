import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "./ui/button";

interface ChatFeedbackProps {
  messageId: string;
  currentFeedback: 'positive' | 'negative' | 'none';
  onFeedbackChange: (messageId: string, feedbackType: 'positive' | 'negative' | 'none') => Promise<void>;
  isDisabled?: boolean;
}

export const ChatFeedback = ({ 
  messageId, 
  currentFeedback, 
  onFeedbackChange,
  isDisabled = false 
}: ChatFeedbackProps) => {
  const handleThumbsUp = () => {
    const newFeedback = currentFeedback === 'positive' ? 'none' : 'positive';
    onFeedbackChange(messageId, newFeedback);
  };

  const handleThumbsDown = () => {
    const newFeedback = currentFeedback === 'negative' ? 'none' : 'negative';
    onFeedbackChange(messageId, newFeedback);
  };

  return (
    <div className="flex items-center gap-1 mt-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleThumbsUp}
        disabled={isDisabled}
        className={`h-7 w-7 p-0 transition-colors ${
          currentFeedback === 'positive' 
            ? 'text-green-600 hover:text-green-700 dark:text-green-500 dark:hover:text-green-400' 
            : 'text-muted-foreground hover:text-foreground'
        }`}
        aria-label="Thumbs up"
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleThumbsDown}
        disabled={isDisabled}
        className={`h-7 w-7 p-0 transition-colors ${
          currentFeedback === 'negative' 
            ? 'text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400' 
            : 'text-muted-foreground hover:text-foreground'
        }`}
        aria-label="Thumbs down"
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};
