import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";

const QUOTES = [
  {
    text: "Success is the sum of small efforts repeated day in and day out.",
    author: "Robert Collier",
  },
  {
    text: "The groundwork for all happiness is good health.",
    author: "Leigh Hunt",
  },
  {
    text: "You have been assigned this mountain to show others it can be moved.",
    author: "Mel Robbins",
  },
  {
    text: "Discipline is choosing between what you want now and what you want most.",
    author: "Abraham Lincoln",
  },
  {
    text: "The successful warrior is the average man with laser-like focus.",
    author: "Bruce Lee",
  },
  {
    text: "Progress, not perfection, is what we should be striving for.",
    author: "Unknown",
  },
  {
    text: "Your body can do it. It's your mind you have to convince.",
    author: "Unknown",
  },
  {
    text: "The pain you feel today will be the strength you feel tomorrow.",
    author: "Unknown",
  },
  {
    text: "Champions keep playing until they get it right.",
    author: "Billie Jean King",
  },
  {
    text: "What seems impossible today will one day become your warm-up.",
    author: "Unknown",
  },
  {
    text: "The only bad workout is the one that didn't happen.",
    author: "Unknown",
  },
  {
    text: "Strength doesn't come from what you can do. It comes from overcoming what you thought you couldn't.",
    author: "Rikki Rogers",
  },
  {
    text: "Take care of your body. It's the only place you have to live.",
    author: "Jim Rohn",
  },
  {
    text: "Fitness is not about being better than someone else. It's about being better than you used to be.",
    author: "Khloe Kardashian",
  },
  {
    text: "Every workout is progress.",
    author: "Unknown",
  },
  {
    text: "Don't wish for a good body, work for it.",
    author: "Unknown",
  },
  {
    text: "The resistance you fight physically in the gym and the resistance you fight in life can only build a strong character.",
    author: "Arnold Schwarzenegger",
  },
  {
    text: "Your health is an investment, not an expense.",
    author: "Unknown",
  },
  {
    text: "The only impossible journey is the one you never begin.",
    author: "Tony Robbins",
  },
  {
    text: "Fall seven times, get up eight.",
    author: "Japanese Proverb",
  },
  {
    text: "Push yourself because no one else is going to do it for you.",
    author: "Unknown",
  },
  {
    text: "Great things never come from comfort zones.",
    author: "Unknown",
  },
  {
    text: "It is during our darkest moments that we must focus to see the light.",
    author: "Aristotle",
  },
  {
    text: "A year from now you may wish you had started today.",
    author: "Karen Lamb",
  },
  {
    text: "Believe you can and you're halfway there.",
    author: "Theodore Roosevelt",
  },
  {
    text: "The difference between ordinary and extraordinary is that little extra.",
    author: "Jimmy Johnson",
  },
  {
    text: "Stop being afraid of what could go wrong and start being excited of what could go right.",
    author: "Tony Robbins",
  },
  {
    text: "Your limitation — it's only your imagination.",
    author: "Unknown",
  },
  {
    text: "Sometimes we're tested not to show our weaknesses, but to discover our strengths.",
    author: "Unknown",
  },
  {
    text: "The mind is everything. What you think you become.",
    author: "Buddha",
  },
  {
    text: "It's going to be hard, but hard does not mean impossible.",
    author: "Unknown",
  },
  {
    text: "Don't stop when you're tired. Stop when you're done.",
    author: "Unknown",
  },
  {
    text: "Whether you think you can or you think you can't, you're right.",
    author: "Henry Ford",
  },
  {
    text: "The cave you fear to enter holds the treasure you seek.",
    author: "Joseph Campbell",
  },
  {
    text: "Consistency is the mother of mastery.",
    author: "Robin Sharma",
  },
  {
    text: "You don't have to be extreme, just consistent.",
    author: "Unknown",
  },
  {
    text: "Small daily improvements over time lead to stunning results.",
    author: "Robin Sharma",
  },
  {
    text: "Be stronger than your strongest excuse.",
    author: "Unknown",
  },
  {
    text: "The first wealth is health.",
    author: "Ralph Waldo Emerson",
  },
  {
    text: "If you want something you've never had, you must be willing to do something you've never done.",
    author: "Thomas Jefferson",
  },
  {
    text: "Motivation is what gets you started. Habit is what keeps you going.",
    author: "Jim Ryun",
  },
  {
    text: "Champions train, losers complain.",
    author: "Unknown",
  },
  {
    text: "The pain of discipline weighs ounces, but the pain of regret weighs tons.",
    author: "Jim Rohn",
  },
  {
    text: "You are what you do, not what you say you'll do.",
    author: "Carl Jung",
  },
  {
    text: "Success is walking from failure to failure with no loss of enthusiasm.",
    author: "Winston Churchill",
  },
  {
    text: "The expert in anything was once a beginner.",
    author: "Helen Hayes",
  },
  {
    text: "Doubt kills more dreams than failure ever will.",
    author: "Suzy Kassem",
  },
  {
    text: "You are never too old to set another goal or to dream a new dream.",
    author: "C.S. Lewis",
  },
  {
    text: "The only person you are destined to become is the person you decide to be.",
    author: "Ralph Waldo Emerson",
  },
  {
    text: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    author: "Winston Churchill",
  },
  {
    text: "Hard work beats talent when talent doesn't work hard.",
    author: "Tim Notke",
  },
  {
    text: "It's not whether you get knocked down, it's whether you get up.",
    author: "Vince Lombardi",
  },
  {
    text: "Long-term consistency trumps short-term intensity.",
    author: "Bruce Lee",
  },
  {
    text: "Nothing will work unless you do.",
    author: "Maya Angelou",
  },
  {
    text: "The difference between the impossible and the possible lies in a person's determination.",
    author: "Tommy Lasorda",
  },
  {
    text: "When you feel like quitting, remember why you started.",
    author: "Unknown",
  },
  {
    text: "I hated every minute of training, but I said, 'Don't quit. Suffer now and live the rest of your life as a champion.'",
    author: "Muhammad Ali",
  },
  {
    text: "Run when you can, walk if you have to, crawl if you must; just never give up.",
    author: "Dean Karnazes",
  },
  {
    text: "Some people want it to happen, some wish it would happen, others make it happen.",
    author: "Michael Jordan",
  },
  {
    text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
    author: "Aristotle",
  },
  {
    text: "The only place where success comes before work is in the dictionary.",
    author: "Vidal Sassoon",
  },
  {
    text: "Perseverance is not a long race; it is many short races one after another.",
    author: "Walter Elliott",
  },
  {
    text: "If you don't find the time, if you don't do the work, you don't get the results.",
    author: "Arnold Schwarzenegger",
  },
  {
    text: "A well-built physique is a status symbol. It reflects you worked hard for it, no money can buy it.",
    author: "Pauline Nordine",
  },
  {
    text: "Those who think they have not time for bodily exercise will sooner or later have to find time for illness.",
    author: "Edward Stanley",
  },
  {
    text: "Don't lower your expectations to meet your performance. Raise your level of performance to meet your expectations.",
    author: "Ralph Marston",
  },
  {
    text: "Physical fitness is not only one of the most important keys to a healthy body, it is the basis of dynamic and creative intellectual activity.",
    author: "John F. Kennedy",
  },
  {
    text: "I don't stop when I'm tired. I stop when I'm done.",
    author: "David Goggins",
  },
  {
    text: "Success is no accident. It is hard work, perseverance, learning, studying, sacrifice and most of all, love of what you are doing.",
    author: "Pelé",
  },
  {
    text: "Energy and persistence conquer all things.",
    author: "Benjamin Franklin",
  },
  {
    text: "The body achieves what the mind believes.",
    author: "Unknown",
  },
  {
    text: "You have power over your mind, not outside events. Realize this, and you will find strength.",
    author: "Marcus Aurelius",
  },
  {
    text: "It's hard to beat a person who never gives up.",
    author: "Babe Ruth",
  },
  {
    text: "If you think lifting is dangerous, try being weak. Being weak is dangerous.",
    author: "Bret Contreras",
  },
  {
    text: "Never say never because limits, like fears, are often just an illusion.",
    author: "Michael Jordan",
  },
  {
    text: "Dead last finish is greater than did not finish, which trumps did not start.",
    author: "Unknown",
  },
  {
    text: "The last three or four reps is what makes the muscle grow. This area of pain divides a champion from someone who is not a champion.",
    author: "Arnold Schwarzenegger",
  },
  {
    text: "Winning doesn't always mean being first. Winning means you're doing better than you've ever done before.",
    author: "Bonnie Blair",
  },
  {
    text: "Exercise is king and nutrition is queen. Together you have a kingdom.",
    author: "Jack LaLanne",
  },
  {
    text: "If something stands between you and your success, move it. Never be denied.",
    author: "Dwayne 'The Rock' Johnson",
  },
  {
    text: "Make each day your masterpiece.",
    author: "John Wooden",
  },
  {
    text: "To uncover your true potential you must first find your own limits and then you have the courage to blow past them.",
    author: "Picabo Street",
  },
  {
    text: "I've failed over and over and over again in my life and that is why I succeed.",
    author: "Michael Jordan",
  },
  {
    text: "There may be people who have more talent than you, but there's no excuse for anyone to work harder than you do.",
    author: "Derek Jeter",
  },
  {
    text: "Without self-discipline, success is impossible, period.",
    author: "Lou Holtz",
  },
  {
    text: "An athlete cannot run with money in his pockets. He must run with hope in his heart and dreams in his head.",
    author: "Emil Zatopek",
  },
  {
    text: "Persistence can change failure into extraordinary achievement.",
    author: "Matt Biondi",
  },
  {
    text: "You will never always be motivated, so you must learn to be disciplined.",
    author: "Unknown",
  },
  {
    text: "Mastering others is strength. Mastering yourself is true power.",
    author: "Lao Tzu",
  },
  {
    text: "You can't put a limit on anything. The more you dream, the farther you get.",
    author: "Michael Phelps",
  },
  {
    text: "Champions are made from something they have deep inside them — a desire, a dream, a vision.",
    author: "Muhammad Ali",
  },
  {
    text: "In training, you listen to your body. In competition, you tell your body to shut up.",
    author: "Rich Froning Jr.",
  },
  {
    text: "I am building a fire, and every day I train, I add more fuel. At just the right moment, I light the match.",
    author: "Mia Hamm",
  },
];

export function InspirationalQuote() {
  const [currentQuote, setCurrentQuote] = useState(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
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
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
      </Button>
    </Card>
  );
}
