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
  },
  {
    text: "What seems impossible today will one day become your warm-up.",
    author: "Unknown"
  },
  {
    text: "The only bad workout is the one that didn't happen.",
    author: "Unknown"
  },
  {
    text: "Strength doesn't come from what you can do. It comes from overcoming what you thought you couldn't.",
    author: "Rikki Rogers"
  },
  {
    text: "Take care of your body. It's the only place you have to live.",
    author: "Jim Rohn"
  },
  {
    text: "Fitness is not about being better than someone else. It's about being better than you used to be.",
    author: "Khloe Kardashian"
  },
  {
    text: "Every workout is progress.",
    author: "Unknown"
  },
  {
    text: "Don't wish for a good body, work for it.",
    author: "Unknown"
  },
  {
    text: "The resistance you fight physically in the gym and the resistance you fight in life can only build a strong character.",
    author: "Arnold Schwarzenegger"
  },
  {
    text: "Your health is an investment, not an expense.",
    author: "Unknown"
  },
  {
    text: "The only impossible journey is the one you never begin.",
    author: "Tony Robbins"
  },
  {
    text: "Fall seven times, get up eight.",
    author: "Japanese Proverb"
  },
  {
    text: "Push yourself because no one else is going to do it for you.",
    author: "Unknown"
  },
  {
    text: "Great things never come from comfort zones.",
    author: "Unknown"
  },
  {
    text: "It is during our darkest moments that we must focus to see the light.",
    author: "Aristotle"
  },
  {
    text: "A year from now you may wish you had started today.",
    author: "Karen Lamb"
  },
  {
    text: "Believe you can and you're halfway there.",
    author: "Theodore Roosevelt"
  },
  {
    text: "The difference between ordinary and extraordinary is that little extra.",
    author: "Jimmy Johnson"
  },
  {
    text: "Stop being afraid of what could go wrong and start being excited of what could go right.",
    author: "Tony Robbins"
  },
  {
    text: "Your limitation—it's only your imagination.",
    author: "Unknown"
  },
  {
    text: "Sometimes we're tested not to show our weaknesses, but to discover our strengths.",
    author: "Unknown"
  },
  {
    text: "The mind is everything. What you think you become.",
    author: "Buddha"
  },
  {
    text: "It's going to be hard, but hard does not mean impossible.",
    author: "Unknown"
  },
  {
    text: "Don't stop when you're tired. Stop when you're done.",
    author: "Unknown"
  },
  {
    text: "Whether you think you can or you think you can't, you're right.",
    author: "Henry Ford"
  },
  {
    text: "The cave you fear to enter holds the treasure you seek.",
    author: "Joseph Campbell"
  },
  {
    text: "Consistency is the mother of mastery.",
    author: "Robin Sharma"
  },
  {
    text: "You don't have to be extreme, just consistent.",
    author: "Unknown"
  },
  {
    text: "Small daily improvements over time lead to stunning results.",
    author: "Robin Sharma"
  },
  {
    text: "Be stronger than your strongest excuse.",
    author: "Unknown"
  },
  {
    text: "The first wealth is health.",
    author: "Ralph Waldo Emerson"
  },
  {
    text: "If you want something you've never had, you must be willing to do something you've never done.",
    author: "Thomas Jefferson"
  },
  {
    text: "Motivation is what gets you started. Habit is what keeps you going.",
    author: "Jim Ryun"
  },
  {
    text: "Champions train, losers complain.",
    author: "Unknown"
  },
  {
    text: "The pain of discipline weighs ounces, but the pain of regret weighs tons.",
    author: "Jim Rohn"
  },
  {
    text: "You are what you do, not what you say you'll do.",
    author: "Carl Jung"
  },
  {
    text: "Success is walking from failure to failure with no loss of enthusiasm.",
    author: "Winston Churchill"
  },
  {
    text: "The expert in anything was once a beginner.",
    author: "Helen Hayes"
  },
  {
    text: "Doubt kills more dreams than failure ever will.",
    author: "Suzy Kassem"
  },
  {
    text: "You are never too old to set another goal or to dream a new dream.",
    author: "C.S. Lewis"
  },
  {
    text: "The only person you are destined to become is the person you decide to be.",
    author: "Ralph Waldo Emerson"
  },
  {
    text: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    author: "Winston Churchill"
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
      <div className="relative z-10 pr-12">
        <blockquote className="text-lg font-medium text-foreground mb-2 italic min-h-[3rem] flex items-center justify-center">
          "{currentQuote.text}"
        </blockquote>
        <p className="text-sm text-muted-foreground">— {currentQuote.author}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={refreshQuote}
        className="absolute top-2 right-2 h-8 w-8 p-0 z-20"
        disabled={isRefreshing}
      >
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      </Button>
    </Card>
  );
}