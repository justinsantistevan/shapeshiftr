-- Clean up duplicate affirmations by keeping only the earliest created entry for each user_id + display_order + text combination
DELETE FROM user_affirmations 
WHERE id NOT IN (
    SELECT DISTINCT ON (user_id, display_order, text) id
    FROM user_affirmations 
    ORDER BY user_id, display_order, text, created_at ASC
);