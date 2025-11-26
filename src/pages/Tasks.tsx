import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Clock, User, AlertCircle, CheckCircle2, Circle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Task {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'blocked' | 'completed';
  priority: 'low' | 'medium' | 'high';
  total_minutes: number;
  origin: string;
  responsible: { full_name: string } | null;
  creator: { full_name: string };
}

const statusConfig = {
  pending: { label: 'Pendiente', color: 'bg-warning', icon: Circle },
  in_progress: { label: 'En curso', color: 'bg-primary', icon: Circle },
  blocked: { label: 'Bloqueada', color: 'bg-destructive', icon: AlertCircle },
  completed: { label: 'Completada', color: 'bg-success', icon: CheckCircle2 },
};

const priorityColors = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-warning/20 text-warning',
  high: 'bg-destructive/20 text-destructive',
};

export default function Tasks() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Record<string, Task[]>>({
    pending: [],
    in_progress: [],
    blocked: [],
    completed: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        status,
        priority,
        total_minutes,
        origin,
        responsible:profiles!tasks_responsible_id_fkey(full_name),
        creator:profiles!tasks_creator_id_fkey(full_name)
      `)
      .order('created_at', { ascending: false });

    if (data) {
      const grouped = {
        pending: data.filter((t) => t.status === 'pending'),
        in_progress: data.filter((t) => t.status === 'in_progress'),
        blocked: data.filter((t) => t.status === 'blocked'),
        completed: data.filter((t) => t.status === 'completed'),
      };
      setTasks(grouped);
    }
    
    setLoading(false);
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const TaskCard = ({ task }: { task: Task }) => {
    const config = statusConfig[task.status];
    const Icon = config.icon;

    return (
      <Card
        className="cursor-pointer p-4 transition-smooth hover:shadow-lg"
        onClick={() => navigate(`/tasks/${task.id}`)}
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-tight">{task.title}</h3>
            <Icon className={`h-5 w-5 flex-shrink-0 ${config.color.replace('bg-', 'text-')}`} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={priorityColors[task.priority]}>
              {task.priority === 'low' ? 'Baja' : task.priority === 'medium' ? 'Media' : 'Alta'}
            </Badge>
            
            {task.origin !== 'manual' && (
              <Badge variant="outline" className="bg-primary/10 text-primary">
                WhatsApp
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              <span className="truncate">{task.responsible?.full_name || 'Sin asignar'}</span>
            </div>
            {task.total_minutes > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>{formatTime(task.total_minutes)}</span>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Tablero Kanban</h1>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {Object.entries(statusConfig).map(([status, config]) => (
            <div key={status} className="space-y-4">
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${config.color}`} />
                <h2 className="font-semibold">
                  {config.label} ({tasks[status as keyof typeof tasks].length})
                </h2>
              </div>

              <div className="space-y-3">
                {loading ? (
                  <>
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-32 w-full" />
                    ))}
                  </>
                ) : (
                  tasks[status as keyof typeof tasks].map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
