-- Fix function search paths for security

-- Drop and recreate calculate_task_total_minutes with proper search_path
DROP TRIGGER IF EXISTS update_task_total_minutes_on_insert ON public.time_entries;
DROP TRIGGER IF EXISTS update_task_total_minutes_on_update ON public.time_entries;
DROP TRIGGER IF EXISTS update_task_total_minutes_on_delete ON public.time_entries;
DROP FUNCTION IF EXISTS public.calculate_task_total_minutes();

CREATE OR REPLACE FUNCTION public.calculate_task_total_minutes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_total INTEGER;
BEGIN
  -- Calculate total minutes for the task
  SELECT COALESCE(SUM(duration_minutes), 0)
  INTO task_total
  FROM public.time_entries
  WHERE task_id = COALESCE(NEW.task_id, OLD.task_id);

  -- Update the task
  UPDATE public.tasks
  SET total_minutes = task_total
  WHERE id = COALESCE(NEW.task_id, OLD.task_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recreate triggers
CREATE TRIGGER update_task_total_minutes_on_insert
  AFTER INSERT ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_task_total_minutes();

CREATE TRIGGER update_task_total_minutes_on_update
  AFTER UPDATE ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_task_total_minutes();

CREATE TRIGGER update_task_total_minutes_on_delete
  AFTER DELETE ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_task_total_minutes();

-- Fix update_updated_at function
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
DROP FUNCTION IF EXISTS public.update_updated_at();

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Recreate triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();