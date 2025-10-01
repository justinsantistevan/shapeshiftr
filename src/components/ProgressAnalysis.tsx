import { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, RefreshCw, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FitnessStats } from "@/lib/fitnessCalculations";
import { UserGoals } from "@/lib/userGoals";
import { fetchUserAffirmations, type Affirmation } from "@/lib/affirmations";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";
import ReactMarkdown from "react-markdown";

interface ProgressAnalysisProps {
  stats: FitnessStats | null;
  goals: UserGoals;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const ProgressAnalysis = ({ stats, goals }: ProgressAnalysisProps) => {
  const [analysis, setAnalysis] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userMessage, setUserMessage] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [affirmations, setAffirmations] = useState<Affirmation[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadAffirmations = async () => {
      const userAffirmations = await fetchUserAffirmations();
      setAffirmations(userAffirmations);
    };
    loadAffirmations();
  }, []);

  const fetchAnalysis = async () => {
    if (!stats) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-progress', {
        body: { stats, goals }
      });

      if (error) throw error;
      if (data?.error) {
        throw new Error(data.error);
      }
      setAnalysis(data.analysis);
    } catch (error) {
      console.error('Error fetching progress analysis:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Detailed error:', errorMessage);
      setAnalysis(`Unable to generate analysis: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, [stats, goals]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [chatMessages, isChatLoading]);

  const sendMessage = async () => {
    if (!userMessage.trim() || isChatLoading) return;

    const newUserMessage: ChatMessage = {
      role: 'user',
      content: userMessage
    };

    setChatMessages(prev => [...prev, newUserMessage]);
    setUserMessage("");
    setIsChatLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('chat-coach', {
        body: { 
          message: userMessage,
          stats,
          goals,
          affirmations,
          conversationHistory: chatMessages
        }
      });

      if (error) throw error;
      if (data?.error) {
        throw new Error(data.error);
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.reply
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error in chat:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorResponse: ChatMessage = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}`
      };
      setChatMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setChatMessages([]);
  };

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Progress Analysis</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchAnalysis}
            disabled={isLoading}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-4 bg-muted animate-pulse rounded" />
            <div className="h-4 bg-muted animate-pulse rounded w-5/6" />
            <div className="h-4 bg-muted animate-pulse rounded w-4/6" />
          </div>
        ) : (
          <div className="text-base leading-relaxed text-muted-foreground prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-strong:text-foreground">
            <ReactMarkdown>{analysis || "Loading your personalized progress analysis..."}</ReactMarkdown>
          </div>
        )}

        <Separator className="my-6" />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Ask Coach</h3>
            </div>
            {chatMessages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChat}
                className="h-8 w-8 p-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {(chatMessages.length > 0 || isChatLoading) && (
            <ScrollArea ref={scrollAreaRef} className="h-64 pr-4">
              <div className="space-y-3">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-primary/10 ml-4'
                        : 'bg-muted mr-4'
                    }`}
                  >
                    <div className="text-base leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-strong:text-foreground">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted mr-4">
                    <Sparkles className="h-4 w-4 text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">Coach is thinking...</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <div className="flex gap-2">
            <Textarea
              placeholder="Ask your fitness coach anything..."
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isChatLoading}
              className="min-h-[60px] text-base"
            />
            <Button
              onClick={sendMessage}
              disabled={!userMessage.trim() || isChatLoading}
              size="icon"
              className="h-[60px] w-[60px]"
            >
              <Send className={`h-4 w-4 ${isChatLoading ? 'animate-pulse' : ''}`} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
