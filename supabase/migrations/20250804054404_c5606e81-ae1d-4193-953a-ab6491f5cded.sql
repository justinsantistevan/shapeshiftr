-- Insert mock fitness data for 8 weeks to test trends
-- This will create realistic progression data for testing the Quick Stats

DO $$
DECLARE
    current_user_id uuid;
    base_date date := current_date - interval '8 weeks';
BEGIN
    -- Get current user ID (if any user exists)
    SELECT id INTO current_user_id FROM auth.users LIMIT 1;
    
    -- If no user exists, we'll use a placeholder UUID
    IF current_user_id IS NULL THEN
        current_user_id := '00000000-0000-0000-0000-000000000001'::uuid;
    END IF;

    -- Insert 8 weeks of mock data with realistic progression
    -- Week 1 (8 weeks ago) - Starting values
    INSERT INTO public.weekly_fitness_entries (
        user_id, week_start_date, weight, body_fat_percentage, skin_fold_mm, 
        avg_daily_calories, avg_exercise_min_per_day, notes
    ) VALUES (
        current_user_id, 
        base_date, 
        185.5, 
        19.8, 
        16, 
        2400, 
        35, 
        'Starting my fitness journey!'
    );

    -- Week 2 (7 weeks ago)
    INSERT INTO public.weekly_fitness_entries (
        user_id, week_start_date, weight, body_fat_percentage, skin_fold_mm, 
        avg_daily_calories, avg_exercise_min_per_day, notes
    ) VALUES (
        current_user_id, 
        base_date + interval '1 week', 
        184.8, 
        19.5, 
        15, 
        2350, 
        40, 
        'Getting into the routine'
    );

    -- Week 3 (6 weeks ago)
    INSERT INTO public.weekly_fitness_entries (
        user_id, week_start_date, weight, body_fat_percentage, skin_fold_mm, 
        avg_daily_calories, avg_exercise_min_per_day, notes
    ) VALUES (
        current_user_id, 
        base_date + interval '2 weeks', 
        183.9, 
        19.2, 
        15, 
        2300, 
        42, 
        'Seeing some progress'
    );

    -- Week 4 (5 weeks ago)
    INSERT INTO public.weekly_fitness_entries (
        user_id, week_start_date, weight, body_fat_percentage, skin_fold_mm, 
        avg_daily_calories, avg_exercise_min_per_day, notes
    ) VALUES (
        current_user_id, 
        base_date + interval '3 weeks', 
        183.2, 
        18.9, 
        14, 
        2250, 
        45, 
        'Hitting my stride'
    );

    -- Week 5 (4 weeks ago) - This will be used for "monthly" comparison
    INSERT INTO public.weekly_fitness_entries (
        user_id, week_start_date, weight, body_fat_percentage, skin_fold_mm, 
        avg_daily_calories, avg_exercise_min_per_day, notes
    ) VALUES (
        current_user_id, 
        base_date + interval '4 weeks', 
        182.5, 
        18.6, 
        14, 
        2200, 
        48, 
        'One month milestone!'
    );

    -- Week 6 (3 weeks ago)
    INSERT INTO public.weekly_fitness_entries (
        user_id, week_start_date, weight, body_fat_percentage, skin_fold_mm, 
        avg_daily_calories, avg_exercise_min_per_day, notes
    ) VALUES (
        current_user_id, 
        base_date + interval '5 weeks', 
        181.8, 
        18.3, 
        13, 
        2180, 
        50, 
        'Steady progress continues'
    );

    -- Week 7 (2 weeks ago)
    INSERT INTO public.weekly_fitness_entries (
        user_id, week_start_date, weight, body_fat_percentage, skin_fold_mm, 
        avg_daily_calories, avg_exercise_min_per_day, notes
    ) VALUES (
        current_user_id, 
        base_date + interval '6 weeks', 
        180.9, 
        18.0, 
        13, 
        2150, 
        52, 
        'Really feeling stronger'
    );

    -- Week 8 (1 week ago) - Most recent entry
    INSERT INTO public.weekly_fitness_entries (
        user_id, week_start_date, weight, body_fat_percentage, skin_fold_mm, 
        avg_daily_calories, avg_exercise_min_per_day, notes
    ) VALUES (
        current_user_id, 
        base_date + interval '7 weeks', 
        180.1, 
        17.7, 
        12, 
        2120, 
        55, 
        'Best week yet!'
    );

END $$;