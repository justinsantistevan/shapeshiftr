import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";

const QUOTES = [
  {
    text: "Success is the sum of small efforts repeated day in and day out.",
    author: "Robert Collier"
  },
  {
    text: "The groundwork for all happiness is good health.",
    author: "Leigh Hunt"
  },
  {
    text: "You have been assigned this mountain to show others it can be moved.",
    author: "Mel Robbins"
  },
  {
    text: "Discipline is choosing between what you want now and what you want most.",
    author: "Abraham Lincoln"
  },
  {
    text: "The successful warrior is the average man with laser-like focus.",
    author: "Bruce Lee"
  },
  {
    text: "Progress, not perfection, is what we should be striving for.",
    author: "Unknown"
  },
  {
    text: "A goal is a dream with a deadline.",
    author: "Napoleon Hill"
  },
  {
    text: "Your body can do it. It's your mind you have to convince.",
    author: "Unknown"
  },
  {
    text: "The pain you feel today will be the strength you feel tomorrow.",
    author: "Unknown"
  },
  {
    text: "Champions keep playing until they get it right.",
    author: "Billie Jean King"
  }
];

export function InspirationalQuote() {
  const [currentQuote, setCurrentQuote] = useState(
    QUOTES[Math.floor(Math.random() * QUOTES.length)]
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshQuote = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      let newQuote;
      do {
        newQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
      } while (newQuote.text === currentQuote.text);
      
      setCurrentQuote(newQuote);
      setIsRefreshing(false);
    }, 300);
  };

  return (
    <Card className="fitness-card p-6 text-center relative overflow-hidden">
      <div className="absolute inset-0 hero-gradient opacity-5"></div>
      <div className="relative z-10">
        <blockquote className="text-lg font-medium text-foreground mb-2 italic">
          "{currentQuote.text}"
        </blockquote>
        <p className="text-sm text-muted-foreground">— {currentQuote.author}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={refreshQuote}
          className="absolute top-4 right-4 h-8 w-8 p-0"
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </Card>
  );
}