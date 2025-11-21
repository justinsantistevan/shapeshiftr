-- Add conversation tracking fields to coach_chat_logs
ALTER TABLE coach_chat_logs 
ADD COLUMN conversation_id uuid,
ADD COLUMN conversation_position integer;

-- Create index for efficient conversation queries
CREATE INDEX idx_coach_chat_logs_conversation 
ON coach_chat_logs(conversation_id, conversation_position);

-- Add comments for documentation
COMMENT ON COLUMN coach_chat_logs.conversation_id IS 
'UUID tracking the conversation thread - generated on component mount or chat clear';

COMMENT ON COLUMN coach_chat_logs.conversation_position IS 
'Sequential position of this message within the conversation (1, 2, 3, etc.)';