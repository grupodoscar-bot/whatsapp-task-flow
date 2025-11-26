-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_role AS ENUM ('admin', 'user');
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'blocked', 'completed');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE task_origin AS ENUM ('manual', 'whatsapp_message', 'whatsapp_poll');
CREATE TYPE time_entry_type AS ENUM ('automatic', 'manual');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'user',
  active BOOLEAN NOT NULL DEFAULT true,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'pending',
  priority task_priority NOT NULL DEFAULT 'medium',
  responsible_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  origin task_origin NOT NULL DEFAULT 'manual',
  whatsapp_chat_name TEXT,
  whatsapp_phone_number TEXT,
  whatsapp_message_id TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  estimated_minutes INTEGER,
  total_minutes INTEGER DEFAULT 0,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create checklist_items table (separate from tasks for flexibility)
CREATE TABLE public.checklist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create comments table
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create time_entries table
CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  entry_type time_entry_type NOT NULL DEFAULT 'automatic',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for tasks
CREATE POLICY "Users can view all tasks"
  ON public.tasks FOR SELECT
  USING (true);

CREATE POLICY "Users can create tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.profiles));

CREATE POLICY "Users can update tasks they created or are responsible for"
  ON public.tasks FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.profiles 
      WHERE id = creator_id OR id = responsible_id
    )
  );

CREATE POLICY "Users can delete tasks they created"
  ON public.tasks FOR DELETE
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.profiles WHERE id = creator_id
    )
  );

-- RLS Policies for checklist_items
CREATE POLICY "Users can view checklist items for tasks they can see"
  ON public.checklist_items FOR SELECT
  USING (
    task_id IN (SELECT id FROM public.tasks)
  );

CREATE POLICY "Users can manage checklist items for their tasks"
  ON public.checklist_items FOR ALL
  USING (
    task_id IN (
      SELECT id FROM public.tasks 
      WHERE creator_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR responsible_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

-- RLS Policies for comments
CREATE POLICY "Users can view comments on tasks they can see"
  ON public.comments FOR SELECT
  USING (
    task_id IN (SELECT id FROM public.tasks)
  );

CREATE POLICY "Users can create comments on tasks"
  ON public.comments FOR INSERT
  WITH CHECK (
    task_id IN (SELECT id FROM public.tasks) AND
    auth.uid() IN (SELECT user_id FROM public.profiles WHERE id = author_id)
  );

CREATE POLICY "Users can delete their own comments"
  ON public.comments FOR DELETE
  USING (
    auth.uid() IN (SELECT user_id FROM public.profiles WHERE id = author_id)
  );

-- RLS Policies for time_entries
CREATE POLICY "Users can view time entries for tasks they can see"
  ON public.time_entries FOR SELECT
  USING (
    task_id IN (SELECT id FROM public.tasks)
  );

CREATE POLICY "Users can create their own time entries"
  ON public.time_entries FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM public.profiles WHERE id = user_id)
  );

CREATE POLICY "Users can update their own time entries"
  ON public.time_entries FOR UPDATE
  USING (
    auth.uid() IN (SELECT user_id FROM public.profiles WHERE id = user_id)
  );

CREATE POLICY "Users can delete their own time entries"
  ON public.time_entries FOR DELETE
  USING (
    auth.uid() IN (SELECT user_id FROM public.profiles WHERE id = user_id)
  );

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    'user'
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Function to calculate and update task total minutes
CREATE OR REPLACE FUNCTION public.calculate_task_total_minutes()
RETURNS TRIGGER
LANGUAGE plpgsql
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

-- Trigger to update task total_minutes when time_entry changes
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

-- Create indexes for better performance
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_responsible ON public.tasks(responsible_id);
CREATE INDEX idx_tasks_creator ON public.tasks(creator_id);
CREATE INDEX idx_tasks_priority ON public.tasks(priority);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_time_entries_task ON public.time_entries(task_id);
CREATE INDEX idx_time_entries_user ON public.time_entries(user_id);
CREATE INDEX idx_time_entries_start_time ON public.time_entries(start_time);
CREATE INDEX idx_comments_task ON public.comments(task_id);
CREATE INDEX idx_checklist_items_task ON public.checklist_items(task_id);