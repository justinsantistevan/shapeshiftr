-- Add token usage tracking fields to coach_chat_logs
ALTER TABLE coach_chat_logs 
ADD COLUMN tokens_input integer,
ADD COLUMN tokens_output integer,
ADD COLUMN tokens_total integer;

-- Create index for cost analysis queries
CREATE INDEX idx_coach_chat_logs_tokens 
ON coach_chat_logs(created_at, tokens_total) 
WHERE tokens_total IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN coach_chat_logs.tokens_input IS 'Number of tokens in the input (prompt + conversation history)';
COMMENT ON COLUMN coach_chat_logs.tokens_output IS 'Number of tokens in the model response (completion)';
COMMENT ON COLUMN coach_chat_logs.tokens_total IS 'Total tokens used (input + output) for cost tracking';