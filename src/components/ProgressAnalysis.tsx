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
import { ChatFeedback } from "./ChatFeedback";
import { toast } from "@/hooks/use-toast";

interface ProgressAnalysisProps {
  stats: FitnessStats | null;
  goals: UserGoals;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  id: string;
  feedbackType?: 'positive' | 'negative' | 'none';
  timestamp?: string;
}

export const ProgressAnalysis = ({ stats, goals }: ProgressAnalysisProps) => {
  const [analysis, setAnalysis] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userMessage, setUserMessage] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [affirmations, setAffirmations] = useState<Affirmation[]>([]);
  const [messageFeedback, setMessageFeedback] = useState<Record<string, 'positive' | 'negative' | 'none'>>({});
  const [conversationId, setConversationId] = useState<string>(() => crypto.randomUUID());
  const [messagePosition, setMessagePosition] = useState<number>(0);
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

  const saveInteraction = async (
    userMsg: string,
    assistantResp: string,
    messageId: string,
    responseTimeMs: number,
    errorOccurred: boolean,
    errorMsg: string | null,
    llmModel: string | null,
    promptVersion: string | null,
    convId: string,
    convPosition: number,
    tokensInput: number | null,
    tokensOutput: number | null,
    tokensTotal: number | null
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('No authenticated user, skipping log save');
        return;
      }

      // Limit conversation context to last 10 messages to keep size manageable
      const limitedContext = chatMessages.length > 10 
        ? chatMessages.slice(-10) 
        : chatMessages;

      const { error } = await supabase
        .from('coach_chat_logs')
        .insert({
          id: messageId,
          user_id: user.id,
          user_message: userMsg,
          assistant_response: assistantResp,
          feedback_type: 'none',
          user_stats_snapshot: stats as any,
          user_goals_snapshot: goals as any,
          user_affirmations_snapshot: affirmations as any,
          conversation_context: limitedContext.length > 0 ? (limitedContext as any) : null,
          llm_model: llmModel,
          system_prompt_version: promptVersion || 'v1.0',
          response_time_ms: responseTimeMs,
          error_occurred: errorOccurred,
          error_message: errorMsg,
          conversation_id: convId,
          conversation_position: convPosition,
          tokens_input: tokensInput,
          tokens_output: tokensOutput,
          tokens_total: tokensTotal,
        });

      if (error) {
        console.error('Error saving chat interaction:', error);
      }
    } catch (error) {
      console.error('Exception saving chat interaction:', error);
    }
  };

  const handleFeedbackChange = async (
    messageId: string,
    newFeedbackType: 'positive' | 'negative' | 'none'
  ) => {
    try {
      // Optimistic UI update
      setMessageFeedback(prev => ({
        ...prev,
        [messageId]: newFeedbackType
      }));

      const { error } = await supabase
        .from('coach_chat_logs')
        .update({
          feedback_type: newFeedbackType,
          feedback_timestamp: newFeedbackType !== 'none' ? new Date().toISOString() : null
        })
        .eq('id', messageId);

      if (error) throw error;


    } catch (error) {
      console.error('Error updating feedback:', error);
      
      // Revert optimistic update on error
      setMessageFeedback(prev => ({
        ...prev,
        [messageId]: prev[messageId] || 'none'
      }));
      
      toast({
        title: "Failed to save feedback",
        description: "Please try again.",
        variant: "destructive"
      });
    }
  };

  const sendMessage = async () => {
    if (!userMessage.trim() || isChatLoading) return;

    // Increment position for this message pair
    const currentPosition = messagePosition + 1;
    setMessagePosition(currentPosition);

    const userMsgContent = userMessage;
    const newUserMessage: ChatMessage = {
      role: 'user',
      content: userMsgContent,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    };

    setChatMessages(prev => [...prev, newUserMessage]);
    setUserMessage("");
    setIsChatLoading(true);
    
    const startTime = Date.now();

    try {
      const { data, error } = await supabase.functions.invoke('chat-coach', {
        body: { 
          message: userMsgContent,
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

      const responseTime = Date.now() - startTime;
      const assistantMessageId = crypto.randomUUID();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.reply,
        id: assistantMessageId,
        feedbackType: 'none',
        timestamp: new Date().toISOString()
      };

      setChatMessages(prev => [...prev, assistantMessage]);
      
      // Initialize feedback state for this message
      setMessageFeedback(prev => ({
        ...prev,
        [assistantMessageId]: 'none'
      }));

      // Log interaction to database immediately (non-blocking)
        await saveInteraction(
          userMsgContent,
          data.reply,
          assistantMessageId,
          responseTime,
          false,
          null,
          data.metadata?.llm_model || null,
          data.metadata?.system_prompt_version || null,
          conversationId,
          currentPosition,
          data.metadata?.tokens_input || null,
          data.metadata?.tokens_output || null,
          data.metadata?.tokens_total || null
        );

    } catch (error) {
      console.error('Error in chat:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const responseTime = Date.now() - startTime;
      const errorMessageId = crypto.randomUUID();
      
      const errorResponse: ChatMessage = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}`,
        id: errorMessageId,
        timestamp: new Date().toISOString()
      };
      
      setChatMessages(prev => [...prev, errorResponse]);
      
      // Log error interaction
        await saveInteraction(
          userMsgContent,
          errorResponse.content,
          errorMessageId,
          responseTime,
          true,
          errorMessage,
          null,
          null,
          conversationId,
          currentPosition,
          null,
          null,
          null
        );
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
    setConversationId(crypto.randomUUID());
    setMessagePosition(0);
    setMessageFeedback({});
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
          <div className="text-base leading-relaxed text-muted-foreground prose prose-sm max-w-none dark:prose-invert prose-p:my-4 prose-strong:text-foreground">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-4">{children}</p>,
              }}
            >
              {analysis || "Loading your personalized progress analysis..."}
            </ReactMarkdown>
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
                {chatMessages.map((msg) => (
                  <div key={msg.id} className="space-y-2">
                    <div
                      className={`p-3 rounded-lg ${
                        msg.role === 'user'
                          ? 'bg-primary/10 ml-4'
                          : 'bg-muted mr-4'
                      }`}
                    >
                      <div className="text-base leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-p:my-4 prose-strong:text-foreground">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-4">{children}</p>,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                    {msg.role === 'assistant' && msg.id && (
                      <ChatFeedback
                        messageId={msg.id}
                        currentFeedback={messageFeedback[msg.id] || msg.feedbackType || 'none'}
                        onFeedbackChange={handleFeedbackChange}
                        isDisabled={isChatLoading}
                      />
                    )}
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
